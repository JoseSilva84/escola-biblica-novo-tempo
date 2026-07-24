#!/usr/bin/env python3
"""Piloto de ML para resultados de contato por distrito.

Fluxo:
1. Extrai um distrito da planilha para um JSON de acompanhamento.
2. Preserva os resultados preenchidos quando o JSON e regenerado.
3. Treina um modelo apenas com resultados reais observados.
4. Aplica o modelo a outros distritos da planilha.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any


try:
    import joblib
    import numpy as np
    import pandas as pd
    from sklearn.compose import ColumnTransformer
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        average_precision_score,
        classification_report,
        confusion_matrix,
        roc_auc_score,
    )
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
except ImportError as exc:
    raise SystemExit(
        "Dependencias ausentes. Execute no kernel do notebook ou instale: "
        "pandas scikit-learn openpyxl joblib"
    ) from exc


TARGETS = (
    "respondeu",
    "demonstrou_interesse",
    "aceitou_visita",
    "participou",
)
NUMERIC_FEATURES = (
    "log_dias_desde_contato",
    "materiais_quantidade",
    "tem_telefone",
    "telefone_valido",
    "tem_email",
    "email_valido",
    "tem_descricao",
)
CATEGORICAL_FEATURES = (
    "material_principal",
)
MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
EMAIL_RE = re.compile(r"^[^@\s;]+@[^@\s;]+\.[^@\s;]+$")
MATERIAL_SPLIT_RE = re.compile(r"\s*\*-\*\s*")


def repair_mojibake(value: str) -> str:
    if not any(marker in value for marker in ("Ã", "Â", "â")):
        return value
    try:
        repaired = value.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value
    return repaired


def normalize_text(value: Any) -> str:
    text = repair_mojibake(" ".join(str(value or "").strip().split()))
    text = unicodedata.normalize("NFKD", text)
    return "".join(char for char in text if not unicodedata.combining(char)).upper()


def clean_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date().isoformat()
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    return repair_mojibake(str(value).strip())


def parse_date(value: Any) -> pd.Timestamp | None:
    if value is None or pd.isna(value):
        return None
    parsed = pd.to_datetime(value, dayfirst=True, errors="coerce")
    return None if pd.isna(parsed) else parsed.normalize()


def material_names(value: Any) -> list[str]:
    if value is None or pd.isna(value):
        return []
    names: list[str] = []
    for item in MATERIAL_SPLIT_RE.split(str(value)):
        item = item.strip()
        if not item:
            continue
        name = item.split(" | ", 1)[0]
        name = re.sub(
            r"\s*-\s*(IMPRESSO|PDF|DIGITAL)\s*$",
            "",
            name,
            flags=re.IGNORECASE,
        )
        names.append(normalize_text(name))
    return names


def valid_phone(value: Any) -> bool:
    digits = re.sub(r"\D", "", "" if pd.isna(value) else str(value))
    return 10 <= len(digits) <= 13


def valid_email(value: Any) -> bool:
    if value is None or pd.isna(value):
        return False
    emails = [part.strip() for part in re.split(r"[;,]", str(value)) if part.strip()]
    return bool(emails) and all(EMAIL_RE.match(email) for email in emails)


def reference_date(frame: pd.DataFrame) -> pd.Timestamp:
    dates = pd.to_datetime(
        frame["Data do Ultimo Contato"], dayfirst=True, errors="coerce"
    )
    if dates.notna().any():
        return dates.max().normalize()
    return pd.Timestamp(date.today())


def canonicalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    rename = {column: normalize_text(column).title() for column in frame.columns}
    frame = frame.rename(columns=rename)
    expected = {
        "Id": "ID",
        "Aluno": "Aluno",
        "Sobrenome": "Sobrenome",
        "Cidade": "Cidade",
        "Bairro": "Bairro",
        "Email": "Email",
        "Telefone": "Telefone",
        "Material": "Material",
        "Vip": "Vip",
        "Descricao": "Descricao",
        "Distrito": "Distrito",
        "Data Do Ultimo Contato": "Data do Ultimo Contato",
    }
    frame = frame.rename(columns=expected)
    missing = sorted(set(expected.values()) - set(frame.columns))
    if missing:
        raise ValueError(f"Colunas obrigatorias ausentes: {', '.join(missing)}")
    return frame


def load_spreadsheet(path: Path) -> pd.DataFrame:
    return canonicalize_columns(pd.read_excel(path, engine="openpyxl"))


def build_features(row: pd.Series, ref_date: pd.Timestamp) -> dict[str, Any]:
    last_contact = parse_date(row["Data do Ultimo Contato"])
    days = (
        max(0, int((ref_date - last_contact).days))
        if last_contact is not None
        else 365 * 20
    )
    materials = material_names(row["Material"])
    phone = clean_value(row["Telefone"])
    email = clean_value(row["Email"])
    return {
        "log_dias_desde_contato": math.log1p(days),
        "materiais_quantidade": min(len(materials), 20),
        "tem_telefone": int(bool(phone)),
        "telefone_valido": int(valid_phone(phone)),
        "tem_email": int(bool(email)),
        "email_valido": int(valid_email(email)),
        "tem_descricao": int(bool(clean_value(row["Descricao"]))),
        "cidade": normalize_text(row["Cidade"]) or "NAO INFORMADO",
        "bairro": normalize_text(row["Bairro"]) or "NAO INFORMADO",
        "material_principal": materials[0] if materials else "NAO INFORMADO",
    }


def empty_outcomes() -> dict[str, Any]:
    return {
        "tentativa_contato": False,
        "data_tentativa": None,
        "canal": None,
        "respondeu": None,
        "demonstrou_interesse": None,
        "aceitou_visita": None,
        "participou": None,
        "observacao": None,
    }


def record_id(row: pd.Series) -> str:
    value = clean_value(row["ID"])
    return str(value)


def load_existing_outcomes(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        str(record["id"]): record.get("resultados", {})
        for record in payload.get("registros", [])
    }


def prepare(args: argparse.Namespace) -> None:
    frame = load_spreadsheet(args.arquivo)
    district_key = normalize_text(args.distrito)
    selected = frame[
        frame["Distrito"].map(normalize_text).eq(district_key)
    ].copy()
    if selected.empty:
        raise SystemExit(f"Nenhum registro encontrado para {args.distrito!r}.")

    ref_date = reference_date(frame)
    previous = load_existing_outcomes(args.saida)
    records = []
    for _, row in selected.iterrows():
        identifier = record_id(row)
        outcomes = empty_outcomes()
        outcomes.update(previous.get(identifier, {}))
        records.append(
            {
                "id": identifier,
                "contato": {
                    "nome": " ".join(
                        filter(
                            None,
                            (
                                clean_value(row["Aluno"]),
                                clean_value(row["Sobrenome"]),
                            ),
                        )
                    ),
                    "telefone": clean_value(row["Telefone"]),
                    "email": clean_value(row["Email"]),
                },
                "origem": {
                    "distrito": clean_value(row["Distrito"]),
                    "cidade": clean_value(row["Cidade"]),
                    "bairro": clean_value(row["Bairro"]),
                    "material": clean_value(row["Material"]),
                    "ultimo_contato": (
                        parse_date(row["Data do Ultimo Contato"]).date().isoformat()
                        if parse_date(row["Data do Ultimo Contato"]) is not None
                        else None
                    ),
                    "vip_historico": normalize_text(row["Vip"]) == "SIM",
                },
                "atributos_modelo": build_features(row, ref_date),
                "resultados": outcomes,
            }
        )

    payload = {
        "schema_version": 1,
        "objetivo": "Prever resultado real de contato, nao reproduzir o VIP historico.",
        "distrito_piloto": args.distrito,
        "fonte": str(args.arquivo),
        "data_referencia": ref_date.date().isoformat(),
        "total_registros": len(records),
        "alvos_disponiveis": list(TARGETS),
        "campos_excluidos_modelo": [
            "nome",
            "telefone",
            "email",
            "sexo",
            "religiao",
            "idade",
            "endereco",
            "vip_historico",
            "distrito",
            "cidade",
            "bairro",
        ],
        "registros": records,
    }
    args.saida.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    labeled = sum(
        record["resultados"].get(args.alvo) is not None for record in records
    )
    print(
        f"JSON preparado: {args.saida} | registros={len(records)} "
        f"| rotulados_em_{args.alvo}={labeled}"
    )


def records_to_frame(payload: dict[str, Any], target: str) -> pd.DataFrame:
    rows = []
    for record in payload.get("registros", []):
        row = {
            "id": str(record["id"]),
            **record["atributos_modelo"],
            target: record.get("resultados", {}).get(target),
        }
        rows.append(row)
    return pd.DataFrame(rows)


def model_pipeline() -> Pipeline:
    numeric = Pipeline(
        [
            ("imputacao", SimpleImputer(strategy="median")),
            ("escala", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        [
            ("imputacao", SimpleImputer(strategy="most_frequent")),
            (
                "onehot",
                OneHotEncoder(handle_unknown="ignore", min_frequency=2),
            ),
        ]
    )
    preprocessing = ColumnTransformer(
        [
            ("numericas", numeric, list(NUMERIC_FEATURES)),
            ("categoricas", categorical, list(CATEGORICAL_FEATURES)),
        ]
    )
    return Pipeline(
        [
            ("preprocessamento", preprocessing),
            (
                "classificador",
                LogisticRegression(
                    class_weight="balanced",
                    max_iter=2000,
                    C=0.5,
                    solver="liblinear",
                    random_state=42,
                ),
            ),
        ]
    )


def validate_labels(frame: pd.DataFrame, target: str) -> pd.DataFrame:
    labeled = frame[frame[target].notna()].copy()
    if len(labeled) < 30:
        raise SystemExit(
            f"Treino bloqueado: somente {len(labeled)} registros rotulados. "
            "Preencha pelo menos 30 resultados reais."
        )
    invalid = labeled[~labeled[target].isin([True, False, 0, 1])]
    if not invalid.empty:
        raise SystemExit(
            f"Treino bloqueado: {len(invalid)} rotulos invalidos. "
            "Use apenas true, false ou null."
        )
    counts = labeled[target].astype(int).value_counts()
    if len(counts) < 2 or counts.min() < 5:
        raise SystemExit(
            "Treino bloqueado: sao necessarios pelo menos 5 exemplos positivos "
            "e 5 negativos."
        )
    return labeled


def train(args: argparse.Namespace) -> None:
    payload = json.loads(args.dados.read_text(encoding="utf-8"))
    frame = validate_labels(records_to_frame(payload, args.alvo), args.alvo)
    x = frame[list(MODEL_FEATURES)]
    y = frame[args.alvo].astype(int)
    minority = int(y.value_counts().min())
    folds = min(5, minority)
    cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=42)
    pipeline = model_pipeline()
    probabilities = cross_val_predict(
        pipeline, x, y, cv=cv, method="predict_proba"
    )[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    recency_baseline = -frame["log_dias_desde_contato"].astype(float).to_numpy()
    metrics = {
        "alvo": args.alvo,
        "registros_rotulados": int(len(frame)),
        "positivos": int(y.sum()),
        "negativos": int((1 - y).sum()),
        "folds_validacao": folds,
        "roc_auc": float(roc_auc_score(y, probabilities)),
        "average_precision": float(average_precision_score(y, probabilities)),
        "baseline_recencia_roc_auc": float(roc_auc_score(y, recency_baseline)),
        "baseline_recencia_average_precision": float(
            average_precision_score(y, recency_baseline)
        ),
        "matriz_confusao": confusion_matrix(y, predictions).tolist(),
        "relatorio_classificacao": classification_report(
            y, predictions, output_dict=True, zero_division=0
        ),
        "observacao": (
            "Metricas de validacao cruzada no distrito piloto; validar "
            "externamente antes de uso em outros distritos."
        ),
    }
    pipeline.fit(x, y)
    bundle = {
        "pipeline": pipeline,
        "alvo": args.alvo,
        "atributos": list(MODEL_FEATURES),
        "distrito_piloto": payload.get("distrito_piloto"),
        "metricas": metrics,
    }
    joblib.dump(bundle, args.modelo)
    args.metricas.write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        f"Modelo salvo: {args.modelo} | alvo={args.alvo} "
        f"| ROC_AUC={metrics['roc_auc']:.3f} "
        f"| AP={metrics['average_precision']:.3f}"
    )


def predict(args: argparse.Namespace) -> None:
    bundle = joblib.load(args.modelo)
    frame = load_spreadsheet(args.arquivo)
    ref_date = reference_date(frame)
    if args.distrito:
        district_key = normalize_text(args.distrito)
        frame = frame[
            frame["Distrito"].map(normalize_text).eq(district_key)
        ].copy()
    if frame.empty:
        raise SystemExit("Nenhum registro disponivel para previsao.")

    features = pd.DataFrame(
        [build_features(row, ref_date) for _, row in frame.iterrows()]
    )
    probabilities = bundle["pipeline"].predict_proba(
        features[list(bundle["atributos"])]
    )[:, 1]
    output = pd.DataFrame(
        {
            "id": frame["ID"].map(clean_value),
            "nome": (
                frame["Aluno"].fillna("").astype(str).str.strip()
                + " "
                + frame["Sobrenome"].fillna("").astype(str).str.strip()
            ).str.strip(),
            "distrito": frame["Distrito"].map(clean_value),
            "cidade": frame["Cidade"].map(clean_value),
            "bairro": frame["Bairro"].map(clean_value),
            "telefone": frame["Telefone"].map(clean_value),
            "email": frame["Email"].map(clean_value),
            f"probabilidade_{bundle['alvo']}": probabilities,
        }
    ).sort_values(f"probabilidade_{bundle['alvo']}", ascending=False)
    output.to_csv(args.saida, index=False, encoding="utf-8-sig")
    print(f"Previsoes salvas: {args.saida} | registros={len(output)}")


def status(args: argparse.Namespace) -> None:
    payload = json.loads(args.dados.read_text(encoding="utf-8"))
    frame = records_to_frame(payload, args.alvo)
    labeled = frame[frame[args.alvo].notna()]
    positives = int(labeled[args.alvo].eq(True).sum())
    negatives = int(labeled[args.alvo].eq(False).sum())
    print(
        f"total={len(frame)} | alvo={args.alvo} | rotulados={len(labeled)} "
        f"| positivos={positives} | negativos={negatives} "
        f"| pendentes={len(frame) - len(labeled)}"
    )


def path(value: str) -> Path:
    return Path(value)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        description="Piloto de ML de interesse por distrito."
    )
    commands = root.add_subparsers(dest="comando", required=True)

    prepare_parser = commands.add_parser(
        "preparar", help="Extrai o distrito e cria/preserva o JSON."
    )
    prepare_parser.add_argument(
        "--arquivo", type=path, default=Path("ListagemCompleta (1).xlsx")
    )
    prepare_parser.add_argument("--distrito", default="Alphaville")
    prepare_parser.add_argument(
        "--saida", type=path, default=Path("dados_interesse_Alphaville.json")
    )
    prepare_parser.add_argument("--alvo", choices=TARGETS, default="respondeu")
    prepare_parser.set_defaults(func=prepare)

    status_parser = commands.add_parser(
        "status", help="Mostra o progresso dos rotulos."
    )
    status_parser.add_argument(
        "--dados", type=path, default=Path("dados_interesse_Alphaville.json")
    )
    status_parser.add_argument("--alvo", choices=TARGETS, default="respondeu")
    status_parser.set_defaults(func=status)

    train_parser = commands.add_parser(
        "treinar", help="Treina com os resultados reais preenchidos."
    )
    train_parser.add_argument(
        "--dados", type=path, default=Path("dados_interesse_Alphaville.json")
    )
    train_parser.add_argument("--alvo", choices=TARGETS, default="respondeu")
    train_parser.add_argument(
        "--modelo", type=path, default=Path("modelo_interesse_Alphaville.joblib")
    )
    train_parser.add_argument(
        "--metricas",
        type=path,
        default=Path("metricas_interesse_Alphaville.json"),
    )
    train_parser.set_defaults(func=train)

    predict_parser = commands.add_parser(
        "prever", help="Aplica o modelo a um distrito ou a base inteira."
    )
    predict_parser.add_argument(
        "--modelo", type=path, default=Path("modelo_interesse_Alphaville.joblib")
    )
    predict_parser.add_argument(
        "--arquivo", type=path, default=Path("ListagemCompleta (1).xlsx")
    )
    predict_parser.add_argument("--distrito")
    predict_parser.add_argument(
        "--saida", type=path, default=Path("previsoes_interesse_distritos.csv")
    )
    predict_parser.set_defaults(func=predict)
    return root


def main() -> None:
    args = parser().parse_args()
    try:
        args.func(args)
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
