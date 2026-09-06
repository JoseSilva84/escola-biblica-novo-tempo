# Amigos NT - CRM de Interessados

Sistema em desenvolvimento para organizar interessados da Novo Tempo, acompanhar campanhas por associacao/distrito e apoiar a priorizacao de contatos com dados operacionais e ranking de machine learning.

## Estado atual

O projeto ja possui:

- Frontend em Next.js com tela de login, dashboard administrativo, visao por associacao, detalhes de interessados, tema claro/escuro e interface responsiva.
- Backend em Node.js/Express com autenticacao, sessao por cookie/token, rota de saude, rota protegida de dashboard e integracao com Prisma.
- Schema Prisma para PostgreSQL com usuarios, associacoes, distritos, igrejas, campanhas, leads, interacoes, visitas, templates, sequencias e disparos de WhatsApp.
- Dataset local com arquivos de analise, base de alunos, rankings CSV e modelos de machine learning usados para priorizar interessados.
- Separacao inicial entre `frontend`, `backend` e `dataset`.

## Estrutura

```text
.
|-- backend/
|   |-- prisma/
|   |   `-- schema.prisma
|   |-- src/
|   |   |-- auth.js
|   |   |-- data.js
|   |   |-- prisma.js
|   |   |-- server.js
|   |   `-- scripts/seedAdmin.js
|   `-- package.json
|-- frontend/
|   |-- app/
|   |-- components/
|   |-- public/
|   `-- package.json
|-- dataset/
`-- .gitignore
```

## Tecnologias

- Next.js 15
- React 19
- Tailwind CSS
- Recharts
- Sonner
- Lucide React
- Node.js
- Express
- Prisma 7
- PostgreSQL

## Backend

Entre na pasta do backend:

```bash
cd backend
npm install
```

Crie um arquivo `.env` local dentro de `backend/`. Esse arquivo nao deve subir para o GitHub.

Variaveis usadas ate o momento:

```env
DATABASE_URL="postgresql://usuario:senha@host:porta/banco"
AUTH_SECRET="uma-chave-secreta-forte"
FRONTEND_URL="http://localhost:3000"
PORT=4000
WAHA_API_URL="https://waha.seu-dominio.com"
WAHA_API_KEY="chave-privada-da-api-do-waha"
WAHA_SESSION="default"
WAHA_WEBHOOK_SECRET="segredo-privado-do-webhook-waha"
GPTMAKER_API_URL="https://api.gptmaker.ai"
GPTMAKER_API_TOKEN="token-privado-da-api-do-gpt-maker"
GPTMAKER_AGENT_ID="id-do-agente-ana-no-gpt-maker"
GPTMAKER_AGENT_NAME="Ana"
GPTMAKER_AUTO_REPLY="true"
GPTMAKER_WEBHOOK_SECRET="segredo-privado-do-webhook-gpt-maker"
ADMIN_EMAIL="admin@leadsnt.com.br"
ADMIN_PASSWORD="senha-com-no-minimo-8-caracteres"
ADMIN_NAME="Admin"
DATASET_DIR="../dataset"
```

O mapa de leads usa Leaflet com blocos do OpenStreetMap e nao exige chave de API.

Preparar Prisma e usuario admin:

```bash
npm run setup:db
```

Rodar o backend em desenvolvimento:

```bash
npm run dev
```

Rotas principais:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET /api/webhooks/waha/whatsapp`
- `POST /api/webhooks/waha/whatsapp`
- `GET /api/ai-intentions`
- `POST /api/ai-intentions`

### Webhook do WAHA

No recurso do WAHA, configure o webhook global para a URL publica do backend:

```env
WHATSAPP_HOOK_URL="https://SEU_BACKEND_PUBLICO/api/webhooks/waha/whatsapp"
WHATSAPP_HOOK_EVENTS="message,message.ack"
WHATSAPP_HOOK_CUSTOM_HEADERS="X-Waha-Webhook-Secret:O_MESMO_VALOR_DE_WAHA_WEBHOOK_SECRET"
```

Envie o mesmo segredo de `WAHA_WEBHOOK_SECRET` no header `x-waha-webhook-secret`. Os eventos usados são `message` e `message.ack`.

O WAHA recebe e envia as mensagens. O backend grava o histórico e encaminha cada mensagem recebida ao agente configurado no GPT Maker.

### Agente do GPT Maker

O backend conversa com o agente usando `GPTMAKER_AGENT_ID` e `GPTMAKER_API_TOKEN`. Use o mesmo telefone como contexto da conversa para que o agente mantenha o histórico do interessado.

As intenções e qualificações configuradas no GPT Maker devem chamar:

```text
https://SEU_BACKEND_PUBLICO/api/ai-intentions?token=O_MESMO_VALOR_DE_GPTMAKER_WEBHOOK_SECRET
```

Envie no corpo os campos `phone`, `intent`, `qualification`, `summary`, `nextAction`, `userMessage` e `agentMessage` quando estiverem disponíveis. Também é possível proteger o endpoint pelo header `x-gptmaker-secret` ou `x-webhook-secret`. A qualificação recebida é anexada à mensagem existente do WAHA e alimenta a tela do Agente IA sem duplicar a conversa.

Rotas internas do Amigos NT para disparo:

- `GET /api/whatsapp/provider`
- `POST /api/whatsapp/send`
- `POST /api/whatsapp/send-batch`

## Frontend

Entre na pasta do frontend:

```bash
cd frontend
npm install
```

Crie um arquivo `.env` local dentro de `frontend/`. Esse arquivo tambem nao deve subir para o GitHub.

Variavel usada:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Rodar o frontend em desenvolvimento:

```bash
npm run dev
```

Acesse:

```text
http://127.0.0.1:3000
```

## Scripts

Backend:

- `npm run dev`: inicia o servidor com watch.
- `npm run start`: inicia o servidor sem watch.
- `npm run prisma:generate`: gera o Prisma Client.
- `npm run prisma:push`: sincroniza o schema com o banco.
- `npm run seed:admin`: cria ou atualiza o usuario admin.
- `npm run setup:db`: executa generate, db push e seed admin.
- `npm run build`: gera o Prisma Client.

Frontend:

- `npm run dev`: inicia o Next.js em desenvolvimento.
- `npm run build`: gera build de producao.
- `npm run start`: inicia o Next.js em modo producao.

## Dados e machine learning

A pasta `dataset/` concentra os dados e analises usadas pelo dashboard:

- `alunos.json`: base principal lida pelo backend.
- `ranking_nao_vip_ml_pandas.csv`: ranking usado para prioridade operacional.
- notebooks e scripts Python para analise dos interessados.
- arquivos Markdown e CSV com relatorios, contatos e rankings.

O backend transforma esses dados em registros compactos para o dashboard e inclui metadados como total de registros, origem do ranking e data de referencia.

Para atualizar os arquivos derivados depois de trocar a planilha `ListagemCompleta (1).xlsx`, rode:

```bash
python dataset/atualizar_dataset.py
```

Esse comando regenera `alunos.json`, recalcula o ranking VIP, salva o modelo `modelo_vip_sklearn.joblib` e atualiza `metricas_vip_sklearn.json`.

O Dockerfile aceita a variavel de build `AUTO_UPDATE_DATASET=true` para rodar essa rotina durante o build. Sem essa variavel, o deploy usa os arquivos derivados ja enviados no repositorio, que e o caminho mais leve e seguro para a VPS.

Para usar a atualizacao pelo painel administrativo, habilite tambem `INSTALL_DATASET_TOOLS=true` no build da VPS. Isso instala Python e as dependencias necessarias para processar uploads de Excel sem recalcular a base durante o deploy.

Com `INSTALL_DATASET_TOOLS=true`, o Admin Geral pode usar o botao "Atualizar base" na tela da associacao. O painel aceita varios arquivos `.xlsx`, consolida apenas alunos que ainda nao existem na planilha principal pelo `ID`, regenera `alunos.json` e recalcula o ranking VIP. Para manter os uploads e a planilha consolidada entre recriacoes do container, use armazenamento persistente em `/app/dataset` ou outro storage externo.

## Seguranca

Arquivos de ambiente nao devem ser enviados para o GitHub:

- `.env`
- `.env.*`
- `backend/.env.example`
- `frontend/.env.example`

Caso algum segredo real tenha sido enviado anteriormente, o ideal e trocar essas chaves/senhas nos provedores correspondentes.

## Proximos passos

- Criar migrations formais do Prisma.
- Conectar CRUD real de associacoes, campanhas, leads, visitas e automacoes.
- Ajustar credenciais demo da tela de login para refletirem o admin criado pelo seed.
- Definir provedor oficial de WhatsApp.
- Criar politicas de permissao por perfil de usuario.
- Preparar ambiente de producao com banco PostgreSQL, `AUTH_SECRET` definitivo e URLs oficiais.
