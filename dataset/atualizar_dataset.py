#!/usr/bin/env python3
"""Atualiza todos os arquivos derivados do dataset a partir do Excel principal."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from consolidar_planilhas import consolidar_planilhas
from gerar_alunos_json import DEFAULT_EXCEL, gerar_alunos_json
from gerar_dados_interesse_distritos import gerar_dados_interesse_distritos
from treinar_vip_ml import DEFAULT_DATASET_DIR, DEFAULT_REFERENCE_DATE, treinar_vip_ml

UPDATE_STATUS_FILE = "ultima_atualizacao_dataset.json"
UPDATE_HISTORY_FILE = "historico_atualizacoes_dataset.json"
ML_METRICS_FILE = "metricas_vip_sklearn.json"


def read_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def metric_delta(after: dict, before: dict, key: str) -> dict:
    after_value = after.get(key)
    before_value = before.get(key)
    if isinstance(after_value, (int, float)) and isinstance(before_value, (int, float)):
        delta = after_value - before_value
    else:
        delta = None
    return {
        "antes": before_value,
        "depois": after_value,
        "diferenca": delta,
    }


def build_ml_status(metricas: dict, metricas_anteriores: dict) -> dict:
    now_utc = datetime.now(timezone.utc)
    now_brazil = now_utc.astimezone(ZoneInfo("America/Fortaleza"))
    return {
        "atualizado_em": now_utc.isoformat(),
        "atualizado_em_brasil": now_brazil.isoformat(),
        "timezone": "America/Fortaleza",
        "resumo": {
            "registros": metric_delta(metricas, metricas_anteriores, "registros"),
            "vips": metric_delta(metricas, metricas_anteriores, "vips"),
            "ranking_nao_vip": metric_delta(metricas, metricas_anteriores, "ranking_nao_vip"),
            "ranking_alphaville": metric_delta(metricas, metricas_anteriores, "ranking_alphaville"),
            "roc_auc_teste": metric_delta(metricas, metricas_anteriores, "roc_auc_teste"),
            "average_precision_teste": metric_delta(metricas, metricas_anteriores, "average_precision_teste"),
        },
        "arquivos_atualizados": [
            "modelo_vip_sklearn.joblib",
            "metricas_vip_sklearn.json",
            "ranking_nao_vip_ml_pandas.csv",
            "ranking_Alphaville_ml_pandas.csv",
        ],
    }


def append_history(output_dir: Path, status: dict, limit: int = 50) -> list[dict]:
    history_path = output_dir / UPDATE_HISTORY_FILE
    try:
        history = json.loads(history_path.read_text(encoding="utf-8"))
        if not isinstance(history, list):
            history = []
    except FileNotFoundError:
        history = []
    except json.JSONDecodeError:
        history = []

    history.insert(0, status)
    history = history[:limit]
    history_path.write_text(
        json.dumps(history, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return history


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gera alunos.json, ranking ML, modelo e métricas a partir da planilha."
    )
    parser.add_argument("--arquivo", type=Path, default=DEFAULT_EXCEL)
    parser.add_argument("--saida", type=Path, default=DEFAULT_DATASET_DIR)
    parser.add_argument("--data-referencia", default=DEFAULT_REFERENCE_DATE)
    parser.add_argument("--novos-arquivos", nargs="*", type=Path, default=[])
    args = parser.parse_args()

    consolidacao = None
    if args.novos_arquivos:
        consolidacao = consolidar_planilhas(args.arquivo, args.novos_arquivos)

    metricas_anteriores = read_json(args.saida / ML_METRICS_FILE)
    alunos = gerar_alunos_json(args.arquivo, args.saida / "alunos.json")
    dados_interesse = gerar_dados_interesse_distritos(args.arquivo, args.saida)
    metricas = treinar_vip_ml(args.arquivo, args.saida, args.data_referencia)
    ml_status = build_ml_status(metricas, metricas_anteriores)
    resultado = {"consolidacao": consolidacao, "alunos_json": alunos, "dados_interesse": dados_interesse, "ml": metricas, "ml_status": ml_status}

    if consolidacao:
        status = {
            "atualizado_em": datetime.now(timezone.utc).isoformat(),
            "arquivo_base": str(args.arquivo),
            "alunos_json": alunos,
            "dados_interesse": dados_interesse,
            "consolidacao": consolidacao,
            "ml": metricas,
            "ml_status": ml_status,
        }
        (args.saida / UPDATE_STATUS_FILE).write_text(
            json.dumps(status, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        resultado["historico"] = append_history(args.saida, status)

    print(json.dumps(resultado, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
