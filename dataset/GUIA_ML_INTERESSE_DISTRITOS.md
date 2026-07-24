# Piloto de machine learning por distrito

Este projeto usa Alphaville como piloto para aprender um **resultado real de
contato**, em vez de apenas reproduzir o marcador historico `Vip`.

## Arquivos

- `ml_interesse_distritos.py`: extracao, validacao, treino e previsao.
- `dados_interesse_Alphaville.json`: 151 contatos e campos de acompanhamento.
- `modelo_interesse_Alphaville.joblib`: criado somente depois do treinamento.
- `metricas_interesse_Alphaville.json`: avaliacao por validacao cruzada.

## 1. Registrar os resultados

No JSON, preencha o bloco `resultados` de cada contato. Use `true`, `false` ou
`null`. Exemplo:

```json
"resultados": {
  "tentativa_contato": true,
  "data_tentativa": "2026-06-14",
  "canal": "telefone",
  "respondeu": true,
  "demonstrou_interesse": true,
  "aceitou_visita": false,
  "participou": null,
  "observacao": "Solicitou novo contato."
}
```

`null` significa que o resultado ainda nao foi observado. Nao transforme falta
de resposta registrada em `false`.

Para conferir o andamento:

```powershell
python ml_interesse_distritos.py status --alvo respondeu
```

## 2. Treinar

O comando exige pelo menos 30 registros rotulados, incluindo 5 positivos e 5
negativos:

```powershell
python ml_interesse_distritos.py treinar --alvo respondeu
```

Tambem podem ser usados os alvos `demonstrou_interesse`, `aceitou_visita` ou
`participou`.

O modelo usa regressao logistica balanceada e validacao cruzada estratificada.
Nome, telefone, email, sexo, religiao, idade, endereco, VIP, distrito, cidade e
bairro nao entram como atributos. Cidade e bairro de Alphaville seriam sinais
locais e pouco transferiveis para outros distritos.

## 3. Testar em outro distrito

Depois de treinar:

```powershell
python ml_interesse_distritos.py prever `
  --distrito "Pinheiros" `
  --saida previsoes_interesse_Pinheiros.csv
```

Essa aplicacao em outro distrito e um teste externo. As previsoes devem ordenar
uma fila de contato, nao produzir decisoes automaticas.

## 4. Atualizar a planilha

Para recriar os atributos sem apagar os resultados ja preenchidos:

```powershell
python ml_interesse_distritos.py preparar
```

O script preserva o bloco `resultados` pelo campo `id`.

## Criterio de sucesso

Um modelo de Alphaville so deve ser adotado em outros distritos quando:

1. superar uma fila aleatoria ou uma regra simples de recencia;
2. manter desempenho aceitavel em um distrito que nao participou do treino;
3. apresentar resultados reais suficientes, e nao apenas uma metrica alta numa
   amostra pequena.
