FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts
COPY dataset/requirements-dataset.txt ./dataset/requirements-dataset.txt

WORKDIR /app/backend

RUN npm ci

WORKDIR /app

RUN python3 -m venv /opt/dataset-venv \
  && /opt/dataset-venv/bin/pip install --no-cache-dir -r /app/dataset/requirements-dataset.txt

WORKDIR /app/backend

COPY backend/src ./src
COPY dataset /app/dataset

ENV NODE_ENV=production
ENV PORT=4000
ENV DATASET_DIR=/app/dataset
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

RUN /opt/dataset-venv/bin/python /app/dataset/atualizar_dataset.py

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
