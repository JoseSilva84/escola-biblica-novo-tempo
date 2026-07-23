# 🔄 FUNIL COMPLETO 7FLOW — Manual de Operações

> **Este documento descreve TODO o processo da 7Flow**, desde o momento em que recebemos os dados brutos até o batismo. Cada etapa é explicada em duas camadas: o que o **lead** (a pessoa que estamos alcançando) vive, e o que **cada membro da equipe** faz nos bastidores.
>
> **Público-alvo deste documento:** Todos — Eduardo, José, Jaime, James, Graciliano, e futuros voluntários.

---

## 📊 VISÃO GERAL DO FUNIL

O funil da 7Flow tem **7 etapas sequenciais** e **2 caminhos alternativos** para leads que param de responder ou desistem.

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   📥 ETAPA 1: RECEPÇÃO E LIMPEZA DE DADOS                          ║
║   (José recebe a base bruta e trata)                                ║
║                          ↓                                          ║
║   💬 ETAPA 2: PRIMEIRO CONTATO INTELIGENTE                          ║
║   (A IA envia a primeira mensagem)                                  ║
║              ↓                      ↘ Não respondeu?                ║
║   🔥 ETAPA 3: NUTRIÇÃO 21 DIAS         → NURTURING MENSAL          ║
║   (7 mensagens em 21 dias)              (1 msg/mês por 3 meses)    ║
║              ↓                      ↘ 3 meses sem resposta?        ║
║   🏠 ETAPA 4: CONVITE PARA VISITA       → CONGELA                  ║
║   (Voluntário faz a visita)                                         ║
║              ↓                      ↘ Recusou/Desistiu?            ║
║   👀 ETAPA 5: ACOMPANHAMENTO            → REENTRADA                ║
║   (IA + Voluntário fazem follow-up)     (Nova abordagem em evento)  ║
║              ↓                                                      ║
║   🤝 ETAPA 6: INTEGRAÇÃO NA COMUNIDADE                             ║
║   (Pessoa participa de grupo/igreja)                                ║
║              ↓                                                      ║
║   🎉 ETAPA 7: BATISMO                                              ║
║   (Decisão da pessoa + saída do funil)                              ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## ETAPA 1 — RECEPÇÃO E LIMPEZA DE DADOS
*"Transformar dados brutos em leads priorizados"*

### 👤 O que o lead vive
Ele **não sabe que a gente existe** ainda. Ele se inscreveu na Escola Bíblica Novo Tempo semanas, meses ou até anos atrás. Os dados dele (nome, telefone, cidade) estão numa planilha enorme junto com milhares de outros.

### ⚙️ O que a equipe faz

| Quem | O que faz | Exemplo real |
|------|-----------|--------------|
| **José** | Importa a base bruta (CSV/Excel) da EBNT para o sistema | Baixa a planilha com 46.276 linhas, importa no banco de dados |
| **José** | Remove duplicatas e valida telefones | Roda um script que verifica se o número do WhatsApp está ativo |
| **José** | Aplica o sistema de SCORE (pontuação) | Cada lead recebe uma nota de 0-100 baseada em: recência da inscrição, região, se já respondeu antes |
| **Eduardo + Campo** | Define quais leads são prioridade | Em reunião com o campo atendido (ex: Campo 25), decidem juntos: "Vamos começar pelos leads de São Paulo que se inscreveram nos últimos 6 meses" |

### 📊 Métricas desta etapa
- % de dados válidos (telefone ativo): Meta > 60%
- Quantidade de leads priorizados para o primeiro lote

### 🔀 Caminhos alternativos
- **Telefone inválido →** Marcado como "inválido" e removido da fila ativa
- **Lead duplicado →** Mesclado (mantém o registro mais recente)

---

## ETAPA 2 — PRIMEIRO CONTATO INTELIGENTE
*"Fazer uma pessoa que te ignora responder sua mensagem"*

### 👤 O que o lead vive
Ele está no WhatsApp dele, vivendo a vida normal. De repente, recebe uma mensagem de um número desconhecido. Essa mensagem **NÃO** parece spam. É algo curioso, personalizado, que faz ele pensar: "ué, o que será isso?". Ele responde.

### ⚙️ O que a equipe faz

| Quem | O que faz | Exemplo real |
|------|-----------|--------------|
| **Eduardo** | Escreve 3 variações diferentes da primeira mensagem | Ver quadro abaixo ⬇️ |
| **José** | Programa o envio das 3 versões, cada uma para 150-170 leads | Configura: Versão A → 170 leads, Versão B → 170 leads, Versão C → 160 leads |
| **IA (Ana)** | Envia as mensagens e responde quem interagir | Usa o tom acolhedor definido nas diretrizes |
| **James** | Monitora o dashboard em tempo real | Verifica se os envios estão funcionando, se não houve bloqueios |

#### 📝 O que é o Teste A/B/C (Explicação simples)

Imagine que você quer descobrir qual sabor de bolo as pessoas preferem numa festa. Você faz 3 bolos diferentes e serve cada um para um grupo. O bolo que as pessoas mais comerem é o vencedor.

O Teste A/B/C é a **mesma coisa com mensagens**:
- Você escreve **3 mensagens diferentes** (cada uma com uma estratégia diferente)
- O José programa cada versão para ir para um grupo de ~170 leads
- Depois de 48 horas, olhamos: **qual das 3 teve mais respostas?**
- A vencedora vira a mensagem oficial para os outros milhares de leads

**Exemplo prático — As 3 versões que Eduardo pode escrever:**

| Versão | Estratégia | Exemplo de Mensagem |
|--------|-----------|---------------------|
| **A — Curiosidade** | Loop aberto (gera dúvida) | *"Oi [Nome]! Achei aqui um material com o seu nome que estava separado pra você. Posso confirmar uma coisa antes de te enviar?"* |
| **B — Pertencimento** | Faz sentir parte de algo | *"[Nome], você sabia que é uma das 200 pessoas de [Cidade] que pediu esse conteúdo? Tem gente do seu bairro estudando junto. Quer que eu te conte mais?"* |
| **C — Micro-compromisso** | Pedido tão pequeno que é difícil recusar | *"Oi [Nome]! Posso te mandar um áudio de 30 segundos sobre algo que achei com o seu nome aqui? Só isso, prometo que é rapidinho!"* |

> **💡 Dica para o Eduardo:** Você não precisa ser um copywriter profissional. Basta pensar: "se EU recebesse essa mensagem de um número desconhecido, eu responderia?" Se a resposta for sim, a mensagem é boa. Escreva como você falaria no WhatsApp com um amigo — não como um robô.

### 📊 Métricas desta etapa
- Taxa de entrega: Meta > 90% (as mensagens chegaram)
- Taxa de resposta: Meta > 15% (das 500 enviadas, pelo menos 75 responderam)
- Versão vencedora do teste A/B/C

### 🔀 Caminhos alternativos
- **✅ Respondeu →** Avança para Etapa 3 (Nutrição)
- **❌ Não respondeu em 48h →** IA envia uma 2ª mensagem com abordagem diferente
- **❌ Não respondeu na 2ª →** Vai para o **Nurturing Mensal** (1 mensagem por mês, abordagem nova. Se 3 meses sem resposta → Congela)
- **🚫 Bloqueou →** Removido da base (respeito total)

---

## ETAPA 3 — NUTRIÇÃO / AQUECIMENTO (RÉGUA DE 21 DIAS)
*"Transformar uma pessoa curiosa em alguém que quer conhecer mais"*

### 👤 O que o lead vive
Ele respondeu a primeira mensagem. Agora, ao longo de 21 dias, ele recebe **7 interações** espaçadas que trazem valor real: uma reflexão, um testemunho, um devocional, um vídeo. Ele não se sente pressionado — se sente **cuidado**. No final dos 21 dias, quando vem o convite, ele pensa: "faz sentido, quero ir".

### ⚙️ O que a equipe faz

| Quem | O que faz | Exemplo real |
|------|-----------|--------------|
| **Eduardo + Pr. Jaime** | Definem juntos a lógica emocional de cada mensagem | Eduardo traz a estratégia de marketing, Jaime valida o aspecto psicológico/comportamental (os vieses cognitivos) |
| **José** | Programa os triggers automáticos (dia 1, 3, 7, 10, 14, 18, 21) | Configura no sistema: "quando lead entrar na Etapa 3, disparar prompt do Dia 1. Esperar 2 dias. Disparar prompt do Dia 3..." |
| **IA (Ana)** | Gera e envia as mensagens seguindo as diretrizes de cada dia | A IA sabe que no Dia 7 deve contar um testemunho, no Dia 10 deve fazer uma pergunta aberta, etc. |
| **James** | Monitora diariamente quais leads estão respondendo e quais esfriaram | Verifica no dashboard: "Lead João respondeu no Dia 3 mas não reagiu ao Dia 7 — precisa de atenção" |

#### 📝 O que Eduardo + Jaime fazem JUNTOS (exemplo real):

Não se preocupe em "criar vieses cognitivos" sozinho. Na prática, funciona assim:

**Reunião de 30 minutos entre Eduardo e Jaime (1 vez):**
1. Eduardo mostra a tabela dos 7 dias e diz: *"Jaime, no Dia 7 eu quero que a IA conte uma história de alguém que estudou a Bíblia e encontrou paz. Que tipo de história mais funciona com as pessoas?"*
2. Jaime responde com a visão de psicólogo: *"Histórias de superação de ansiedade funcionam muito. O cérebro cria identificação quando a pessoa ouve alguém parecido com ela."*
3. Eduardo traduz isso para uma instrução clara para a IA: *"Conte uma história curta de uma mulher de 30-40 anos que estava ansiosa e encontrou paz estudando a Bíblia."*

Pronto. Isso é "definir os vieses cognitivos". Não precisa de diploma em psicologia — precisa de uma conversa entre os dois.

### A Régua de 7 Interações

| Dia | O que a IA faz | Por que funciona | Quem define |
|-----|----------------|------------------|-------------|
| **1** | Primeiro contato (já feito na Etapa 2) | A primeira impressão define tudo | Eduardo |
| **3** | Manda uma reflexão e faz uma pergunta pessoal | Quando a pessoa investe tempo respondendo, cria apego | Eduardo + Jaime |
| **7** | Compartilha um testemunho de alguém parecido | "Se ela conseguiu, eu também consigo" | Eduardo + Jaime |
| **10** | Devocional curto + pergunta: "como tá sua semana?" | Jornada incompleta gera vontade de completar | Eduardo + Jaime |
| **14** | Menciona um evento/grupo perto da pessoa | Perder o progresso dói — a pessoa não quer desperdiçar | Eduardo |
| **18** | Envia um vídeo curto (Novo Tempo / YouTube) | Contato frequente constrói confiança | Eduardo |
| **21** | Convite direto para visita ou ida à igreja | Todo valor acumulado torna o convite natural | Eduardo |

### 📊 Métricas desta etapa
- Taxa de aquecimento: Meta > 40% (dos que responderam na Etapa 2, 40% continuam engajados)
- Engajamento médio (quantas das 7 interações a pessoa respondeu)

### 🔀 Caminhos alternativos
- **✅ Completou a régua e engajou →** Avança para Etapa 4
- **⏸️ Respondeu no início mas esfriou →** IA tenta reengajar com uma pergunta diferente
- **❌ Parou de responder →** Nurturing Mensal (mesma lógica da Etapa 2)

---

## ETAPA 4 — CONVITE PARA VISITA
*"Conectar a pessoa com um rosto humano real"*

### 👤 O que o lead vive
Depois de 21 dias conversando com a Ana (IA), o lead aceita o convite para receber uma visita ou ir à igreja. Ele recebe a confirmação: *"O João vai te visitar quinta-feira às 19h. Ele é super gente boa, você vai gostar!"*. Ele se sente seguro porque já tem um relacionamento (mesmo que digital).

### ⚙️ O que a equipe faz

| Quem | O que faz | Exemplo real |
|------|-----------|--------------|
| **IA (Ana)** | Faz o convite no Dia 21 (ou antes, se o lead estiver muito engajado) | "Maria, a gente tá conversando há um tempo e eu sinto que você tá buscando algo. O João, um líder aqui da sua região, tá perto da sua casa nessa semana. Qual dia fica melhor pra ele te dar um oi?" |
| **Sistema** | Quando o lead aceita, notifica automaticamente o voluntário da região | O voluntário recebe no WhatsApp: "🔔 Lead Maria aceitou visita — Região Centro — Preferência: Quinta-feira" |
| **Voluntário** | Recebe o histórico da conversa + script de abordagem (pronto pra usar) | Ver Script do Voluntário abaixo ⬇️ |
| **Jaime** | Coordena institucionalmente com a igreja local | Garante que o pastor da região sabe que vai chegar alguém novo |

#### 📋 SCRIPT PRONTO PARA O VOLUNTÁRIO

```
═══════════════════════════════════════════════════════════
ANTES DA VISITA (5 minutos de preparação):
═══════════════════════════════════════════════════════════

1. Leia o resumo da conversa (o sistema mostra os 3 pontos principais)
   Exemplo: "Maria, 34 anos, mora no Centro. Gosta de falar sobre
   ansiedade e família. Gostou muito do devocional do Dia 10."

2. Leve:
   ☐ Guia de estudo impresso
   ☐ Convite da igreja (com endereço e horário)
   ☐ Seu sorriso

═══════════════════════════════════════════════════════════
DURANTE A VISITA (15-20 minutos, no máximo):
═══════════════════════════════════════════════════════════

INÍCIO (Quebrar o gelo):
- "Oi Maria! Eu sou o João, a Ana me falou sobre você. Ela 
  disse que vocês tiveram umas conversas muito bacanas!"
- "Eu vim só te dar um oi pessoalmente e te entregar esse 
  presente aqui [entrega o material]."

MEIO (Escutar mais do que falar):
- "Me conta um pouco de você! A Ana me disse que você tava 
  buscando mais paz na rotina..."
- Pergunte sobre a FAMÍLIA, o TRABALHO, a ROTINA
- NÃO pregue. NÃO julgue. OUÇA.

FIM (Convite natural):
- "Maria, foi muito bom te conhecer pessoalmente! Olha, no 
  sábado de manhã a gente tem um encontro bem legal na igreja.
  É bem tranquilo, sem pressão. Se você quiser ir, eu posso 
  passar aqui pra irmos juntos. O que acha?"

═══════════════════════════════════════════════════════════
DEPOIS DA VISITA:
═══════════════════════════════════════════════════════════

1. Mande uma mensagem para o lead no mesmo dia:
   "Maria, foi muito bom te conhecer! Tô aqui pra qualquer coisa 😊"

2. Registre no sistema:
   ☐ Visita realizada (data e horário)
   ☐ Como foi? (Receptiva / Fria / Não estava em casa)
   ☐ Aceitou ir à igreja? (Sim / Talvez / Não)
```

### 📊 Métricas desta etapa
- Taxa de aceite de visita: Meta > 20%
- Visitas realizadas vs. agendadas: Meta > 70%

### 🔀 Caminhos alternativos
- **✅ Aceitou visita →** Avança para Etapa 5
- **❌ Recusou mas continua conversando →** Mantém no nurturing, tenta novamente num evento especial (Páscoa, Semana de Oração, etc.)
- **❌ Recusou e esfriou →** Nurturing Mensal

---

## ETAPA 5 — ACOMPANHAMENTO PÓS-VISITA
*"Não deixar a pessoa se sentir abandonada depois do primeiro encontro"*

### 👤 O que o lead vive
Ele recebeu a visita (ou foi à igreja). Nas horas seguintes, recebe uma mensagem carinhosa da Ana perguntando como foi. Durante a semana, recebe convites suaves para o próximo encontro. Ele sente que **alguém se importa com ele** — não é só um número.

### ⚙️ O que a equipe faz

| Quem | O que faz | Exemplo real |
|------|-----------|--------------|
| **IA (Ana)** | 24h após a visita, envia: "E aí, [Nome]! Como foi o encontro com o [Voluntário]? 😊" | Se o lead responder positivamente, reforça. Se responder negativamente, acolhe |
| **IA (Ana)** | 1x por semana envia conteúdo de valor + convite suave | "Esse sábado vai ter uma programação especial sobre [tema que o lead gosta]. Vai ser demais!" |
| **Voluntário** | Mantém contato humano (convida pro almoço, grupo pequeno) | Liga ou manda áudio pessoal: "Maria, sábado tem almoço depois do culto, vem com a gente!" |
| **Eduardo + James** | Monitoram juntos o dashboard | Eduardo vê as tendências gerais ("50% dos visitados voltaram"), James vê os casos individuais ("Maria não respondeu há 5 dias") |

### 📊 Métricas desta etapa
- Taxa de visitação à igreja: Meta > 50% (dos que receberam visita, metade vai à igreja)
- Frequência de retorno (voltou mais de 1 vez?)

### 🔀 Caminhos alternativos
- **✅ Continua engajado →** Avança para Etapa 6
- **❌ Não foi à visita marcada →** Voluntário tenta remarcar + IA tenta um gancho de evento
- **❌ Foi à igreja 1 vez e sumiu →** IA retoma com nova abordagem ("Sentimos sua falta! Aconteceu alguma coisa?")

---

## ETAPA 6 — INTEGRAÇÃO NA COMUNIDADE
*"De visitante a membro. De 'estranho' a 'família'."*

### 👤 O que o lead vive
Ele começa a frequentar a igreja regularmente. Participa de um grupo pequeno, da Escola Sabatina, faz amigos. Ele se sente **parte de algo**. A Ana ainda manda uma mensagem de vez em quando, mas agora o relacionamento principal é com as pessoas reais da igreja.

### ⚙️ O que a equipe faz

| Quem | O que faz | Exemplo real |
|------|-----------|--------------|
| **Voluntário/Pastor** | Insere a pessoa num grupo pequeno, apresenta membros | "Maria, esse é o grupo da Cláudia, elas se reúnem toda quarta. Vai ser ótimo pra você!" |
| **IA (Ana)** | Reduz a frequência para 1 msg/semana de encorajamento | "Oi Maria! Só passando pra te desejar uma semana abençoada 🙏" |
| **Eduardo + James** | Monitoram juntos os indicadores de integração | Eduardo verifica semanalmente no dashboard: "Quantos leads estão na Etapa 6? Quantos estão frequentando regularmente?" |

### 📊 Métricas desta etapa
- Frequência semanal (está indo ao culto?)
- Participação em grupo pequeno (está integrado socialmente?)

### 🔀 Caminhos alternativos
- **✅ Integrado e participando →** Avança para Etapa 7 (quando pronto)
- **❌ Frequência caiu →** Voluntário faz contato pessoal + IA manda mensagem de encorajamento

---

## ETAPA 7 — DECISÃO E BATISMO
*"O momento em que a jornada se completa"*

### 👤 O que o lead vive
Ele está integrado, estudando, participando. Num momento natural (campanha, série de evangelismo, decisão pessoal), ele manifesta a vontade de se batizar. Não foi forçado — foi **guiado com carinho** ao longo de semanas ou meses até chegar aqui por conta própria.

### ⚙️ O que a equipe faz

| Quem | O que faz | Exemplo real |
|------|-----------|--------------|
| **Pastor/Voluntário** | Conduz o estudo bíblico final e prepara para o batismo | Pastor da igreja local acompanha as últimas lições |
| **IA (Ana)** | Envia mensagem de celebração | "Que dia especial, [Nome]! 🎉 Estamos tão felizes por você! Isso é só o começo de uma jornada incrível." |
| **Eduardo** | Registra o case de sucesso (os números) para relatório | "Campo 25: de 500 leads iniciais, 18 batismos em 90 dias = 3.6% de conversão" |
| **José** | Atualiza o status no sistema (concluído) | Lead marcado como "Batizado" → sai do funil ativo |
| **Jaime** | Transfere formalmente para o sistema da igreja local | A partir daqui, o discipulado e crescimento espiritual é responsabilidade da congregação |

### 📊 Métricas desta etapa
- Taxa de batismo: Meta > 3% (da base total inicial)
- Tempo médio de jornada (quantos dias do primeiro contato ao batismo)

### 🎯 SAÍDA DO FUNIL
Após o batismo, a pessoa **sai do nosso funil** e entra no cuidado da igreja local. O nosso trabalho termina aqui. Esse resultado vira o nosso **case de sucesso** para vender o serviço a outros campos.

---

## 🔁 OS CAMINHOS ALTERNATIVOS (RESUMO VISUAL)

Em QUALQUER etapa, se o lead parar de responder ou desistir, ele segue este fluxo:

```
Lead parou de responder
        ↓
┌───────────────────────┐
│  NURTURING MENSAL     │  ← IA envia 1 msg/mês com abordagem DIFERENTE
│  (Máximo 3 meses)     │     Ex: um devocional, um vídeo, um convite de evento
└───────┬───────────────┘
        ↓ Respondeu?
       SIM → Volta pro funil (etapa onde parou)
       NÃO → Depois de 3 meses sem resposta...
        ↓
┌───────────────────────┐
│  CONGELADO            │  ← Lead fica inativo no sistema
│  (Reativação futura)  │     Pode ser reativado em campanhas especiais
└───────────────────────┘
```

**Leads que RECUSARAM ativamente** (disseram "não quero"):
- Respeitamos a decisão
- Não contatamos mais no ciclo normal
- Podem ser reativados SOMENTE em eventos especiais (Páscoa, Semana Santa) com uma mensagem completamente diferente

---

## 👥 MAPA DE RESPONSÁVEIS (QUEM FAZ O QUÊ EM CADA ETAPA)

| Etapa | Eduardo | José | James | Jaime | Voluntário | IA (Ana) |
|-------|---------|------|-------|-------|------------|----------|
| **1. Dados** | Define prioridades com o campo | Limpa e trata a base | — | — | — | — |
| **2. Contato** | Escreve as 3 variações de msg | Programa o envio | Monitora sistema | — | — | Envia e responde |
| **3. Nutrição** | Define lógica com Jaime | Programa os triggers | Monitora diário | Valida a psicologia | — | Executa a régua |
| **4. Visita** | — | Notifica voluntário | — | Coordena institucional | Faz a visita | Faz o convite |
| **5. Acompanhamento** | Monitora tendências | Mantém o sistema | Monitora indivíduos | — | Contato humano | Follow-up automático |
| **6. Integração** | Monitora indicadores | — | Monitora frequência | — | Insere em grupo | Encorajamento semanal |
| **7. Batismo** | Registra o case | Atualiza status | — | Transfere p/ igreja | Acompanha | Celebração |
