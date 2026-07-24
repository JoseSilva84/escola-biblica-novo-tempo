#!/usr/bin/env python3
"""Analisa e modela o marcador historico VIP de uma planilha XLSX.

O script usa apenas a biblioteca padrao e numpy. Ele gera um relatorio em
Markdown e rankings CSV sem alterar a planilha de origem.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

import numpy as np


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
CELL_REF_RE = re.compile(r"([A-Z]+)")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MATERIAL_SPLIT_RE = re.compile(r"\s*\*-\*\s*")


def normalize_text(value: str) -> str:
    value = " ".join((value or "").strip().split())
    value = unicodedata.normalize("NFKD", value)
    return "".join(c for c in value if not unicodedata.combining(c)).upper()


def col_index(cell_ref: str) -> int:
    letters = CELL_REF_RE.match(cell_ref).group(1)
    result = 0
    for char in letters:
        result = result * 26 + ord(char) - 64
    return result - 1


def read_xlsx(path: Path) -> list[dict[str, str]]:
    with ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = [
                "".join(node.text or "" for node in item.findall(".//m:t", NS))
                for item in root.findall("m:si", NS)
            ]

        root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows = root.findall(".//m:sheetData/m:row", NS)
        parsed_rows: list[list[str]] = []
        for row in rows:
            values: dict[int, str] = {}
            for cell in row.findall("m:c", NS):
                index = col_index(cell.attrib["r"])
                cell_type = cell.get("t")
                if cell_type == "inlineStr":
                    value = "".join(
                        node.text or "" for node in cell.findall(".//m:t", NS)
                    )
                else:
                    value_node = cell.find("m:v", NS)
                    value = "" if value_node is None else value_node.text or ""
                    if cell_type == "s" and value:
                        value = shared[int(value)]
                values[index] = value.strip()
            width = max(values, default=-1) + 1
            parsed_rows.append([values.get(i, "") for i in range(width)])

    headers = parsed_rows[0]
    return [
        {
            header: row[index] if index < len(row) else ""
            for index, header in enumerate(headers)
        }
        for row in parsed_rows[1:]
    ]


def parse_date(value: str) -> datetime | None:
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y")
    except (ValueError, AttributeError):
        return None


def material_names(value: str) -> list[str]:
    names = []
    for item in MATERIAL_SPLIT_RE.split(value or ""):
        item = item.strip()
        if not item:
            continue
        name = item.split(" | ", 1)[0]
        name = re.sub(r"\s*-\s*(IMPRESSO|PDF|DIGITAL)\s*$", "", name, flags=re.I)
        names.append(normalize_text(name))
    return names


def valid_phone(value: str) -> bool:
    groups = re.findall(r"\d+", value or "")
    digits = "".join(groups)
    return 10 <= len(digits) <= 13


def record_features(row: dict[str, str], reference_date: datetime) -> dict[str, float | str]:
    last_contact = parse_date(row["Data do Último Contato"])
    days_old = (
        max(0, (reference_date - last_contact).days)
        if last_contact
        else (reference_date - datetime(2008, 1, 1)).days
    )
    materials = material_names(row["Material"])
    phone = row["Telefone"].strip()
    email = row["Email"].strip().lower()
    return {
        "log_dias_desde_contato": math.log1p(days_old),
        "materiais_quantidade": min(len(materials), 20),
        "tem_telefone": float(bool(phone)),
        "telefone_valido": float(valid_phone(phone)),
        "tem_email": float(bool(email)),
        "email_valido": float(bool(EMAIL_RE.match(email))),
        "tem_descricao": float(bool(row["Descrição"].strip())),
        "cidade": normalize_text(row["Cidade"]) or "NAO INFORMADO",
        "bairro": normalize_text(row["Bairro"]) or "NAO INFORMADO",
        "distrito": normalize_text(row["Distrito"]) or "NAO INFORMADO",
        "material": materials,
    }


def stratified_split(y: np.ndarray, test_fraction: float, seed: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    train_parts = []
    test_parts = []
    for label in (0, 1):
        indices = np.flatnonzero(y == label)
        rng.shuffle(indices)
        cut = int(round(len(indices) * test_fraction))
        test_parts.append(indices[:cut])
        train_parts.append(indices[cut:])
    train = np.concatenate(train_parts)
    test = np.concatenate(test_parts)
    rng.shuffle(train)
    rng.shuffle(test)
    return train, test


def top_categories(
    features: list[dict[str, float | str]],
    train_indices: np.ndarray,
    field: str,
    limit: int,
) -> list[str]:
    counts: Counter[str] = Counter()
    for index in train_indices:
        value = features[int(index)][field]
        if isinstance(value, list):
            counts.update(set(value))
        else:
            counts[str(value)] += 1
    return [value for value, _ in counts.most_common(limit)]


def build_matrix(
    features: list[dict[str, float | str]],
    train_indices: np.ndarray,
) -> tuple[np.ndarray, list[str], dict]:
    numeric_fields = [
        "log_dias_desde_contato",
        "materiais_quantidade",
        "tem_telefone",
        "telefone_valido",
        "tem_email",
        "email_valido",
        "tem_descricao",
    ]
    category_limits = {"cidade": 30, "bairro": 50, "distrito": 50, "material": 60}
    categories = {
        field: top_categories(features, train_indices, field, limit)
        for field, limit in category_limits.items()
    }
    category_positions = {
        field: {value: i for i, value in enumerate(values)}
        for field, values in categories.items()
    }

    raw_numeric = np.array(
        [[float(feature[field]) for field in numeric_fields] for feature in features],
        dtype=np.float64,
    )
    means = raw_numeric[train_indices].mean(axis=0)
    stds = raw_numeric[train_indices].std(axis=0)
    stds[stds < 1e-9] = 1.0
    numeric = (raw_numeric - means) / stds

    feature_names = [f"num:{field}" for field in numeric_fields]
    offsets = {}
    width = len(numeric_fields)
    for field, values in categories.items():
        offsets[field] = width
        width += len(values)
        feature_names.extend(f"{field}:{value}" for value in values)

    matrix = np.zeros((len(features), width), dtype=np.float32)
    matrix[:, : len(numeric_fields)] = numeric.astype(np.float32)
    for row_index, feature in enumerate(features):
        for field, positions in category_positions.items():
            values = feature[field]
            if not isinstance(values, list):
                values = [str(values)]
            for value in set(values):
                position = positions.get(value)
                if position is not None:
                    matrix[row_index, offsets[field] + position] = 1.0

    metadata = {
        "numeric_fields": numeric_fields,
        "means": means.tolist(),
        "stds": stds.tolist(),
        "categories": categories,
    }
    return matrix, feature_names, metadata


def sigmoid(values: np.ndarray) -> np.ndarray:
    values = np.clip(values, -30, 30)
    return 1.0 / (1.0 + np.exp(-values))


def train_logistic(
    x: np.ndarray,
    y: np.ndarray,
    epochs: int = 350,
    learning_rate: float = 0.08,
    regularization: float = 0.02,
) -> tuple[np.ndarray, float]:
    weights = np.zeros(x.shape[1], dtype=np.float64)
    bias = 0.0
    positive_weight = len(y) / (2 * max(1, int(y.sum())))
    negative_weight = len(y) / (2 * max(1, int((1 - y).sum())))
    sample_weights = np.where(y == 1, positive_weight, negative_weight)
    denominator = sample_weights.sum()

    for epoch in range(epochs):
        probabilities = sigmoid(x @ weights + bias)
        errors = (probabilities - y) * sample_weights
        gradient = x.T @ errors / denominator + regularization * weights
        bias_gradient = errors.sum() / denominator
        step = learning_rate / math.sqrt(1 + epoch / 80)
        weights -= step * gradient
        bias -= step * bias_gradient
    return weights, bias


def roc_auc(y: np.ndarray, scores: np.ndarray) -> float:
    order = np.argsort(scores)
    ranks = np.empty(len(scores), dtype=float)
    ranks[order] = np.arange(1, len(scores) + 1)
    _, inverse, counts = np.unique(scores, return_inverse=True, return_counts=True)
    for group, count in enumerate(counts):
        if count > 1:
            members = np.flatnonzero(inverse == group)
            ranks[members] = ranks[members].mean()
    positives = y == 1
    n_pos = int(positives.sum())
    n_neg = len(y) - n_pos
    return float((ranks[positives].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def average_precision(y: np.ndarray, scores: np.ndarray) -> float:
    order = np.argsort(-scores)
    sorted_y = y[order]
    cumulative = np.cumsum(sorted_y)
    precision = cumulative / np.arange(1, len(y) + 1)
    return float((precision * sorted_y).sum() / max(1, sorted_y.sum()))


def classification_metrics(y: np.ndarray, scores: np.ndarray, threshold: float) -> dict[str, float | int]:
    predicted = scores >= threshold
    tp = int(((predicted == 1) & (y == 1)).sum())
    fp = int(((predicted == 1) & (y == 0)).sum())
    tn = int(((predicted == 0) & (y == 0)).sum())
    fn = int(((predicted == 0) & (y == 1)).sum())
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    return {
        "threshold": threshold,
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / max(1e-12, precision + recall),
    }


def best_threshold(y: np.ndarray, scores: np.ndarray) -> dict[str, float | int]:
    candidates = np.unique(np.quantile(scores, np.linspace(0.05, 0.95, 181)))
    metrics = [classification_metrics(y, scores, float(value)) for value in candidates]
    return max(metrics, key=lambda item: float(item["f1"]))


def group_comparison(rows: list[dict[str, str]], field: str, limit: int = 8) -> list[tuple[str, int, int, float]]:
    totals: Counter[str] = Counter()
    vips: Counter[str] = Counter()
    for row in rows:
        value = normalize_text(row[field]) or "NAO INFORMADO"
        totals[value] += 1
        if normalize_text(row["Vip"]) == "SIM":
            vips[value] += 1
    result = [
        (value, total, vips[value], vips[value] / total)
        for value, total in totals.items()
        if total >= 30
    ]
    return sorted(result, key=lambda item: (item[3], item[1]), reverse=True)[:limit]


def pct(value: float) -> str:
    return f"{100 * value:.1f}%".replace(".", ",")


def markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "|" + "|".join("---" for _ in headers) + "|",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def write_ranking(
    path: Path,
    rows: list[dict[str, str]],
    similarity_scores: np.ndarray,
    priority_scores: np.ndarray,
    only_district: str | None = None,
) -> int:
    selected = []
    district_filter = normalize_text(only_district or "")
    for index, (row, similarity, priority) in enumerate(
        zip(rows, similarity_scores, priority_scores)
    ):
        if normalize_text(row["Vip"]) == "SIM":
            continue
        if district_filter and normalize_text(row["Distrito"]) != district_filter:
            continue
        selected.append((index, row, float(similarity), float(priority)))
    selected.sort(key=lambda item: item[3], reverse=True)

    headers = [
        "posicao",
        "id",
        "nome",
        "distrito",
        "cidade",
        "bairro",
        "telefone",
        "email",
        "ultimo_contato",
        "vip_atual",
        "score_similaridade_vip",
        "score_prioridade_operacional",
        "faixa_prioridade",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=headers)
        writer.writeheader()
        for position, (_, row, similarity, priority) in enumerate(selected, 1):
            band = (
                "alta"
                if priority >= 0.70
                else "media"
                if priority >= 0.45
                else "baixa"
            )
            writer.writerow(
                {
                    "posicao": position,
                    "id": row["ID"],
                    "nome": f"{row['Aluno']} {row['Sobrenome']}".strip(),
                    "distrito": row["Distrito"],
                    "cidade": row["Cidade"],
                    "bairro": row["Bairro"],
                    "telefone": row["Telefone"],
                    "email": row["Email"],
                    "ultimo_contato": row["Data do Último Contato"],
                    "vip_atual": row["Vip"],
                    "score_similaridade_vip": f"{similarity:.6f}",
                    "score_prioridade_operacional": f"{priority:.6f}",
                    "faixa_prioridade": band,
                }
            )
    return len(selected)


def operational_priority(
    rows: list[dict[str, str]],
    features: list[dict[str, float | str]],
    similarity_scores: np.ndarray,
    reference_date: datetime,
    y: np.ndarray,
) -> np.ndarray:
    """Combina o modelo historico com sinais atuais e acionaveis.

    O percentil de similaridade evita tratar a saida da regressao balanceada
    como probabilidade calibrada. Recencia e contato recebem peso equivalente
    ao componente historico para que VIP antigo nao signifique contato quente.
    """
    non_vip = y == 0
    order = np.argsort(similarity_scores[non_vip])
    percentiles_non_vip = np.empty(int(non_vip.sum()), dtype=np.float64)
    percentiles_non_vip[order] = np.linspace(0.0, 1.0, int(non_vip.sum()))
    similarity_percentile = np.zeros(len(rows), dtype=np.float64)
    similarity_percentile[non_vip] = percentiles_non_vip
    similarity_percentile[~non_vip] = 1.0

    recency = np.zeros(len(rows), dtype=np.float64)
    contactability = np.zeros(len(rows), dtype=np.float64)
    for index, (row, feature) in enumerate(zip(rows, features)):
        date = parse_date(row["Data do Último Contato"])
        days = max(0, (reference_date - date).days) if date else 365 * 20
        recency[index] = math.exp(-days / (365 * 3))
        has_phone = float(feature["tem_telefone"])
        has_email = float(feature["tem_email"])
        phone_ok = float(feature["telefone_valido"])
        email_ok = float(feature["email_valido"])
        contactability[index] = min(
            1.0,
            0.55 * phone_ok
            + 0.30 * email_ok
            + 0.10 * has_phone
            + 0.05 * has_email,
        )
    return 0.40 * similarity_percentile + 0.40 * recency + 0.20 * contactability


def write_alphaville_markdown(
    path: Path,
    rows: list[dict[str, str]],
    similarity_scores: np.ndarray,
    priority_scores: np.ndarray,
) -> None:
    vip_rows = []
    non_vip_rows = []
    for row, similarity, priority in zip(rows, similarity_scores, priority_scores):
        if normalize_text(row["Distrito"]) != "ALPHAVILLE":
            continue
        item = (row, float(similarity), float(priority))
        if normalize_text(row["Vip"]) == "SIM":
            vip_rows.append(item)
        else:
            non_vip_rows.append(item)
    vip_rows.sort(key=lambda item: item[2], reverse=True)
    non_vip_rows.sort(key=lambda item: item[2], reverse=True)

    def contact(row: dict[str, str]) -> str:
        return row["Telefone"].strip() or row["Email"].strip() or "Não informado"

    vip_table = [
        [
            f"{row['Aluno']} {row['Sobrenome']}".strip(),
            contact(row),
            row["Data do Último Contato"],
            f"{priority:.3f}".replace(".", ","),
        ]
        for row, _, priority in vip_rows
    ]
    candidate_table = [
        [
            str(position),
            f"{row['Aluno']} {row['Sobrenome']}".strip(),
            contact(row),
            row["Data do Último Contato"],
            f"{similarity:.3f}".replace(".", ","),
            f"{priority:.3f}".replace(".", ","),
        ]
        for position, (row, similarity, priority) in enumerate(non_vip_rows[:30], 1)
    ]
    content = f"""# Contatos prioritários Alphaville

Fonte: `ListagemCompleta (1).xlsx`. Gerado por `analise_vip_ml.py`.

## Como interpretar

- Os **{len(vip_rows)} VIPs atuais** permanecem em uma fila própria para revisão humana.
- Os NÃO VIPs são ordenados por prioridade operacional: 40% de semelhança com o VIP histórico, 40% de recência e 20% de contactabilidade.
- VIP histórico não é sinônimo de contato quente. O modelo encontrou associação de VIP com registros antigos e muitos materiais.
- A lista completa dos **{len(non_vip_rows)} NÃO VIPs de Alphaville** está em `ranking_Alphaville_ml.csv`.

## VIPs atuais

{markdown_table(["Nome", "Contato", "Último contato", "Prioridade"], vip_table)}

## 30 NÃO VIPs para abordagem

{markdown_table(["#", "Nome", "Contato", "Último contato", "Similaridade VIP", "Prioridade"], candidate_table)}

O score serve para ordenar revisão e contato. Ele não altera automaticamente a classificação VIP.
"""
    path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arquivo", default="ListagemCompleta (1).xlsx")
    parser.add_argument("--saida", default=".")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    source = Path(args.arquivo)
    output = Path(args.saida)
    output.mkdir(parents=True, exist_ok=True)
    rows = read_xlsx(source)
    y = np.array([normalize_text(row["Vip"]) == "SIM" for row in rows], dtype=np.int8)
    dates = [parse_date(row["Data do Último Contato"]) for row in rows]
    reference_date = max(date for date in dates if date is not None)
    features = [record_features(row, reference_date) for row in rows]

    train_indices, test_indices = stratified_split(y, 0.20, args.seed)
    matrix, feature_names, metadata = build_matrix(features, train_indices)
    weights, bias = train_logistic(matrix[train_indices], y[train_indices])
    test_scores = sigmoid(matrix[test_indices] @ weights + bias)
    threshold_metrics = best_threshold(y[test_indices], test_scores)
    auc = roc_auc(y[test_indices], test_scores)
    ap = average_precision(y[test_indices], test_scores)

    # Reajusta o modelo final em todos os registros, preservando o vocabulario
    # definido sem olhar para o conjunto de teste.
    final_weights, final_bias = train_logistic(matrix, y)
    all_scores = sigmoid(matrix @ final_weights + final_bias)
    priority_scores = operational_priority(rows, features, all_scores, reference_date, y)

    ranking_count = write_ranking(
        output / "ranking_nao_vip_ml.csv", rows, all_scores, priority_scores
    )
    alphaville_count = write_ranking(
        output / "ranking_Alphaville_ml.csv",
        rows,
        all_scores,
        priority_scores,
        "Alphaville",
    )
    write_alphaville_markdown(
        output / "contatos_Alphaville_prioritarios.md",
        rows,
        all_scores,
        priority_scores,
    )

    coefficient_order = np.argsort(final_weights)
    negative = [
        (feature_names[i], float(final_weights[i]))
        for i in coefficient_order[:12]
    ]
    positive = [
        (feature_names[i], float(final_weights[i]))
        for i in coefficient_order[-12:][::-1]
    ]

    score_bands = {
        "alta": int(((priority_scores >= 0.70) & (y == 0)).sum()),
        "media": int(
            (
                (priority_scores >= 0.45)
                & (priority_scores < 0.70)
                & (y == 0)
            ).sum()
        ),
        "baixa": int(((priority_scores < 0.45) & (y == 0)).sum()),
    }
    model_data = {
        "source": str(source),
        "records": len(rows),
        "vip_records": int(y.sum()),
        "reference_date": reference_date.strftime("%Y-%m-%d"),
        "seed": args.seed,
        "test_metrics": {
            "roc_auc": auc,
            "average_precision": ap,
            **threshold_metrics,
        },
        "bias": final_bias,
        "features": [
            {"name": name, "weight": float(weight)}
            for name, weight in zip(feature_names, final_weights)
        ],
        "preprocessing": metadata,
    }
    (output / "modelo_vip_ml.json").write_text(
        json.dumps(model_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    city_groups = group_comparison(rows, "Cidade")
    district_groups = group_comparison(rows, "Distrito")
    sex_groups = group_comparison(rows, "Sexo")
    religion_groups = group_comparison(rows, "Religião")

    def group_rows(groups: list[tuple[str, int, int, float]]) -> list[list[str]]:
        return [
            [name.title(), f"{total:,}".replace(",", "."), str(vips), pct(rate)]
            for name, total, vips, rate in groups
        ]

    def coefficient_rows(values: list[tuple[str, float]]) -> list[list[str]]:
        return [[name, f"{weight:+.3f}"] for name, weight in values]

    prevalence = float(y.mean())
    report = f"""# Machine learning do marcador VIP

Fonte: `{source.name}`.

## Resumo executivo

- Registros analisados: **{len(rows):,}**.
- VIP: **{int(y.sum()):,}** ({pct(prevalence)}); NÃO VIP: **{int((1-y).sum()):,}** ({pct(1-prevalence)}).
- O campo VIP é um **rótulo histórico da operação**. A planilha não informa a regra que o criou.
- O modelo mede semelhança com o padrão histórico dos VIPs; não mede valor pessoal, conversão futura ou necessidade pastoral.
- Validação fora da amostra: **ROC AUC {auc:.3f}** e **Average Precision {ap:.3f}**. A prevalência de referência é {prevalence:.3f}.
- Foram gerados rankings para **{ranking_count:,} NÃO VIPs** e **{alphaville_count} NÃO VIPs de Alphaville**.
- O principal achado é que **VIP histórico não significa contato quente**: os VIPs estão associados a mais materiais e registros mais antigos, enquanto telefone disponível aparece com associação negativa.

## Importância de VIP e NÃO VIP

**VIP** deve ser entendido como uma marcação operacional rara: apenas {pct(prevalence)} da base. Ela é útil para separar casos historicamente tratados como especiais, mas não deve substituir revisão humana.

**NÃO VIP** significa apenas ausência dessa marcação. Não significa baixo potencial. O ranking identifica NÃO VIPs parecidos com os VIPs históricos para auditoria e eventual reclassificação.

Como a origem do rótulo não está documentada, o score não altera a coluna `Vip` e não automatiza decisões. Ele ordena a revisão.

O ranking final separa duas medidas:

- `score_similaridade_vip`: padrão aprendido pelo modelo, útil para auditar ou revisar a marcação VIP.
- `score_prioridade_operacional`: combinação de 40% do percentil de similaridade VIP, 40% de recência e 20% de contactabilidade.

## Metodologia

- Divisão estratificada: 80% treino e 20% teste, com `seed={args.seed}`.
- Modelo: regressão logística balanceada, regularizada e implementada com `numpy`.
- Entradas operacionais: recência, quantidade e tipo de materiais, cidade, bairro, distrito, presença/validade de telefone e email e presença de descrição.
- Excluídos do score: nome, sexo, religião, idade, aniversário, endereço completo e o próprio campo VIP.
- O vocabulário de categorias foi definido somente no treino para evitar vazamento na avaliação.

No melhor limiar de F1 no teste ({float(threshold_metrics['threshold']):.3f}), a precisão foi **{pct(float(threshold_metrics['precision']))}**, a cobertura dos VIPs foi **{pct(float(threshold_metrics['recall']))}** e o F1 foi **{float(threshold_metrics['f1']):.3f}**.

## Padrões descritivos

### Cidades com maior taxa VIP (mínimo 30 registros)

{markdown_table(["Cidade", "Total", "VIPs", "Taxa VIP"], group_rows(city_groups))}

### Distritos com maior taxa VIP (mínimo 30 registros)

{markdown_table(["Distrito", "Total", "VIPs", "Taxa VIP"], group_rows(district_groups))}

Sexo e religião são mostrados apenas para diagnóstico de possíveis vieses históricos e **não entram no modelo**.

### Sexo

{markdown_table(["Sexo", "Total", "VIPs", "Taxa VIP"], group_rows(sex_groups))}

### Religião com maior taxa VIP (mínimo 30 registros)

{markdown_table(["Religião", "Total", "VIPs", "Taxa VIP"], group_rows(religion_groups))}

## Fatores do modelo

Coeficientes positivos aumentam a semelhança com VIPs históricos; negativos reduzem. Eles representam associação, não causalidade.

### Associações positivas mais fortes

{markdown_table(["Fator", "Coeficiente"], coefficient_rows(positive))}

### Associações negativas mais fortes

{markdown_table(["Fator", "Coeficiente"], coefficient_rows(negative))}

## Faixas de prioridade operacional dos NÃO VIPs

| Faixa | Regra | Quantidade |
|---|---|---:|
| Alta | score >= 0,70 | {score_bands['alta']:,} |
| Média | 0,45 <= score < 0,70 | {score_bands['media']:,} |
| Baixa | score < 0,45 | {score_bands['baixa']:,} |

As faixas são filas operacionais, não probabilidades calibradas de conversão. A fórmula impede que um registro antigo seja priorizado apenas por se parecer com o VIP histórico.

## Arquivos gerados

- `ranking_nao_vip_ml.csv`: todos os NÃO VIPs ordenados pelo score.
- `ranking_Alphaville_ml.csv`: recorte do distrito Alphaville.
- `modelo_vip_ml.json`: métricas, pré-processamento e coeficientes para auditoria.

## Limitações

1. A definição original de VIP não está na planilha; o modelo aprende decisões passadas, inclusive eventuais inconsistências.
2. Solicitação e último contato parecem frequentemente iguais, então recência pode refletir entrada na base, não acompanhamento real.
3. Não há resultado de campanha, resposta, conversão ou engajamento posterior. Com esses desfechos, seria possível treinar um modelo de propensão mais útil.
4. O score deve apoiar priorização e limpeza da base, nunca decisões automáticas sobre pessoas.
"""
    report = report.replace(f"{len(rows):,}", f"{len(rows):,}".replace(",", "."))
    report = report.replace(f"{int(y.sum()):,}", f"{int(y.sum()):,}".replace(",", "."))
    report = report.replace(f"{int((1-y).sum()):,}", f"{int((1-y).sum()):,}".replace(",", "."))
    report = report.replace(f"{ranking_count:,}", f"{ranking_count:,}".replace(",", "."))
    for value in score_bands.values():
        report = report.replace(f"{value:,}", f"{value:,}".replace(",", "."))
    (output / "relatorio_machine_learning_vip.md").write_text(report, encoding="utf-8")

    print(f"Registros: {len(rows)} | VIPs: {int(y.sum())}")
    print(f"Teste ROC AUC: {auc:.4f} | Average Precision: {ap:.4f}")
    print(
        "Melhor F1: "
        f"{float(threshold_metrics['f1']):.4f} "
        f"(precisao={float(threshold_metrics['precision']):.4f}, "
        f"recall={float(threshold_metrics['recall']):.4f})"
    )
    print(f"Ranking geral: {ranking_count} | Alphaville: {alphaville_count}")


if __name__ == "__main__":
    main()
