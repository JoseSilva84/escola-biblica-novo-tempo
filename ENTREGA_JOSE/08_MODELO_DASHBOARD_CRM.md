# 📊 Modelo de Dashboard e CRM — Especificação para o José

> **Para o José:** Este documento descreve o que Eduardo e James precisam VER no dashboard e o que os voluntários precisam PREENCHER após cada interação.

---

## 1. DASHBOARD — Visão de Eduardo e James

### Visão Geral (Tela principal)

```
┌──────────────────────────────────────────────────────────────────┐
│  📊 DASHBOARD 7FLOW                                    [Hoje]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FUNIL ATIVO                         ALERTAS URGENTES 🔴        │
│  ┌─────────────────────┐             ┌────────────────────────┐ │
│  │ Etapa 1: 46.276     │             │ ⚠ 12 leads sem resp.  │ │
│  │ Etapa 2: 500    ▼   │             │   há 7+ dias          │ │
│  │ Etapa 3: 75     ▼   │             │ ⚠ 3 visitas sem       │ │
│  │ Etapa 4: 30     ▼   │             │   feedback há 48h     │ │
│  │ Etapa 5: 15     ▼   │             │ ⚠ Teste A/B/C:        │ │
│  │ Etapa 6: 8      ▼   │             │   Versão A vencendo!  │ │
│  │ Etapa 7: 2      🎉  │             └────────────────────────┘ │
│  └─────────────────────┘                                        │
│                                                                  │
│  SUGESTÕES DO SISTEMA 💡                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • "15 leads completaram os 21 dias. Voluntários foram    │   │
│  │    notificados para fazer visitas essa semana."          │   │
│  │ • "Teste A/B/C: Versão A (Curiosidade) tem 23% de       │   │
│  │    resposta vs 15% da B e 18% da C. Sugestão: escalar   │   │
│  │    versão A para os próximos 2.000 leads."               │   │
│  │ • "5 leads que recusaram visita há 30 dias podem ser     │   │
│  │    recontatados com gancho do evento de Sábado."         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Detalhes por Lead (ao clicar num lead)

```
┌──────────────────────────────────────────────────────────────────┐
│  👤 MARIA SILVA                                    [Etapa 5]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📱 Telefone: (11) 9XXXX-XXXX                                   │
│  📍 Cidade: São Paulo - SP                                      │
│  📚 Estudo pedido: Família / Relacionamentos                    │
│  📅 Inscrita em: 15/03/2026                                     │
│  🔥 Score: 78/100                                                │
│                                                                  │
│  TIMELINE DO FUNIL:                                              │
│  ✅ Etapa 1 (01/jul) → Dados limpos                             │
│  ✅ Etapa 2 (02/jul) → Respondeu em 3h (Estratégia A)          │
│  ✅ Etapa 3 (02-23/jul) → Engajou em 5 de 7 interações         │
│  ✅ Etapa 4 (23/jul) → Aceitou visita                           │
│  🔵 Etapa 5 (25/jul) → Visita realizada - Receptiva            │
│                                                                  │
│  ÚLTIMO CONTATO: Há 2 dias                                      │
│  PRÓXIMA AÇÃO SUGERIDA: "Enviar follow-up semanal (Semana 1)"  │
│                                                                  │
│  HISTÓRICO DE CONVERSAS: [Ver conversa completa]                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Tipos de Alertas Automáticos

| Alerta | Quando dispara | Para quem | Urgência |
|--------|---------------|-----------|----------|
| Lead sem resposta 7+ dias | Lead não responde há 7 dias (em qualquer etapa) | Eduardo + James | 🟡 Média |
| Visita sem feedback | Voluntário não registrou resultado da visita em 48h | James | 🔴 Alta |
| Lead pronto para próxima etapa | Lead completou os critérios da etapa atual | Eduardo | 🟢 Info |
| Teste A/B/C finalizado | 48h se passaram desde o início do teste | Eduardo | 🟡 Média |
| Lead bloqueou | Lead bloqueou o número no WhatsApp | James | 🔴 Alta |
| Nurturing expirado | 3 meses de nurturing mensal sem resposta | Eduardo | 🟡 Média |

### Sugestões Automáticas do Sistema

| Situação | Sugestão exibida |
|----------|-----------------|
| Lead engajou muito rápido | "Lead [Nome] respondeu em todas as interações. Considere antecipar o convite de visita" |
| Muitos leads esfriando na Etapa 3 | "30% dos leads estão esfriando no Dia 10. Sugestão: revisar o devocional dessa etapa" |
| Evento da igreja se aproximando | "Evento [Nome] em 5 dias. 8 leads na Etapa 5 podem ser convidados" |
| Versão A do teste vencendo | "Versão A tem 23% de resposta. Sugestão: escalar para os próximos lotes" |

---

## 2. CRM DO VOLUNTÁRIO — Formulário Pós-Visita

Quando o voluntário faz uma visita, ele preenche este formulário simples (pode ser um Google Forms ou tela no sistema):

### Campos do Formulário

```
═══════════════════════════════════════════════════════════
  📋 REGISTRO DE VISITA
═══════════════════════════════════════════════════════════

  Nome do Lead: [Preenchido automaticamente]
  Data da Visita: [Preenchido automaticamente]
  Voluntário: [Preenchido automaticamente]

  ─────────────────────────────────────────────────────────

  1. A visita aconteceu?
     ○ Sim, conversei com a pessoa
     ○ Não estava em casa
     ○ Recusou abrir a porta / atender
     ○ Endereço incorreto

  2. Como a pessoa recebeu você?
     ○ Muito receptiva (animada, fez perguntas)
     ○ Receptiva (educada, ouviu com atenção)
     ○ Indiferente (ouviu mas sem muito interesse)
     ○ Fria (respondeu pouco, pareceu incomodada)

  3. Aceitou ir à igreja / grupo?
     ○ Sim, confirmou dia e horário
     ○ Talvez, disse que vai pensar
     ○ Não, mas quer continuar conversando
     ○ Não, e pediu para não ser mais contatada

  4. Material entregue?
     ☐ Guia de estudo impresso
     ☐ Convite da igreja
     ☐ Outro: ____________

  5. Observações livres:
     [Campo de texto para o voluntário anotar qualquer 
      detalhe importante: "Ela tem 2 filhos, estava 
      emocionada quando falamos sobre família"]

  ─────────────────────────────────────────────────────────

  [ENVIAR]
═══════════════════════════════════════════════════════════
```

### O que acontece com esse registro

- O sistema atualiza automaticamente o **status do lead** no dashboard
- A IA recebe as **observações do voluntário** no seu contexto, pra poder personalizar as próximas mensagens
- Se o voluntário marcou "Muito receptiva" + "Aceitou ir à igreja" → Sistema sugere priorizar o follow-up
- Se marcou "Não estava em casa" → Sistema sugere reagendar automaticamente

---

## 3. CRITÉRIOS DE INTEGRAÇÃO (ETAPA 6)

> Eduardo perguntou: "O que define que uma pessoa está integrada?"

### Critérios Propostos

Uma pessoa é considerada **integrada na comunidade** quando atinge pelo menos **3 de 5** destes marcos:

| # | Marco de Integração | Como medir | Quem registra |
|---|---------------------|-----------|---------------|
| 1 | **Frequência regular** | Foi ao culto/igreja pelo menos 3 vezes nas últimas 4 semanas | Voluntário/Pastor |
| 2 | **Participação em grupo** | Está inserida num grupo pequeno ou Escola Sabatina | Voluntário |
| 3 | **Conexões pessoais** | Conhece pelo menos 3 pessoas da igreja pelo nome | Voluntário (observação) |
| 4 | **Engajamento ativo** | Participou de pelo menos 1 atividade além do culto (almoço, mutirão, programa social) | Voluntário |
| 5 | **Pedido de estudo bíblico** | Solicitou estudos bíblicos preparatórios para o batismo | Pastor |

### Status de Integração

- **🔴 Não integrado:** 0-1 marcos atingidos → Atenção redobrada
- **🟡 Em integração:** 2-3 marcos → Acompanhamento normal
- **🟢 Integrado:** 4-5 marcos → Pronto para decisão de batismo (quando a pessoa quiser)
