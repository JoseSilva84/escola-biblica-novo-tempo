# Análise da planilha `ListagemCompleta (1).xlsx`

## Visão geral

- Total de registros: **45.964**
- Total de colunas: **18**
- Período dos contatos/solicitações: **11/09/2008 a 08/06/2026**
- A base parece concentrar **interessados/alunos**, com dados de contato, endereço, material solicitado, religião, idade, sexo, status VIP e distrito.

## Principais padrões encontrados

### 1. Forte concentração geográfica

A cidade de **São Paulo** concentra pouco mais da metade da base.

| Cidade | Registros | % |
|---|---:|---:|
| SÃO PAULO | 23.346 | 50,8% |
| CARAPICUÍBA | 4.813 | 10,5% |
| BARUERI | 3.896 | 8,5% |
| OSASCO | 3.227 | 7,0% |
| ITAPEVI | 2.630 | 5,7% |
| COTIA | 1.930 | 4,2% |
| SANTANA DE PARNAÍBA | 1.642 | 3,6% |
| JANDIRA | 1.618 | 3,5% |

**Leitura:** a operação é majoritariamente metropolitana, com grande peso em São Paulo e municípios do eixo oeste da Grande São Paulo.

### 2. Distritos mais recorrentes

| Distrito | Registros | % |
|---|---:|---:|
| Carapicuiba | 2.729 | 5,9% |
| Barueri - Central | 2.422 | 5,3% |
| Americanópolis | 2.379 | 5,2% |
| Central Paulistana | 1.931 | 4,2% |
| Jardim Silviania | 1.701 | 3,7% |
| Jandira | 1.572 | 3,4% |
| Itapevi | 1.413 | 3,1% |
| Jardim Helena Maria | 1.405 | 3,1% |

**Padrão:** os distritos seguem a concentração por cidade. Em São Paulo, os maiores focos são Americanópolis, Central Paulistana e Rio Pequeno.

### 3. Perfil religioso predominante

| Religião | Registros | % |
|---|---:|---:|
| Evangélica | 8.055 | 17,5% |
| Assembléia de Deus | 6.767 | 14,7% |
| Cristão | 4.777 | 10,4% |
| Catolicismo | 4.132 | 9,0% |
| Batista | 3.136 | 6,8% |
| Adventista do 7º dia(interessado) | 2.401 | 5,2% |
| Congregação Cristã no Brasil | 1.956 | 4,3% |
| Adventista do 7º dia( Afastado) | 1.648 | 3,6% |

**Leitura:** há forte presença de pessoas com identificação cristã/evangélica. Somando categorias evangélicas e cristãs, a base tem grande afinidade religiosa prévia.

### 4. Sexo e status VIP

| Sexo | Registros | % |
|---|---:|---:|
| Feminino | 21.020 | 45,7% |
| Masculino | 17.952 | 39,1% |
| Não Informado | 6.992 | 15,2% |

| VIP | Registros | % |
|---|---:|---:|
| Não | 41.955 | 91,3% |
| Sim | 4.009 | 8,7% |

**Padrão:** a base tem maioria feminina, mas há uma parcela relevante sem sexo informado. O grupo VIP representa menos de 10% da base.

### 5. Faixa etária predominante

Foram encontrados **42.221 registros com idade válida**, **3.729 sem idade** e **14 com idade inválida**.

| Faixa etária | Registros | % entre idades válidas |
|---|---:|---:|
| 0-17 | 206 | 0,5% |
| 18-29 | 3.801 | 9,0% |
| 30-39 | 9.541 | 22,6% |
| 40-49 | 12.684 | 30,0% |
| 50-59 | 8.295 | 19,6% |
| 60-69 | 4.763 | 11,3% |
| 70+ | 2.931 | 6,9% |

- Idade média válida: **46,8 anos**
- Mediana: **45 anos**
- Faixa mais forte: **40 a 49 anos**

**Padrão:** o público principal está entre **30 e 59 anos**, especialmente entre **40 e 49**.

### 6. Evolução anual das solicitações/últimos contatos

As colunas **Solicitação** e **Data do Último Contato** apresentam a mesma distribuição anual, indicando que, em muitos casos, o último contato pode estar registrado como a própria data de solicitação.

| Ano | Registros | % |
|---|---:|---:|
| 2020 | 2.879 | 6,3% |
| 2021 | 3.048 | 6,6% |
| 2022 | 3.362 | 7,3% |
| 2023 | 4.008 | 8,7% |
| 2024 | 4.204 | 9,1% |
| 2025 | 3.777 | 8,2% |
| 2026 | 2.756 | 6,0% |

**Padrões temporais:**

- Pico recente: **2024**, com 4.204 registros.
- A base tem um bloco antigo relevante: **37,9%** dos registros têm último contato até 2017.
- Registros de 2024 a 2026 somam **23,3%** da base.

### 7. Materiais mais solicitados

Foram identificados **94.878 itens de material**, porque um mesmo registro pode conter mais de um material.

| Material | Solicitações | % dos itens |
|---|---:|---:|
| Evidências - PDF | 6.039 | 6,4% |
| RESPOSTAS- IVAN SARAIVA | 5.893 | 6,2% |
| Evidências | 5.886 | 6,2% |
| CD VERDADES BÍBLICAS (CID MOREIRA) | 4.886 | 5,1% |
| VERDADES PARA O TEMPO DO FIM (EST. BÍBLICO) | 3.692 | 3,9% |
| PRINCÍPIOS | 3.350 | 3,5% |
| APOCALIPSE | 3.085 | 3,3% |
| FIQUE LEVE | 2.883 | 3,0% |
| DANIEL - Profecias de Daniel | 2.452 | 2,6% |
| ENSINOS DE JESUS | 2.124 | 2,2% |

**Padrão:** há forte interesse em materiais bíblicos/doutrinários e proféticos, com destaque para **Evidências**, **Respostas**, **Verdades Bíblicas**, **Apocalipse** e **Daniel**.

### 8. Quantidade de materiais por pessoa

- Registros com 1 material: **26.462**
- Registros com 2 materiais: **10.592**
- Registros com 3 materiais: **3.501**
- Há casos extremos com dezenas de materiais; o maior registro identificado contém **101 materiais**.

**Leitura:** a maioria solicita apenas um material, mas existe um grupo de alta interação que pediu múltiplos conteúdos.

### 9. Qualidade dos dados de contato

#### Email

- Emails vazios: **3.557** registros (**7,7%**)
- Emails preenchidos com formato inválido: **569** registros
- Domínios mais comuns:

| Domínio | Registros | % dos emails válidos |
|---|---:|---:|
| gmail.com | 21.411 | 51,2% |
| hotmail.com | 11.543 | 27,6% |
| yahoo.com.br | 2.512 | 6,0% |
| outlook.com | 1.019 | 2,4% |
| bol.com.br | 799 | 1,9% |

#### Telefone

- Telefones vazios: **3.737** registros (**8,1%**)
- Telefones com quantidade de dígitos fora do padrão esperado: **12.106** entre os preenchidos (**28,7%**)

**Padrão:** o email está relativamente bem preenchido, mas telefone precisa de normalização. Muitos campos parecem conter mais de um número, texto adicional ou formatação inconsistente.

### 10. Campos com maior ausência

| Campo | Vazios | % |
|---|---:|---:|
| Descrição | 41.799 | 90,9% |
| Telefone | 3.737 | 8,1% |
| Idade | 3.729 | 8,1% |
| Data de aniversário | 3.729 | 8,1% |
| Email | 3.557 | 7,7% |
| Religião | 1.512 | 3,3% |

**Leitura:** a maior lacuna é a coluna **Descrição**, que parece ser usada apenas em casos específicos. Contato e idade têm perdas moderadas, mas relevantes para ações segmentadas.

### 11. Duplicidades e inconsistências

- IDs duplicados encontrados: **3**
  - `434204.0`
  - `2070231.0`
  - `2072426.0`
- Linhas duplicadas completas: **3 ocorrências extras**
- Idades inválidas: **14 casos**, incluindo valores negativos e idades acima de 110.

**Padrão:** a base não parece ter duplicidade massiva, mas há inconsistências pontuais que merecem limpeza antes de campanhas ou relatórios oficiais.

## Recomendações práticas

1. **Priorizar higienização de telefone**, pois quase 29% dos telefones preenchidos têm tamanho fora do padrão esperado.
2. **Criar segmentações por cidade/distrito**, começando por São Paulo, Carapicuíba, Barueri e Osasco.
3. **Separar contatos recentes e antigos**:
   - recentes: 2024-2026;
   - intermediários: 2021-2023;
   - antigos: até 2020.
4. **Tratar os 4.009 VIPs como segmento próprio**, principalmente nas cidades com maior concentração.
5. **Revisar idades inválidas e registros sem nascimento**, antes de análises demográficas.
6. **Agrupar materiais equivalentes**, por exemplo `Evidências` e `Evidências - PDF`, para evitar fragmentação dos indicadores.
7. **Validar se "Data do Último Contato" deve ser igual à "Solicitação"**, pois a distribuição idêntica sugere preenchimento automático ou ausência de atualização posterior.

## Conclusão

A base é grande, concentrada geograficamente e com perfil adulto, majoritariamente cristão/evangélico, com maior força entre 30 e 59 anos. O maior potencial analítico está em cruzar **cidade/distrito**, **recência do contato**, **material solicitado** e **status VIP**. Antes de ações operacionais, o ponto mais importante é limpar telefones, normalizar materiais e revisar registros antigos sem contato atualizado.
