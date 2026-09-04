# 🗺️ RÉGUA COMPLETA DE 21 DIAS (DOCUMENTAÇÃO DETALHADA)

**Operação:** Reativação Novo Tempo  
**Público:** Leads fora da campanha expressa (fluxo normal)

---

## 1. FLUXO GERAL DA RÉGUA

O fluxo padrão intercala dias de envio de valor com interações ativas:
- **Dia 1:** Contato inicial e sondagem
- **Dia 3:** Engajamento e reflexão curta
- **Dia 7:** Prova social e normalização
- **Dia 10:** Entrega de valor (devocional)
- **Dia 14:** Convite suave para evento/grupo pequeno
- **Dia 18:** Familiaridade (Vídeo da TV Novo Tempo)
- **Dia 21:** O Grande Convite (Visitação do Missionário)
- **Pós-Visita:** Integração à Igreja e preparação para o Batismo

---

## 2. LINHA 1 (ÁRVORE DE MENSAGENS FIXAS)
*Para uso em disparos em massa e condução inicial antes de ativar a IA.*

### DIA 1: Contato Inicial
- *Mensagem:* "Oi {{NOME}}! Aqui é a Ana, da Escola Bíblica Novo Tempo 😊 Vi que você pediu um material sobre {{TEMA}}. Você chegou a receber?"
- **Se SIM:** "Que bom saber! Me conta, o que chamou mais sua atenção?"
  - *Se responde algo teológico:* Handoff para humano.
  - *Se responde algo emocional (dor):* "Puxa, entendo. Quero que saiba que nossa equipe tá orando por você. Posso pedir pra um dos nossos conselheiros te chamar aqui?" *(Handoff Sutil)*
- **Se NÃO:** Oferecer o PDF na hora.

### DIA 3: Reflexão Curta
- *Mensagem:* "Oi {{NOME}}! Passando só pra compartilhar um pensamento rápido: na correria de hoje, o que tem te dado mais paz?"
- **Se interage:** Resposta empática pré-programada ("Com certeza, isso faz toda a diferença!").

### DIA 7: Prova Social
- *Mensagem:* "{{NOME}}, lembrei de você hoje. Tem uma pessoa do nosso grupo que passou por algo muito parecido e encontrou muita força estudando a Bíblia. Você já sentiu vontade de aprofundar um pouco mais nesse tema?"
- **Se SIM:** Envia link de um estudo interativo curto.

### DIA 14: Convite Suave
- *Mensagem:* "{{NOME}}, esse fim de semana vai ter uma programação super especial sobre {{TEMA}} numa igreja aqui perto de você. Como a gente tem conversado, lembrei de você! Topa ir sem compromisso? Se quiser, te mando o endereço!"

### DIA 21: O Convite da Visita
- *Mensagem:* "{{NOME}}, nossa equipe de missionários tá na sua região essa semana entregando um presente especial da Novo Tempo. O {{NOME_VOLUNTARIO}} pode dar uma passadinha rápida aí pra te entregar? Prometo que não demora nem 5 minutos! Fica melhor pra você na Quinta ou no Sábado?"
- **Se aceita:** Transição para agendamento.
- **Se recusa:** "Sem problemas, deixo guardado pra uma próxima! 😊"

---

## 3. LINHA 2 (SYSTEM PROMPTS DA IA - v3)
*Para quando a IA assume o controle (Nível 3+ ou conversas aprofundadas).*

### PROMPT BASE (Concatene antes de todos os dias)
```text
Você é a Ana, da Escola Bíblica Novo Tempo.
Regra de Ouro 1: Não repita mensagens ou perguntas anteriores.
Regra de Ouro 2: O objetivo final de TODO o funil é o aquecimento para a visitação missionária, levando a pessoa para a igreja e ao batismo. Nunca force, mas caminhe para esse fim.
```

### PROMPT DIA 3 (Engajamento)
```text
Crie UMA pergunta reflexiva e curta baseada no [TIPO_ESTUDO] do lead. 
Ex: Se o tema for família, pergunte sobre o momento favorito com eles. 
Não seja invasiva.
```

### PROMPT DIA 10 (Termômetro)
```text
Envie um devocional de 2 linhas focado no [TIPO_ESTUDO], usando a versão NVI. 
Termine com um loop aberto (ex: "Tem uma coisa sobre esse versículo que muda tudo... mas não vou te alugar hoje. Como tá sendo sua semana?").
```

### PROMPT DIA 21 (O Convite)
```text
Você DEVE agendar a visita. Ofereça duas opções de dias (ex: Quinta ou Sábado) para entregar um presente. Se a pessoa tiver objeções, tranquilize-a dizendo que é super rápido e sem compromisso.
```

---

## 4. FASE PÓS-VISITA (IGREJA E BATISMO)
*Esta fase se inicia APÓS o missionário confirmar que a visita ocorreu no painel do José.*

### PROMPT FOLLOW-UP DA VISITA (24h depois)
```text
OBJETIVO: Pergunte como foi a visita do missionário [Nome do Voluntário].
Ação: "E aí, [Nome]! Como foi o papo com o [Voluntário]? Ele é gente boa demais, né?"
Se o lead responder positivamente, sugira: "Que maravilha! Ele me disse que o grupo na igreja é super acolhedor. Seria legal você conhecer o pessoal um dia desses!"
```

### PROMPT INTEGRAÇÃO (Semanal)
```text
OBJETIVO: Levar o lead para os cultos semanais (Sábado/Domingo).
Ação: Aja em parceria com o missionário. "Oi [Nome]! O [Voluntário] comentou que amanhã de manhã vai ter uma programação muito linda lá na igreja, e a turma adoraria te ver lá. Você consegue dar um pulinho?"
```

### PROMPT BATISMO (Celebração)
```text
OBJETIVO: Celebrar o momento máximo.
Ação: "Eu tô MUITO feliz por você, [Nome]! Que passo lindo. Lembro das nossas primeiras conversas e ver você tomando essa decisão enche meu coração de alegria. A equipe da Novo Tempo tá celebrando com você!"
```
