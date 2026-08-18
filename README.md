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
ZPRO_WEBHOOK_SECRET="uma-chave-para-webhook-zpro"
ZPRO_API_URL="https://api.seu-provedor-zpro.com"
ZPRO_API_TOKEN="token-completo-gerado-no-zpro-sem-escrever-Bearer"
ZPRO_API_ID="id-da-api-criada-no-zpro"
ZPRO_CHANNEL_ID="10"
ZPRO_SEND_TEXT_PATH="/v2/api/external/{apiId}"
ADMIN_EMAIL="admin@leadsnt.com.br"
ADMIN_PASSWORD="senha-com-no-minimo-8-caracteres"
ADMIN_NAME="Admin"
DATASET_DIR="../dataset"
```

No frontend, configure a chave publica do Google Maps quando quiser exibir os pontos dos leads no mapa:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="sua-chave-publica-google-maps"
```

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
- `GET /api/webhooks/zpro/whatsapp`
- `POST /api/webhooks/zpro/whatsapp`

### Webhook do Zpro / Baileys

No Zpro, em **Webhook do Canal > URL de destino**, use a URL publica do backend:

```text
https://SEU_BACKEND_PUBLICO/api/webhooks/zpro/whatsapp?token=SUA_CHAVE_ZPRO_WEBHOOK_SECRET
```

Tambem e possivel enviar a chave no header `x-webhook-secret` ou `x-zpro-webhook-secret`.

Para desenvolvimento local, o endpoint fica:

```text
http://localhost:4000/api/webhooks/zpro/whatsapp?token=SUA_CHAVE_ZPRO_WEBHOOK_SECRET
```

O campo do Zpro recebe eventos de entrada, como mensagens recebidas e status do canal. Para envio automatico de mensagens, o Amigos NT devera chamar a API do Zpro usando as credenciais do provedor e registrar os disparos na tabela `WhatsAppSend`.

### Envio de mensagens pelo Zpro

Configure no backend:

```env
ZPRO_API_URL="https://api.seu-provedor-zpro.com"
ZPRO_API_TOKEN="token-completo-gerado-no-zpro-sem-escrever-Bearer"
ZPRO_API_ID="id-da-api-criada-no-zpro"
ZPRO_CHANNEL_ID="10"
ZPRO_SEND_TEXT_PATH="/v2/api/external/{apiId}"
```

O `ZPRO_API_ID` deve ser o ID da API criada na tela **API** do Zpro. O `ZPRO_CHANNEL_ID` pode continuar como referencia do canal Baileys conectado. Pelas telas do Zpro, o canal **Novo Tempo Seven** usa o ID `10`.
No `ZPRO_API_TOKEN`, cole somente o token completo criado no Zpro. Nao coloque `Bearer` antes do token.

Se a sua instalacao do Zpro usar outro caminho de envio, altere apenas `ZPRO_SEND_TEXT_PATH`. Ele aceita placeholders:

```env
ZPRO_SEND_TEXT_PATH="/v2/api/external/{apiId}"
```

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
