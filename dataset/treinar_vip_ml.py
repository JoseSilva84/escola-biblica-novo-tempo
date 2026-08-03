#!/usr/bin/env python3
"""Treina o modelo VIP e gera os rankings usados pelo backend."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


DEFAULT_DATASET_DIR = Path(__file__).resolve().parent
DEFAULT_EXCEL = DEFAULT_DATASET_DIR / "ListagemCompleta (1).xlsx"
DEFAULT_REFERENCE_DATE = "2026-06-08"
RANDOM_STATE = 42


def normalizar_texto(valor):
    if pd.isna(valor):
        return "NAO INFORMADO"
    texto = " ".join(str(valor).strip().split())
    texto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in texto if not unicodedata.combining(c)).upper() or "NAO INFORMADO"


def quantidade_materiais(valor):
    if pd.isna(valor) or not str(valor).strip():
        return 0
    return len(re.split(r"\s*\*-\*\s*", str(valor).strip()))


def material_principal(valor):
    if pd.isna(valor) or not str(valor).strip():
        return "NAO INFORMADO"
    primeiro = re.split(r"\s*\*-\*\s*", str(valor).strip())[0]
    nome = primeiro.split(" | ", 1)[0]
    nome = re.sub(r"\s*-\s*(IMPRESSO|PDF|DIGITAL)\s*$", "", nome, flags=re.I)
    return normalizar_texto(nome)


def telefone_valido(valor):
    digitos = re.sub(r"\D", "", "" if pd.isna(valor) else str(valor))
    return int(10 <= len(digitos) <= 13)


def treinar_vip_ml(
    source: Path = DEFAULT_EXCEL,
    output_dir: Path = DEFAULT_DATASET_DIR,
    reference_date: str = DEFAULT_REFERENCE_DATE,
) -> dict:
    data_referencia = pd.Timestamp(reference_date)
    df = pd.read_excel(source, engine="openpyxl")
    base = df.copy()
    base["vip_alvo"] = base["Vip"].map(normalizar_texto).eq("SIM").astype(int)
    base["ultimo_contato_dt"] = pd.to_datetime(
        base["Data do Último Contato"], dayfirst=True, errors="coerce"
    )
    base["dias_desde_contato"] = (data_referencia - base["ultimo_contato_dt"]).dt.days.clip(lower=0)
    base["log_dias_desde_contato"] = np.log1p(base["dias_desde_contato"].fillna(365 * 20))
    base["materiais_quantidade"] = base["Material"].map(quantidade_materiais).clip(upper=20)
    base["material_principal"] = base["Material"].map(material_principal)

    for coluna in ["Cidade", "Bairro", "Distrito"]:
        base[coluna.lower()] = base[coluna].map(normalizar_texto)

    base["tem_telefone"] = base["Telefone"].fillna("").astype(str).str.strip().ne("").astype(int)
    base["telefone_valido"] = base["Telefone"].map(telefone_valido)
    base["tem_email"] = base["Email"].fillna("").astype(str).str.strip().ne("").astype(int)
    base["email_valido"] = (
        base["Email"].fillna("").astype(str).str.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").astype(int)
    )
    base["tem_descricao"] = base["Descrição"].fillna("").astype(str).str.strip().ne("").astype(int)

    numericas = [
        "log_dias_desde_contato",
        "materiais_quantidade",
        "tem_telefone",
        "telefone_valido",
        "tem_email",
        "email_valido",
        "tem_descricao",
    ]
    categoricas = ["cidade", "bairro", "distrito", "material_principal"]
    atributos = numericas + categoricas

    X = base[atributos]
    y = base["vip_alvo"]
    X_treino, X_teste, y_treino, y_teste = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=RANDOM_STATE
    )

    modelo = Pipeline(
        [
            (
                "preprocessamento",
                ColumnTransformer(
                    [
                        (
                            "numericas",
                            Pipeline(
                                [
                                    ("imputacao", SimpleImputer(strategy="median")),
                                    ("escala", StandardScaler()),
                                ]
                            ),
                            numericas,
                        ),
                        (
                            "categoricas",
                            Pipeline(
                                [
                                    ("imputacao", SimpleImputer(strategy="most_frequent")),
                                    ("onehot", OneHotEncoder(handle_unknown="ignore", min_frequency=20)),
                                ]
                            ),
                            categoricas,
                        ),
                    ]
                ),
            ),
            (
                "classificador",
                LogisticRegression(
                    class_weight="balanced",
                    max_iter=1500,
                    C=0.8,
                    solver="liblinear",
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
    )

    modelo.fit(X_treino, y_treino)
    prob_teste = modelo.predict_proba(X_teste)[:, 1]

    modelo_final = modelo.fit(X, y)
    base["score_similaridade_vip"] = modelo_final.predict_proba(X)[:, 1]

    nao_vip = base["vip_alvo"].eq(0)
    base["percentil_similaridade"] = 1.0
    base.loc[nao_vip, "percentil_similaridade"] = base.loc[
        nao_vip, "score_similaridade_vip"
    ].rank(pct=True)
    base["score_recencia"] = np.exp(-base["dias_desde_contato"].fillna(365 * 20) / (365 * 3))
    base["score_contato"] = (
        0.55 * base["telefone_valido"]
        + 0.30 * base["email_valido"]
        + 0.10 * base["tem_telefone"]
        + 0.05 * base["tem_email"]
    ).clip(upper=1)
    base["score_prioridade_operacional"] = (
        0.40 * base["percentil_similaridade"]
        + 0.40 * base["score_recencia"]
        + 0.20 * base["score_contato"]
    )
    base["faixa_prioridade"] = pd.cut(
        base["score_prioridade_operacional"],
        bins=[-np.inf, 0.45, 0.70, np.inf],
        labels=["baixa", "media", "alta"],
        right=False,
    )

    ranking = base.loc[nao_vip].sort_values("score_prioridade_operacional", ascending=False).copy()
    ranking["nome"] = (
        ranking["Aluno"].fillna("") + " " + ranking["Sobrenome"].fillna("")
    ).str.strip()
    colunas_saida = [
        "ID",
        "nome",
        "Distrito",
        "Cidade",
        "Bairro",
        "Telefone",
        "Email",
        "Data do Último Contato",
        "Vip",
        "score_similaridade_vip",
        "score_prioridade_operacional",
        "faixa_prioridade",
    ]
    ranking_alphaville = ranking[ranking["distrito"].eq("ALPHAVILLE")].copy()

    output_dir.mkdir(parents=True, exist_ok=True)
    ranking[colunas_saida].to_csv(
        output_dir / "ranking_nao_vip_ml_pandas.csv", index=False, encoding="utf-8-sig"
    )
    ranking_alphaville[colunas_saida].to_csv(
        output_dir / "ranking_Alphaville_ml_pandas.csv", index=False, encoding="utf-8-sig"
    )
    joblib.dump(modelo_final, output_dir / "modelo_vip_sklearn.joblib")

    metricas = {
        "registros": int(len(base)),
        "vips": int(base["vip_alvo"].sum()),
        "taxa_vip": float(base["vip_alvo"].mean()),
        "ranking_nao_vip": int(len(ranking)),
        "ranking_alphaville": int(len(ranking_alphaville)),
        "roc_auc_teste": float(roc_auc_score(y_teste, prob_teste)),
        "average_precision_teste": float(average_precision_score(y_teste, prob_teste)),
        "random_state": RANDOM_STATE,
        "bibliotecas": ["pandas", "numpy", "scikit-learn", "openpyxl", "joblib"],
    }
    (output_dir / "metricas_vip_sklearn.json").write_text(
        json.dumps(metricas, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    return metricas


def main() -> None:
    parser = argparse.ArgumentParser(description="Treina o modelo VIP e gera os rankings.")
    parser.add_argument("--arquivo", type=Path, default=DEFAULT_EXCEL)
    parser.add_argument("--saida", type=Path, default=DEFAULT_DATASET_DIR)
    parser.add_argument("--data-referencia", default=DEFAULT_REFERENCE_DATE)
    args = parser.parse_args()

    metricas = treinar_vip_ml(args.arquivo, args.saida, args.data_referencia)
    print(json.dumps(metricas, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
