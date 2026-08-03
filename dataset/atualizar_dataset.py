#!/usr/bin/env python3
"""Atualiza todos os arquivos derivados do dataset a partir do Excel principal."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from consolidar_planilhas import consolidar_planilhas
from gerar_alunos_json import DEFAULT_EXCEL, gerar_alunos_json
from treinar_vip_ml import DEFAULT_DATASET_DIR, DEFAULT_REFERENCE_DATE, treinar_vip_ml


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

    alunos = gerar_alunos_json(args.arquivo, args.saida / "alunos.json")
    metricas = treinar_vip_ml(args.arquivo, args.saida, args.data_referencia)
    resultado = {"consolidacao": consolidacao, "alunos_json": alunos, "ml": metricas}
    print(json.dumps(resultado, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
