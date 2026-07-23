# 📦 ENTREGA PARA O JOSÉ — Diretoria de Marketing 7Flow

**De:** Eduardo (Diretor de Marketing)
**Para:** José (Diretor de Tecnologia)
**Data:** Julho/2026

---

José, aqui está tudo que você precisa para programar o sistema piloto da 7Flow.
Eu e a equipe de marketing montamos toda a lógica do funil, os comportamentos da IA e as especificações do que precisamos que o sistema faça. Leia este README primeiro pra entender o que cada arquivo contém.

---

## 📂 O que tem nesta pasta

| # | Arquivo | O que é | Pra que serve |
|---|---------|---------|---------------|
| 1 | **LEIA_PRIMEIRO.md** | Este documento | Guia de orientação |
| 2 | **06_FUNIL_COMPLETO_7FLOW.md** | O mapa completo do funil (7 etapas) | Entender toda a jornada de ponta a ponta — desde quando recebemos os dados até o batismo. Mostra o que o lead vive e o que cada membro da equipe faz em cada etapa |
| 3 | **05_SYSTEM_PROMPTS_FUNIL.md** | ⭐ O "cérebro" da IA | **Este é o arquivo mais importante pra você.** Contém todos os System Prompts que a IA vai usar em cada etapa, a persona (Ana), as regras de comportamento, a personalização por tipo de estudo, e as instruções técnicas de implementação na API |
| 4 | **08_MODELO_DASHBOARD_CRM.md** | Especificação do Dashboard e CRM | Mostra exatamente o que o Eduardo e o James precisam ver no painel: alertas, sugestões automáticas, status de cada lead. Também tem o formulário que o voluntário vai preencher depois de cada visita |
| 5 | **01_FUNIL_MACRO.html** | Infográfico do funil completo | Imagem visual interativa das 7 etapas |
| 6 | **02_TESTE_ABC.html** | Infográfico do Teste A/B/C | Explica visualmente como funciona o teste de estratégias |
| 7 | **03_REGUA_21_DIAS.html** | Infográfico da régua de 21 dias | Timeline com as 7 interações da Etapa 3 |
| 8 | **04_MAPA_RESPONSAVEIS.html** | Infográfico do mapa de responsáveis | Quem faz o quê em cada etapa (abra no navegador) |

---

## 🎯 Por onde começar

### Passo 1: Leia o funil completo
Abra o `06_FUNIL_COMPLETO_7FLOW.md` e leia por cima pra entender a jornada toda. Não precisa decorar — é mais pra você ter o contexto do porquê de cada coisa.

### Passo 2: Foque no arquivo de System Prompts
O `05_SYSTEM_PROMPTS_FUNIL.md` é o seu documento de trabalho principal. Ele contém:

- **Seção 1 (Persona):** Quem é a "Ana", como ela fala, quais são os limites (quando a IA deve parar e passar pra um humano)
- **Seção 2 (Banco de Materiais):** Lista de "brindes" digitais que a IA pode oferecer (em standby por enquanto, mas a estrutura já está lá)
- **Seção 3 (Régua de 21 dias):** O System Prompt ESPECÍFICO de cada dia (Dia 1, 3, 7, 10, 14, 18, 21)
- **Seção 4 (Personalização):** Tabela de como adaptar o conteúdo dependendo do tipo de estudo que o lead pediu
- **Seção 5 (Etapas 5-7):** Prompts do pós-visita, integração e celebração de batismo
- **Seção 6 (Nurturing):** Como recontatar leads que esfriaram
- **Seção 7 (Instruções técnicas):** ⭐ As 7 regras de implementação pra você (variáveis, memória, handoff, alertas)

### Passo 3: Confira o modelo de Dashboard/CRM
O `08_MODELO_DASHBOARD_CRM.md` mostra o que o Eduardo e o James precisam ver no sistema. Tem wireframes em ASCII mostrando o layout e as funcionalidades.

---

## ⚙️ Resumo técnico rápido (pra você não precisar ler tudo agora)

1. **Modelo de IA:** GPT-4o mini (custo baixo, R$0,0066/conversa)
2. **WhatsApp:** Evolution API
3. **Arquitetura dos prompts:**
   - System Prompt Base (Persona + Regras + Personalização) → FIXO em toda requisição
   - System Prompt da Etapa (muda conforme o dia/estágio do lead) → CONCATENADO ao Base
   - Histórico de mensagens (últimas 5 interações) → Array de `messages`
4. **Variáveis dinâmicas:** `[Nome]`, `[Cidade]`, `[TIPO_ESTUDO]`, `[Nome do Voluntário]`
5. **Handoff:** Quando a IA detecta ofensa, doutrina pesada ou urgência → acionar humano
6. **Alertas automáticos:**
   - Lead sem resposta 7+ dias → alerta pro Eduardo+James
   - Visita sem feedback 48h → alerta pro James

---

## ❓ Dúvidas?

Fala comigo (Eduardo) ou direto com o AIOX-Master (a IA que montou tudo isso comigo). Qualquer ajuste que precisar nos prompts ou na lógica, a gente faz junto.

**Bora construir esse piloto! 💪**
