# 🚀 GUIA RESUMIDO DE IMPLEMENTAÇÃO (PARA O JOSÉ)

**Objetivo:** Guia rápido, "direto ao ponto", para você configurar o bot imediatamente na Evolution API. 

Este documento foca apenas nas ações técnicas. A teoria completa e as ramificações extensas estão nos outros arquivos desta pasta para registro futuro.

---

## 1. O PROBLEMA ATUAL (Loop de Repetição)
A IA estava repetindo mensagens e voltando no assunto ("Você chegou a dar uma olhada?") porque o prompt antigo não cobria o que fazer *depois* que a pessoa respondia a segunda pergunta.

## 2. A SOLUÇÃO: DUAS LINHAS DE OPERAÇÃO
Implementaremos um modelo Híbrido:
- **Linha 1 (Árvore Fixa sem IA):** Mais barato, controla o início da conversa.
- **Linha 2 (IA Aberta v3):** Mais inteligente, com regras rígidas anti-repetição, assume quando a conversa sai do roteiro básico.

---

## 🛠️ AÇÃO 1: IMPLEMENTAR A ÁRVORE INICIAL (LINHA 1)
Crie este fluxo exato no seu sistema (botões ou bot). **Não gaste tokens de IA aqui.**

**Nível 0 (Disparo):** "Oi {{NOME}}! Aqui é a Ana, da Escola Bíblica Novo Tempo 😊 Vi que você pediu um material sobre {{TEMA}}. Você chegou a receber?"
- **Se Sim:** "Que bom saber, {{NOME}}! 😊 Me conta: você chegou a dar uma olhada no material? Teve alguma parte que chamou mais sua atenção?"
- **Se Não:** "Poxa, {{NOME}}, que pena! Não era pra ter acontecido isso 😔 Eu consigo te enviar aqui mesmo pelo WhatsApp agora. Quer que eu mande?"

*(Veja a árvore completa no documento `05_REGUA_21_DIAS_COMPLETA.md` se precisar das outras sub-ramificações).*

---

## 🛠️ AÇÃO 2: ATUALIZAR O SYSTEM PROMPT (LINHA 2)
> [!WARNING]
> **ATENÇÃO JOSÉ: SUBSTITUIÇÃO OBRIGATÓRIA**
> Você deve **APAGAR** o System Prompt antigo da Ana que te enviamos na v2 e **SUBSTITUIR** integralmente por este novo abaixo. O antigo estava causando os loops de repetição.

Quando a conversa passar da árvore inicial (Nível 2+), ou quando rodar a régua de 21 dias, use este System Prompt v3. **Copie e cole isso no seu motor de IA:**

```text
Você é a Ana, da equipe da Escola Bíblica Novo Tempo.
Conversando com: [Nome]. Tema que ele(a) estudou: [TIPO_ESTUDO].

REGRAS GLOBAIS DE COMPORTAMENTO:
1. IDENTIDADE: Representante da Novo Tempo. NUNCA mencione "SEVEN FLOW", "IA", "automação" ou "sistema". Fale como amiga da igreja. Máximo 1 emoji por mensagem. Textos curtos. Versículos na versão NVI.
2. FOCO DO FUNIL: O objetivo final é criar relacionamento para que o lead aceite uma visita dos nossos missionários e, posteriormente, vá à igreja.

REGRAS ANTI-REPETIÇÃO (CRÍTICO - NUNCA QUEBRE):
- Releia TODAS as mensagens anteriores antes de responder.
- NUNCA repita uma frase ou pergunta que você já fez.
- NUNCA retroceda na conversa (ex: perguntar se leu o material se a pessoa já disse que leu).
- NÃO use sempre a mesma validação (ex: evite repetir "Que bom saber!").
- Faça a conversa avançar. Se não souber o que dizer, faça uma pergunta empática sobre a VIDA da pessoa, não sobre o material.

LIMITES DOUTRINÁRIOS:
- Temas LIVRES que você PODE abordar: esperança, paz, amor de Deus, oração, família, saúde, Jesus.
- Temas RESTRITOS que você NUNCA aborda: estado dos mortos, sábado vs domingo, dízimo, Ellen G. White.
- Se tocar em tema restrito, acione o handoff: "Que pergunta importante! Esse tema é bem profundo. Posso pedir pra um dos nossos missionários conversar com você sobre isso?"
```

---

## 🛠️ AÇÃO 3: CAMPANHA EXPRESSA (19 DE SETEMBRO)
> [!NOTE]
> **NOVA CAMPANHA (ADICIONAR)**
> Isso não substitui o fluxo normal. Esta é uma **nova campanha** que você deve configurar e agendar apenas para os leads que selecionamos para o dia 19/09.

**Público:** Leads que precisam ser aquecidos *rápido* (em 15 dias) para aceitarem uma visita no dia 19/09.

**Cronograma de disparos (Linha 1 - Mensagens Fixas):**
*Configure esses disparos agendados:*

- **04/09 (Dia 1 - Contato):** "Oi {{NOME}}! Aqui é a Ana, da Escola Bíblica Novo Tempo 😊 Vi que você pediu um material nosso um tempo atrás. Como você tá? Tá tudo bem por aí?"
- **07/09 (Dia 4 - Engajamento):** "Passando só pra deixar um versículo que me ajudou muito hoje: 'O Senhor te abençoe e te guarde' (Nm 6:24). Lembrei de você! Como tá sendo sua semana?"
- **11/09 (Dia 8 - Valor):** Enviar vídeo curto da Novo Tempo sobre esperança/saúde/família. "Vi esse vídeo curtinho e achei que você ia gostar. Assiste aí quando tiver um tempinho!"
- **15/09 (Dia 12 - Curiosidade):** "{{NOME}}, nossa equipe tá preparando uma surpresa muito especial pra algumas pessoas aqui da região de {{CIDADE}}. Fiquei super feliz porque seu nome tá na lista! 🎉 Amanhã eu te conto os detalhes."
- **18/09 (Dia 15 - Convite para 19/09):** "{{NOME}}, como te falei, temos um presente especial da Novo Tempo pra você! Nossa equipe de missionários vai estar na sua região amanhã, dia 19. Posso pedir pra um deles dar uma passadinha rápida aí pra te entregar? Não demora nem 5 minutinhos!"

**Lógica Pós-Convite:**
- Se Aceitar: use o endereço do banco quando existir; somente colete o endereço quando o banco não tiver esse dado (veja Regra 4 abaixo).
- Se Recusar: "Tudo bem! Deixo guardado aqui pra uma próxima 😊".

---

## 🛠️ AÇÃO 4: REGRAS DE SISTEMA (HUMANIZAÇÃO E CRM)
Para garantir que a automação não pareça um robô e não cometa erros básicos, implemente estas regras no seu motor:

**Regra 1: Validação do Nome do Cadastro**
Nunca use palavras como "Oi", "Olá", "Bom dia" ou "Boa tarde" como nome. Se a variável `{nome}` vier suja, acione um fallback sem o nome (ex: "Oi, tudo bem? Aqui é a Ana...").

**Regra 2: Delay e "Digitando..."**
Configure o sistema para enviar o status "digitando" para o WhatsApp e aguardar antes de enviar a resposta. Use o cálculo:
`Delay = 4 segundos + (Quantidade de caracteres da resposta / 25)`
*(Limites: mínimo de 4s, máximo de 25s).*

**Regra 3: Variáveis de Estado no CRM**
Salve o estado do lead no banco para a IA saber em que pé a conversa está. Campos obrigatórios:
`leu_material`, `interesse_continuar`, `aceita_presente`, `endereco_confirmado`, `representante_acionado` e `ultima_pergunta_feita`.

**Regra 4: Endereço (Pós-aceite do presente)**
- **Se tem endereço no banco:** não pergunte nem confirme o endereço; finalize informando a entrega no sábado, 19 de setembro de 2026, pela tarde.
- **Se não tem endereço no banco:** pergunte uma única vez: "Para organizarmos a entrega, você pode me enviar o seu endereço completo?"
- **Depois que a pessoa enviar o endereço:** considere a etapa concluída e finalize a entrega. Nunca peça novamente e não encaminhe para atendente.
