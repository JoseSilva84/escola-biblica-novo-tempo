# Machine learning do marcador VIP

Fonte: `ListagemCompleta (1).xlsx`.

## Resumo executivo

- Registros analisados: **45.964**.
- VIP: **4.009** (8,7%); NÃO VIP: **41.955** (91,3%).
- O campo VIP é um **rótulo histórico da operação**. A planilha não informa a regra que o criou.
- O modelo mede semelhança com o padrão histórico dos VIPs; não mede valor pessoal, conversão futura ou necessidade pastoral.
- Validação fora da amostra: **ROC AUC 0.900** e **Average Precision 0.469**. A prevalência de referência é 0.087.
- Foram gerados rankings para **41.955 NÃO VIPs** e **138 NÃO VIPs de Alphaville**.
- O principal achado é que **VIP histórico não significa contato quente**: os VIPs estão associados a mais materiais e registros mais antigos, enquanto telefone disponível aparece com associação negativa.

## Importância de VIP e NÃO VIP

**VIP** deve ser entendido como uma marcação operacional rara: apenas 8,7% da base. Ela é útil para separar casos historicamente tratados como especiais, mas não deve substituir revisão humana.

**NÃO VIP** significa apenas ausência dessa marcação. Não significa baixo potencial. O ranking identifica NÃO VIPs parecidos com os VIPs históricos para auditoria e eventual reclassificação.

Como a origem do rótulo não está documentada, o score não altera a coluna `Vip` e não automatiza decisões. Ele ordena a revisão.

O ranking final separa duas medidas:

- `score_similaridade_vip`: padrão aprendido pelo modelo, útil para auditar ou revisar a marcação VIP.
- `score_prioridade_operacional`: combinação de 40% do percentil de similaridade VIP, 40% de recência e 20% de contactabilidade.

## Metodologia

- Divisão estratificada: 80% treino e 20% teste, com `seed=42`.
- Modelo: regressão logística balanceada, regularizada e implementada com `numpy`.
- Entradas operacionais: recência, quantidade e tipo de materiais, cidade, bairro, distrito, presença/validade de telefone e email e presença de descrição.
- Excluídos do score: nome, sexo, religião, idade, aniversário, endereço completo e o próprio campo VIP.
- O vocabulário de categorias foi definido somente no treino para evitar vazamento na avaliação.

No melhor limiar de F1 no teste (0.742), a precisão foi **48,1%**, a cobertura dos VIPs foi **58,0%** e o F1 foi **0.526**.

## Padrões descritivos

### Cidades com maior taxa VIP (mínimo 30 registros)

| Cidade | Total | VIPs | Taxa VIP |
|---|---|---|---|
| Sao Roque | 249 | 27 | 10,8% |
| Tapirai | 47 | 5 | 10,6% |
| Pilar Do Sul | 203 | 20 | 9,9% |
| Pirapora Do Bom Jesus | 175 | 17 | 9,7% |
| Osasco | 3.227 | 309 | 9,6% |
| Itapevi | 2.630 | 247 | 9,4% |
| Cotia | 1.930 | 176 | 9,1% |
| Sao Paulo | 23.346 | 2047 | 8,8% |

### Distritos com maior taxa VIP (mínimo 30 registros)

| Distrito | Total | VIPs | Taxa VIP |
|---|---|---|---|
| Pinheiros | 914 | 108 | 11,8% |
| Vargem Grande | 43 | 5 | 11,6% |
| Clinica | 130 | 15 | 11,5% |
| Jardim Da Graca | 241 | 27 | 11,2% |
| Jardim Colonial | 410 | 45 | 11,0% |
| Brooklin | 806 | 88 | 10,9% |
| Vila Rodrigues | 811 | 86 | 10,6% |
| Jardim Bela Vista | 400 | 42 | 10,5% |

Sexo e religião são mostrados apenas para diagnóstico de possíveis vieses históricos e **não entram no modelo**.

### Sexo

| Sexo | Total | VIPs | Taxa VIP |
|---|---|---|---|
| Masculino | 17.952 | 1845 | 10,3% |
| Feminino | 21.020 | 2045 | 9,7% |
| Nao Informado | 6.992 | 119 | 1,7% |

### Religião com maior taxa VIP (mínimo 30 registros)

| Religião | Total | VIPs | Taxa VIP |
|---|---|---|---|
| Budista | 40 | 6 | 15,0% |
| Mundial Do Poder De Deus | 226 | 32 | 14,2% |
| Brasil Para Cristo | 185 | 26 | 14,1% |
| Metodista | 170 | 22 | 12,9% |
| Pentecostal | 1.643 | 201 | 12,2% |
| Evangelho Quadrangular | 651 | 79 | 12,1% |
| Deus E Amor | 367 | 42 | 11,4% |
| Evangelica | 8.055 | 894 | 11,1% |

## Fatores do modelo

Coeficientes positivos aumentam a semelhança com VIPs históricos; negativos reduzem. Eles representam associação, não causalidade.

### Associações positivas mais fortes

| Fator | Coeficiente |
|---|---|
| num:materiais_quantidade | +0.939 |
| num:tem_descricao | +0.307 |
| num:log_dias_desde_contato | +0.286 |
| material:INTIMIDADE COM DEUS - ON-LINE (EM ANDAMENTO) | +0.262 |
| material:APOCALIPSE - O FIM REVELADO - ON-LINE (EM ANDAMENTO) | +0.241 |
| num:tem_email | +0.221 |
| material:SENTIMENTOS E EMOCOES - ON-LINE (EM ANDAMENTO) | +0.176 |
| material:DESCOBERTAS BIBLICAS - ON-LINE (EM ANDAMENTO) | +0.151 |
| material:BIBLIA FACIL - ON-LINE (EM ANDAMENTO) | +0.132 |
| num:email_valido | +0.123 |
| material:APOCALIPSE | +0.105 |
| material:BIBLIA FACIL | +0.104 |

### Associações negativas mais fortes

| Fator | Coeficiente |
|---|---|
| num:tem_telefone | -0.377 |
| num:telefone_valido | -0.236 |
| material:EVIDENCIAS | -0.214 |
| cidade:SAO PAULO | -0.190 |
| material:DEUS ME OUVE? | -0.092 |
| material:MENTE FELIZ | -0.071 |
| cidade:CARAPICUIBA | -0.064 |
| material:REVISTA VIVA COM ESPERANCA | -0.063 |
| material:SUPER LUPA- A VOLTA AO MUNDO EM 7 DIAS | -0.056 |
| material:PAIS PREPARADOS, FILHOS DE CARATER | -0.051 |
| material:SENTIMENTOS A CIENCIA DO EXISTIR | -0.048 |
| material:DESCOBRINDO TESOUROS - RODRIGO SILVA | -0.047 |

## Faixas de prioridade operacional dos NÃO VIPs

| Faixa | Regra | Quantidade |
|---|---|---:|
| Alta | score >= 0,70 | 2.042 |
| Média | 0,45 <= score < 0,70 | 17.983 |
| Baixa | score < 0,45 | 21.930 |

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
