# 📦 ENTREGA PARA O JOSÉ — Operação Novo Tempo (Reativação de Leads)

**De:** Eduardo (Diretor de Marketing)  
**Para:** José (Diretor de Tecnologia)  
**Data:** Agosto/2026  
**Operação:** Reativação dos leads da Escola Bíblica Novo Tempo (TV NT)

---

## 🎯 Contexto Rápido

José, esse pacote contém tudo que você precisa para implementar a **operação de reativação** dos leads que pediram materiais/estudos pela Escola Bíblica da TV Novo Tempo.

**O que é essa operação:**
- Temos uma base de pessoas que pediram materiais bíblicos pela TV Novo Tempo (nome, telefone, cidade, tema do material pedido).
- NÃO sabemos se elas receberam ou não esses materiais.
- Vamos disparar mensagens via WhatsApp para reativá-las e conduzi-las pelo funil SEVEN FLOW, usando a IA "Ana" como representante da Novo Tempo.

**O que muda em relação ao funil padrão:**
1. A Ana se identifica como representante da **Escola Bíblica Novo Tempo** (não da SEVEN FLOW)
2. A primeira mensagem é uma **pergunta de verificação** ("Você chegou a receber o material?") — funciona para quem recebeu E para quem não recebeu
3. Existem **guardrails doutrinários** que limitam quais temas a Ana pode abordar

---

## 📂 Arquivos neste pacote

| # | Arquivo | O que é | Prioridade |
|---|---------|---------|------------|
| 1 | **LEIA_PRIMEIRO.md** | Este documento | Leia antes de tudo |
| 2 | **02_SYSTEM_PROMPT_ANA_V2.md** | ⭐ O "cérebro" da Ana para esta operação | **PRINCIPAL — Este é o seu arquivo de trabalho** |
| 3 | **03_COPYS_ICEBREAKERS.md** | Templates de primeira mensagem + respostas por ramificação | Secundário — as copys das Template Messages |

---

## 🚀 Por onde começar

### Passo 1: Leia o System Prompt (Arquivo 02)
O `02_SYSTEM_PROMPT_ANA_V2.md` é o documento principal. Contém:

| Seção | Conteúdo |
|-------|----------|
| **1. Persona** | Quem é a Ana nesta operação, tom de voz, regra de honestidade |
| **2. Guardrails Doutrinários** | ⚠️ IMPORTANTE — Lista de temas que a Ana pode abordar (LIVRES) vs. temas que ela DEVE encaminhar para humano (RESTRITOS) |
| **3. Banco de Materiais** | Estrutura placeholder — ainda será populado pela equipe. A estrutura JSON já está definida |
| **4. Régua de 21 Dias** | System Prompts específicos para cada dia (Dia 1, 3, 7, 10, 14, 18, 21) — inclui o contexto base que vai em TODA requisição |
| **5. Pós-Régua** | Follow-up após visita, integração na comunidade, celebração |
| **6. Nurturing Mensal** | Como recontatar leads que esfriaram |
| **7. Instruções Técnicas** | ⭐ As 9 regras de implementação pra você |

### Passo 2: Configure as Template Messages (Arquivo 03)
O `03_COPYS_ICEBREAKERS.md` contém:
- 5 variações de Template Message (API Oficial com botões) para submeter à Meta
- 5 variações de mensagem comum (API Não-Oficial)
- Respostas completas da Fase 2 para cada cenário (recebeu / não recebeu / não lembra / opt-out)
- Regras técnicas de submissão (categoria UTILITY, rotação anti-spam)

### Passo 3: Estruture os bancos de dados
Dois bancos precisam ser criados (as estruturas/schemas já estão definidas no arquivo 02):

**Banco de Materiais:**
```json
{
  "id": "MAT_001",
  "titulo": "(a definir pela equipe)",
  "tema": "(Categoria)",
  "gatilho": "(Quando oferecer)",
  "formato": "PDF",
  "link_ou_arquivo": "(URL)",
  "status_doutrinario": "aprovado"
}
```

**Banco de Testemunhos (para Dia 7):**
```json
{
  "id": "TEST_001",
  "nome_ficticio": "(nome usado na história)",
  "tema": "(categoria temática)",
  "resumo": "(1 parágrafo da história)",
  "pergunta_final": "(pergunta aberta para encerrar)"
}
```

---

## ⚙️ Resumo técnico rápido

| Item | Detalhe |
|------|---------|
| **Modelo de IA** | GPT-4o mini (custo baixo) |
| **WhatsApp** | Evolution API |
| **Arquitetura de prompts** | System Prompt Base (Persona + Guardrails + Personalização) → FIXO + System Prompt da Etapa → CONCATENADO |
| **Memória** | Últimas 5 interações no array de `messages` |
| **Variáveis dinâmicas** | `[Nome]`, `[Cidade]`, `[TIPO_ESTUDO]`, `[Nome do Voluntário]` |
| **Handoff** | Tema RESTRITO, ofensa ou urgência → acionar missionário/agente humano |
| **Alertas automáticos** | Lead sem resposta 7+ dias → alerta Eduardo+James. Visita sem feedback 48h → alerta James |
| **Versículos** | Tradução NVI (Nova Versão Internacional) |
| **Webhook emergência** | Crise emocional grave → acionar responsável imediatamente |
| **Categoria Meta** | UTILITY (não Marketing) — melhor aprovação |
| **Rotação** | Dividir base em 5 lotes, cada lote recebe uma variação diferente de Template Message |

---

## ⚠️ Itens pendentes (dependem da equipe de conteúdo)

- [ ] **Banco de Materiais:** Ainda precisa ser populado com os PDFs/links reais dos estudos
- [ ] **Banco de Testemunhos:** Testemunhos reais precisam ser coletados pela equipe
- [ ] **Vídeos da Novo Tempo:** Links específicos por tema para o Dia 18
- [ ] **Base de leads:** Planilha final com nome, telefone, cidade e tipo de estudo

---

## ❓ Dúvidas?

Fala comigo (Eduardo) ou pelo AIOX. Qualquer ajuste nos prompts ou na lógica, a gente faz junto.

**Bora reativar essa base! 💪**
