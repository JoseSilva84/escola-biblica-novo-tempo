FROM node:22-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts

WORKDIR /app/backend

RUN npm ci

COPY backend/src ./src
COPY dataset /app/dataset

ENV NODE_ENV=production
ENV PORT=4000
ENV DATASET_DIR=/app/dataset
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
