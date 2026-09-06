import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { gzip } from 'zlib';
import { promisify } from 'util';
import { createSessionToken, requireAuth, sessionCookieOptions, validateCredentials, verifySessionToken } from './auth.js';
import { districtSlug, getDashboardData, invalidateDashboardCache } from './data.js';
import { geocodeStatus, hydrateGeocodeCacheFromDb, startGeocodingBatch } from './geocode.js';
import { prisma } from './prisma.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const DATASET_DIR = resolveDatasetDir();
const MAX_DATASET_UPLOAD_BYTES = Number(process.env.DATASET_UPLOAD_LIMIT_BYTES || 150 * 1024 * 1024);
const gzipAsync = promisify(gzip);
const ANA_SEQUENCE_GUIDE_FILE = 'PLANO_SEQUENCIA_ANA_PRESENTE_19_SETEMBRO.md';
const ANA_TRAINING_DIR = 'TREINAMENTO_IA_NOVO_TEMPO';
const ANA_TRAINING_FILES = [
  ['01_LEIA_PRIMEIRO.md', 'Contexto da operacao V3'],
  ['02_GUIA_RESUMIDO_IMPLEMENTACAO.md', 'Guia resumido de implementacao'],
  ['03_SYSTEM_PROMPT_ANA_V3.md', 'System prompt Ana V3'],
  ['04_REGUA_21_DIAS_COMPLETA.md', 'Regua completa de 21 dias'],
  ['05_CAMPANHA_EXPRESSA_19_09.md', 'Campanha expressa 19/09'],
  ['06_COPYS_ICEBREAKERS.md', 'Copys, icebreakers e ramificacoes'],
  ['07_ESTUDOS_BIBLICOS_ADVENTISTAS.md', 'Base bíblica adventista oficial para acompanhamento']
];
let anaSequenceGuideCache = { cacheKey: null, text: '', sources: [], loadedAt: 0 };

function resolveDatasetDir() {
  if (process.env.DATASET_DIR) return path.resolve(process.env.DATASET_DIR);
  const candidates = [
    path.resolve(process.cwd(), 'dataset'),
    path.resolve(process.cwd(), '..', 'dataset')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

const allowedOrigins = new Set((process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean));
allowedOrigins.add('http://127.0.0.1:3000');
allowedOrigins.add('http://localhost:3000');

function webhookAllowed(request) {
  const secret = String(process.env.ZPRO_WEBHOOK_SECRET || '').trim();
  if (!secret && process.env.NODE_ENV !== 'production') return true;
  const authorization = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const received = String(
    request.headers['x-webhook-secret']
    || request.headers['x-zpro-webhook-secret']
    || authorization
    || request.query?.token
    || ''
  ).trim();
  return Boolean(secret && received === secret);
}

function wahaWebhookAllowed(request) {
  const secret = String(process.env.WAHA_WEBHOOK_SECRET || '').trim();
  if (!secret && process.env.NODE_ENV !== 'production') return true;
  const authorization = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const received = String(
    request.headers['x-waha-webhook-secret']
    || request.headers['x-webhook-secret']
    || authorization
    || request.query?.token
    || ''
  ).trim();
  return Boolean(secret && received === secret);
}

function aiIntentWebhookAllowed(request) {
  const secret = String(
    process.env.AI_INTENTIONS_WEBHOOK_SECRET
    || process.env.GPTMAKER_WEBHOOK_SECRET
    || process.env.WEBHOOK_SECRET
    || ''
  ).trim();
  if (!secret) return true;
  const authorization = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const received = String(
    request.headers['x-webhook-secret']
    || request.headers['x-gptmaker-secret']
    || authorization
    || request.query?.token
    || ''
  ).trim();
  return received === secret;
}

function requireAdminGeral(request, response, next) {
  if (!isAdminGeralUser(request.user)) {
    response.status(403).json({ message: 'Apenas Admin Geral pode atualizar a base de dados.' });
    return;
  }
  next();
}

function isAdminGeralUser(user = {}) {
  return user.role === 'ADMIN_GERAL'
    && !user.associationId
    && !user.associationName
    && !/associa/i.test(String(user.name || ''));
}

function normalizeAssociationSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/associacao/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || null;
}

function userAssociationSlug(user = {}) {
  return normalizeAssociationSlug(user.associationSlug || user.associationName || user.name);
}

function scopedDashboardPayload(payload, user = {}) {
  if (isAdminGeralUser(user)) return payload;

  const slug = userAssociationSlug(user);
  const canReadPaulistana = slug === 'paulistana';
  const records = canReadPaulistana ? payload.records : [];
  const interestRecords = canReadPaulistana ? payload.interestRecords || [] : [];
  const interestRecordsByDistrict = canReadPaulistana ? payload.interestRecordsByDistrict || {} : {};
  return {
    ...payload,
    records,
    interestRecords,
    interestRecordsByDistrict,
    meta: {
      ...payload.meta,
      total: records.length,
      lastDatasetUpdate: canReadPaulistana ? payload.meta?.lastDatasetUpdate || null : null,
      datasetUpdateHistory: canReadPaulistana ? payload.meta?.datasetUpdateHistory || [] : [],
      scopedAssociation: {
        id: user.associationId || null,
        slug,
        name: user.associationName || user.name || null
      }
    }
  };
}

function omitInterestDistrictPayloads(payload) {
  return {
    ...payload,
    interestRecordsByDistrict: {}
  };
}

async function sendDashboardJson(request, response, payload) {
  const body = JSON.stringify(payload);
  if (/\bgzip\b/i.test(String(request.headers['accept-encoding'] || ''))) {
    const compressed = await gzipAsync(Buffer.from(body));
    response.set('Content-Encoding', 'gzip');
    response.set('Vary', 'Accept-Encoding');
    response.type('application/json').send(compressed);
    return;
  }
  response.type('application/json').send(body);
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);
  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }
  parts.push(buffer.subarray(start));
  return parts;
}

function parseMultipartFiles(request) {
  const contentType = String(request.headers['content-type'] || '');
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[1]
    || /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[2];
  if (!boundary) {
    const error = new Error('Upload multipart sem boundary.');
    error.status = 400;
    throw error;
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const files = [];
  for (const rawPart of splitBuffer(request.body, boundaryBuffer)) {
    let part = rawPart;
    if (part.length === 0 || part.equals(Buffer.from('--\r\n')) || part.equals(Buffer.from('--'))) continue;
    if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
    if (part.subarray(-2).toString() === '\r\n') part = part.subarray(0, -2);
    if (part.subarray(-2).toString() === '--') part = part.subarray(0, -2);

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;
    const headerText = part.subarray(0, headerEnd).toString('latin1');
    const body = part.subarray(headerEnd + 4);
    const disposition = headerText.split(/\r\n/).find((line) => /^content-disposition:/i.test(line)) || '';
    const filename = /filename="([^"]*)"/i.exec(disposition)?.[1];
    const fieldName = /name="([^"]*)"/i.exec(disposition)?.[1] || '';
    if (!filename || !body.length) continue;
    if (fieldName !== 'files' && fieldName !== 'excel') continue;
    if (!/\.xlsx$/i.test(filename)) {
      const error = new Error(`Arquivo recusado: ${filename}. Envie apenas .xlsx.`);
      error.status = 400;
      throw error;
    }
    files.push({
      filename: path.basename(filename).replace(/[^\w .()\-À-ÿ]/g, '_'),
      buffer: body
    });
  }
  return files;
}

function datasetPythonBin() {
  const configured = String(process.env.DATASET_PYTHON_BIN || '').trim();
  if (configured) return configured;
  if (fs.existsSync('/opt/dataset-venv/bin/python')) return '/opt/dataset-venv/bin/python';
  return process.platform === 'win32' ? 'python' : 'python3';
}

function runDatasetUpdate(uploadPaths) {
  const python = datasetPythonBin();
  const script = path.join(DATASET_DIR, 'atualizar_dataset.py');
  const base = path.join(DATASET_DIR, 'ListagemCompleta (1).xlsx');
  const args = [script, '--arquivo', base, '--saida', DATASET_DIR, '--novos-arquivos', ...uploadPaths];

  return new Promise((resolve, reject) => {
    const child = spawn(python, args, {
      cwd: DATASET_DIR,
      env: { ...process.env, PYTHONUTF8: '1' },
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      error.status = 503;
      error.message = `Python do dataset indisponivel: ${error.message}`;
      reject(error);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(stderr || stdout || `Atualizacao do dataset falhou com codigo ${code}.`);
        error.status = 500;
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ raw: stdout.trim() });
      }
    });
  });
}

function normalizeDatasetHistoryEntry(entry) {
  if (!entry) return null;
  const summary = entry.summary || {};
  return {
    id: entry.id || null,
    atualizado_em: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
    status: entry.status || 'COMPLETED',
    associationId: entry.associationId || null,
    associationName: entry.associationName || null,
    uploadedBy: {
      id: entry.uploadedById || null,
      name: entry.uploadedByName || null,
      email: entry.uploadedByEmail || null
    },
    uploadedFiles: entry.uploadedFiles || [],
    consolidacao: summary,
    ml: entry.ml?.metricas || entry.ml || null,
    ml_status: entry.ml?.status || entry.mlStatus || entry.ml_status || null
  };
}

let datasetHistoryTableReady = null;

function ensureDatasetHistoryTable() {
  if (datasetHistoryTableReady) return datasetHistoryTableReady;
  datasetHistoryTableReady = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DatasetUploadHistory" (
        "id" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'COMPLETED',
        "associationId" TEXT,
        "associationName" TEXT,
        "uploadedById" TEXT,
        "uploadedByName" TEXT,
        "uploadedByEmail" TEXT,
        "uploadedFiles" JSONB NOT NULL,
        "summary" JSONB NOT NULL,
        "alerts" JSONB,
        "newLeads" INTEGER NOT NULL DEFAULT 0,
        "rowsBefore" INTEGER NOT NULL DEFAULT 0,
        "rowsAfter" INTEGER NOT NULL DEFAULT 0,
        "districts" JSONB,
        "ml" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DatasetUploadHistory_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DatasetUploadHistory_createdAt_idx" ON "DatasetUploadHistory"("createdAt")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "DatasetUploadHistory_associationId_idx" ON "DatasetUploadHistory"("associationId")');
  })();
  return datasetHistoryTableReady;
}

async function readDatasetHistoryFromDb(limit = 50) {
  await ensureDatasetHistoryTable();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = await prisma.$queryRaw`
    SELECT
      "id",
      "status",
      "associationId",
      "associationName",
      "uploadedById",
      "uploadedByName",
      "uploadedByEmail",
      "uploadedFiles",
      "summary",
      "alerts",
      "newLeads",
      "rowsBefore",
      "rowsAfter",
      "districts",
      "ml",
      "createdAt"
    FROM "DatasetUploadHistory"
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
  `;
  return rows.map(normalizeDatasetHistoryEntry).filter(Boolean);
}

async function saveDatasetUploadHistory({ result, files, user, processingStartedAt = new Date(), processingCompletedAt = new Date() }) {
  await ensureDatasetHistoryTable();
  const consolidation = result?.consolidacao || {};
  const uploadedFiles = files.map((file) => ({
    name: file.filename,
    size: file.buffer.length
  }));
  const totalUploadBytes = uploadedFiles.reduce((total, file) => total + Number(file.size || 0), 0);
  const summary = {
    ...consolidation,
    processamento: {
      iniciado_em: processingStartedAt.toISOString(),
      concluido_em: processingCompletedAt.toISOString(),
      duracao_ms: Math.max(0, processingCompletedAt.getTime() - processingStartedAt.getTime()),
      arquivos_enviados: uploadedFiles.length,
      bytes_enviados: totalUploadBytes
    }
  };
  const ml = {
    metricas: result?.ml || null,
    status: result?.ml_status || null
  };
  const id = randomUUID();
  const rows = await prisma.$queryRaw`
    INSERT INTO "DatasetUploadHistory" (
      "id",
      "status",
      "associationId",
      "associationName",
      "uploadedById",
      "uploadedByName",
      "uploadedByEmail",
      "uploadedFiles",
      "summary",
      "alerts",
      "newLeads",
      "rowsBefore",
      "rowsAfter",
      "districts",
      "ml",
      "createdAt"
    )
    VALUES (
      ${id},
      'COMPLETED',
      'paulistana',
      'Associacao Paulistana',
      ${user?.sub || null},
      ${user?.name || null},
      ${user?.email || null},
      CAST(${JSON.stringify(uploadedFiles)} AS JSONB),
      CAST(${JSON.stringify(summary)} AS JSONB),
      CAST(${JSON.stringify(consolidation.alertas_duplicidade || {})} AS JSONB),
      ${Number(consolidation.alunos_novos || 0)},
      ${Number(consolidation.linhas_antes || 0)},
      ${Number(consolidation.linhas_depois || 0)},
      CAST(${JSON.stringify(consolidation.distritos_novos || [])} AS JSONB),
      CAST(${JSON.stringify(ml)} AS JSONB),
      ${processingCompletedAt}
    )
    RETURNING *
  `;
  return rows[0] || null;
}

async function importDatasetHistoryFromFiles(entries = []) {
  if (!entries.length) return [];
  await ensureDatasetHistoryTable();
  const [{ count }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "DatasetUploadHistory"`;
  if (count > 0) return [];

  for (const entry of entries.slice().reverse()) {
    const consolidation = entry?.consolidacao || {};
    const createdAt = Number.isNaN(Date.parse(entry?.atualizado_em || ''))
      ? new Date()
      : new Date(entry.atualizado_em);
    const uploadedFiles = (consolidation.arquivos || []).map((file) => ({
      name: file.arquivo,
      read: file.lidos,
      new: file.novos,
      existing: file.ja_existiam,
      duplicated: file.duplicados_upload
    }));
    const ml = {
      metricas: entry?.ml || null,
      status: entry?.ml_status || null
    };
    await prisma.$executeRaw`
      INSERT INTO "DatasetUploadHistory" (
        "id",
        "status",
        "associationId",
        "associationName",
        "uploadedFiles",
        "summary",
        "alerts",
        "newLeads",
        "rowsBefore",
        "rowsAfter",
        "districts",
        "ml",
        "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${entry?.status || 'IMPORTED'},
        ${entry?.associationId || 'paulistana'},
        ${entry?.associationName || 'Associacao Paulistana'},
        CAST(${JSON.stringify(uploadedFiles)} AS JSONB),
        CAST(${JSON.stringify(consolidation)} AS JSONB),
        CAST(${JSON.stringify(consolidation.alertas_duplicidade || {})} AS JSONB),
        ${Number(consolidation.alunos_novos || 0)},
        ${Number(consolidation.linhas_antes || 0)},
        ${Number(consolidation.linhas_depois || 0)},
        CAST(${JSON.stringify(consolidation.distritos_novos || [])} AS JSONB),
        CAST(${JSON.stringify(ml)} AS JSONB),
        ${createdAt}
      )
    `;
  }

  return readDatasetHistoryFromDb(50);
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { body: text, rawText: text };
  }
}

function coerceWebhookPayload(body = {}) {
  const parsed = parseMaybeJson(body);
  if (!parsed || typeof parsed !== 'object') return {};

  if (typeof parsed.payload === 'string') return parseMaybeJson(parsed.payload);
  if (typeof parsed.data === 'string') {
    return {
      ...parsed,
      data: parseMaybeJson(parsed.data)
    };
  }
  if (typeof parsed.message === 'string' && parsed.message.trim().startsWith('{')) {
    return {
      ...parsed,
      message: parseMaybeJson(parsed.message)
    };
  }

  return parsed;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function cleanWhatsAppJid(value) {
  return String(value || '')
    .trim()
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@c\.us$/i, '')
    .replace(/@g\.us$/i, '')
    .replace(/@lid$/i, '');
}

function readMessageText(data = {}) {
  const message = data.message || data.messages?.[0]?.message || {};
  return firstValue(
    data.text,
    data.body,
    data.msg,
    data.content,
    data.messageText,
    data.lastMessage,
    data.lastMessageAt?.body,
    data.lastMessageReceived,
    data.lastMessageReceived?.body,
    data.lastMessageReceived?.text,
    data.message?.text,
    data.message?.body,
    message.conversation,
    message.extendedTextMessage?.text,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    data.messages?.[0]?.body,
    data.messages?.[0]?.text,
    data.rawText
  ) || '';
}

function readMessageStatus(payload = {}, data = {}, ticket = {}, key = {}) {
  return firstValue(
    payload.status,
    payload.ack,
    payload.messageStatus,
    payload.deliveryStatus,
    data.status,
    data.ack,
    data.messageStatus,
    data.deliveryStatus,
    data.receiptStatus,
    data.update?.status,
    data.update?.ack,
    ticket.lastMessageStatus,
    ticket.status,
    key.status
  ) || null;
}

function readZproMessage(payload = {}) {
  const data = payload.data || payload.msg || payload.message || payload.messages?.[0] || payload.ticket || payload;
  const ticket = payload.ticket || data.ticket || {};
  const key = data.key || data.message?.key || payload.key || {};
  const contact = data.contact || data.sender || data.from || ticket.contact || data.ticket?.contact || payload.contact || {};
  const rawPhone = firstValue(
    ticket.contact?.phone,
    ticket.contact?.number,
    ticket.contact?.remoteJid,
    ticket.remoteJid,
    ticket.whatsapp,
    ticket.phone,
    contact.phone,
    contact.number,
    contact.remoteJid,
    payload.phone,
    payload.number,
    data.remoteJid,
    data.remoteJID,
    data.chatId,
    data.jid,
    data.from,
    data.phone,
    data.number,
    key.remoteJid,
    key.participant
  ) || '';
  const phone = cleanWhatsAppJid(rawPhone).replace(/\D/g, '');
  const text = firstValue(
    readMessageText(data),
    readMessageText(payload.msg),
    readMessageText(ticket),
    payload.text,
    payload.body
  );
  const fromMe = Boolean(data.fromMe || key.fromMe || data.message?.key?.fromMe || payload.fromMe);
  const status = readMessageStatus(payload, data, ticket, key);

  return {
    event: payload.event || payload.type || payload.action || 'zpro.webhook',
    channelId: payload.channelId || payload.sessionId || data.channelId || data.sessionId || data.whatsappId || ticket.channelId || ticket.whatsappId || null,
    messageId: data.id
      || data.messageId
      || data.Info?.ID
      || data.info?.id
      || data.data?.Info?.ID
      || key.id
      || data.message?.key?.id
      || null,
    fromMe,
    phone,
    name: contact.name || contact.pushName || data.pushName || data.senderName || null,
    status: status ? String(status) : null,
    text: String(text || '').trim()
  };
}

function wahaJidValue(value) {
  if (!value || typeof value !== 'object') return value;
  const user = value.User || value.user;
  const server = value.Server || value.server;
  return user ? `${user}${server ? `@${server}` : ''}` : '';
}

function readWahaMessage(payload = {}) {
  const data = payload.payload || payload.data || {};
  const internalInfo = data._data?.Info || {};
  const internalKey = data._data?.key || {};
  const fromMe = Boolean(data.fromMe ?? internalInfo.IsFromMe ?? internalKey.fromMe);
  const directionCandidates = fromMe
    ? [
        data.to,
        internalInfo.RecipientAlt,
        internalInfo.Recipient,
        data.from,
        internalInfo.SenderAlt,
        internalInfo.Sender
      ]
    : [
        data.from,
        internalInfo.SenderAlt,
        internalInfo.Sender,
        data.to,
        internalInfo.RecipientAlt,
        internalInfo.Recipient
      ];
  const chatIdCandidates = [
    data.pn,
    data.chatId,
    internalInfo.Chat,
    internalKey.remoteJidAlt,
    internalKey.remoteJid,
    ...directionCandidates,
    data.participant
  ].map(wahaJidValue).filter(Boolean);
  const chatId = chatIdCandidates.find((value) => !String(value).includes('@lid')) || chatIdCandidates[0];
  const timestamp = Number(data.timestamp || payload.timestamp || Date.now());
  const occurredAt = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);

  return {
    event: String(payload.event || '').trim().toLowerCase(),
    session: String(payload.session || '').trim(),
    phone: String(chatId || '').includes('@g.us') ? '' : cleanWhatsAppJid(chatId),
    text: String(firstValue(data.body, data.text, data.caption, '') || '').trim(),
    name: firstValue(data.notifyName, data.pushName, data._data?.Info?.PushName, data._data?.NotifyName) || null,
    fromMe,
    messageId: firstValue(data.id, data.messageId, data.key?.id) || null,
    status: firstValue(data.ackName, data.ack, data.status) || null,
    occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
    raw: data
  };
}

function scalarText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

function firstText(...values) {
  for (const value of values) {
    const text = scalarText(value);
    if (text) return text;
  }
  return '';
}

function readGptMakerIntentEvent(payload = {}) {
  const data = payload.data || payload.payload || payload.event || payload.body || payload;
  const contact = data.contact || data.contato || data.customer || data.cliente || payload.contact || payload.contato || {};
  const agent = data.agent || data.agente || payload.agent || payload.agente || {};
  const output = data.output || data.outputs || data.response || data.resposta || data.result || payload.output || payload.response || {};
  const input = data.input || data.inputs || data.message || data.mensagem || payload.input || payload.message || {};

  const rawPhone = firstText(
    payload.phone,
    payload.telefone,
    payload.whatsapp,
    payload.number,
    data.phone,
    data.telefone,
    data.whatsapp,
    data.number,
    data.remoteJid,
    contact.phone,
    contact.telefone,
    contact.whatsapp,
    contact.number,
    contact.remoteJid
  );

  const phone = normalizePhone(rawPhone);
  const intentName = firstText(
    payload.intent,
    payload.intencao,
    payload.intentName,
    payload.intent_name,
    data.intent,
    data.intencao,
    data.intentName,
    data.intent_name,
    output.intent,
    output.intencao,
    'Intencao da Ana'
  );
  const leadName = firstText(
    payload.name,
    payload.nome,
    payload.leadName,
    data.name,
    data.nome,
    data.leadName,
    contact.name,
    contact.nome,
    contact.pushName
  );
  const leadId = firstText(
    payload.leadId,
    payload.lead_id,
    payload.externalLeadId,
    data.leadId,
    data.lead_id,
    data.externalLeadId,
    contact.leadId,
    contact.id
  );
  const inboundText = firstText(
    payload.userMessage,
    payload.pergunta,
    payload.input,
    data.userMessage,
    data.pergunta,
    input.text,
    input.body,
    input.message,
    input.mensagem
  );
  const agentText = firstText(
    payload.agentMessage,
    payload.agentResponse,
    payload.resposta,
    payload.mensagem,
    payload.message,
    payload.text,
    data.agentMessage,
    data.agentResponse,
    data.resposta,
    data.mensagem,
    data.text,
    output.text,
    output.body,
    output.message,
    output.mensagem,
    output.answer,
    output.resposta
  );
  const eventId = firstText(
    payload.id,
    payload.eventId,
    payload.event_id,
    data.id,
    data.eventId,
    data.event_id,
    output.id
  );
  const address = firstText(
    payload.newAddress,
    payload.enderecoNovo,
    payload.address,
    payload.endereco,
    data.newAddress,
    data.enderecoNovo,
    data.address,
    data.endereco
  );
  const qualification = firstText(
    payload.qualification,
    payload.qualificacao,
    payload.classification,
    payload.classificacao,
    data.qualification,
    data.qualificacao,
    data.classification,
    data.classificacao,
    output.qualification,
    output.qualificacao,
    output.classification,
    output.classificacao
  );
  const summary = firstText(
    payload.summary,
    payload.resumo,
    data.summary,
    data.resumo,
    output.summary,
    output.resumo
  );
  const nextAction = firstText(
    payload.nextAction,
    payload.proximaAcao,
    payload.proxima_acao,
    data.nextAction,
    data.proximaAcao,
    data.proxima_acao,
    output.nextAction,
    output.proximaAcao,
    output.proxima_acao
  );

  return {
    phone,
    rawPhone,
    intentName,
    leadName,
    leadId,
    inboundText,
    agentText,
    address,
    qualification,
    summary,
    nextAction,
    eventId,
    agentName: firstText(agent.name, agent.nome, payload.agentName, data.agentName, 'Ana'),
    raw: payload
  };
}

function webhookDiagnostics(request, payload, event) {
  const data = payload?.data || payload?.msg || payload?.message || payload?.messages?.[0] || payload?.ticket || payload || {};
  return {
    contentType: request.headers['content-type'] || null,
    bodyType: typeof request.body,
    topKeys: Object.keys(payload || {}).slice(0, 12),
    dataKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 16) : [],
    msgKeys: payload?.msg && typeof payload.msg === 'object' ? Object.keys(payload.msg).slice(0, 16) : [],
    ticketKeys: payload?.ticket && typeof payload.ticket === 'object' ? Object.keys(payload.ticket).slice(0, 16) : [],
    event: event.event,
    channelId: event.channelId,
    phone: event.phone,
    fromMe: event.fromMe,
    status: event.status,
    hasText: Boolean(event.text)
  };
}

function externalLeadId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function findLeadReference({ leadId, phone }) {
  const leadSelect = { id: true, externalId: true, name: true, phone: true, address: true, newAddress: true, district: { select: { name: true } } };
  const numericLeadId = externalLeadId(leadId);
  if (numericLeadId) {
    const lead = await prisma.lead.findFirst({
      where: { externalId: numericLeadId },
      select: leadSelect
    });
    if (lead) return lead;
  }

  const textLeadId = String(leadId || '').trim();
  if (textLeadId && !numericLeadId && !textLeadId.startsWith('manual-')) {
    const lead = await prisma.lead.findUnique({
      where: { id: textLeadId },
      select: leadSelect
    }).catch(() => null);
    if (lead) return lead;
  }

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    const lead = await prisma.lead.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: { contains: normalizedPhone.slice(-10) } },
          { phone: { contains: normalizedPhone.slice(-11) } }
        ]
      },
      select: leadSelect
    });
    if (lead) return lead;
  }

  return null;
}

function normalizedIntentName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function confirmsRegisteredAddress(value) {
  const answer = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(sim|s|isso|correto|certo|esta correto|esta certo|sim esta correto|sim esta certo|continua o mesmo|e o mesmo|o mesmo|pode ser|confirmo)$/.test(answer)) return true;
  return /\b(sim|correto|confirmo)\b/.test(answer)
    && /\b(mesmo|igual|endereco|dados)\b/.test(answer)
    && !/\b(mudou|mudei|novo|diferente|incorreto)\b/.test(answer);
}

function plausibleNewAddress(value) {
  const address = String(value || '').replace(/\s+/g, ' ').trim();
  const hasAddressMarker = /(rua|avenida|av\.?|travessa|alameda|rodovia|estrada|praca|praça|lote|quadra|bairro|cep)/i.test(address);
  const hasStreetAndNumber = address.length >= 15 && /\p{L}/u.test(address) && /\d/.test(address);
  if (address.length < 8 || confirmsRegisteredAddress(address) || (!hasAddressMarker && !hasStreetAndNumber)) return '';
  return address.slice(0, 500);
}

async function registeredAddressState(lead) {
  if (!lead) return { hasAddress: false, source: null };

  if (String(lead.newAddress || '').trim()) {
    return { hasAddress: true, source: 'updated' };
  }

  const recentUpdates = await prisma.leadInteraction.findMany({
    where: { leadId: lead.id, channel: 'SISTEMA' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { metadata: true }
  }).catch(() => []);
  const hasNewAddress = recentUpdates.some((interaction) => {
    const metadata = interaction?.metadata;
    return metadata && typeof metadata === 'object'
      && metadata.type === 'ANA_ADDRESS_UPDATE'
      && Boolean(String(metadata.newAddress || '').trim());
  });

  return {
    hasAddress: hasNewAddress || Boolean(String(lead.address || '').trim()),
    source: hasNewAddress ? 'updated' : (lead.address ? 'original' : null)
  };
}

async function anaGiftWasOffered(event) {
  const normalizedPhone = normalizePhone(event.phone);
  if (!normalizedPhone) return false;

  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { phone: normalizedPhone },
    select: {
      messages: {
        where: { direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { body: true }
      }
    }
  }).catch(() => null);
  const history = (conversation?.messages || []).map((message) => message.body).join(' ');
  return /(brinde|presente).*(19 de setembro|dia 19)|(19 de setembro|dia 19).*(brinde|presente)/i.test(history);
}

function explicitContactOptOut(value) {
  return /(pare de (me )?(mandar|enviar)|nao (me )?(mande|envie|procure|contate)|não (me )?(mande|envie|procure|contate)|remova meu (numero|número|contato)|quero sair|cancele meu contato|nao quero mais mensagens|não quero mais mensagens)/i.test(String(value || ''));
}

function anaGiftOfferReply(name) {
  const firstName = String(name || '').trim().split(/\s+/)[0];
  const greetingName = firstName ? `, ${firstName}` : '';
  return `Que bom${greetingName}! A Novo Tempo preparou um brinde especial para você. Gostaríamos de entregá-lo no sábado, dia 19 de setembro, pela parte da tarde, por meio de um representante da nossa equipe. Você gostaria de receber esse brinde em casa?`;
}

async function anaIntentReply(event) {
  const intent = normalizedIntentName(event.intentName);
  const lead = await findLeadReference({ leadId: event.leadId, phone: event.phone });
  const addressState = await registeredAddressState(lead);
  const firstName = String(lead?.name || event.leadName || '').trim().split(/\s+/)[0];
  const greetingName = firstName ? `, ${firstName}` : '';

  const giftWasOffered = await anaGiftWasOffered(event);
  const currentGiftContext = /(brinde|presente|entrega.*casa|receber.*casa)/i.test(event.inboundText);

  if (intent.includes('registrar interesse') || intent.includes('interesse em continuar')) {
    if (!giftWasOffered && !currentGiftContext) {
      return {
        action: 'OFFER_GIFT',
        reply: anaGiftOfferReply(lead?.name || event.leadName),
        leadFound: Boolean(lead),
        hasRegisteredAddress: addressState.hasAddress,
        addressShouldBeHidden: true
      };
    }

    return {
      action: addressState.hasAddress ? 'CONFIRM_REGISTERED_ADDRESS' : 'REQUEST_NEW_ADDRESS',
      reply: addressState.hasAddress
        ? 'Que bom! 😊 Temos seu endereço em nossos dados. Ele continua o mesmo para receber o brinde?'
        : 'Que bom! 😊 Para organizarmos a entrega do brinde, pode me informar seu endereço completo?',
      leadFound: Boolean(lead),
      hasRegisteredAddress: addressState.hasAddress,
      addressShouldBeHidden: true
    };
  }

  if (intent.includes('encerrar contato') || intent.includes('finalizar contato')) {
    if (explicitContactOptOut(event.inboundText)) {
      return {
        action: 'END_CONTACT',
        reply: `Tudo bem${greetingName}. Respeitaremos seu pedido e não enviaremos novas mensagens. Deus abençoe você e sua família.`,
        leadFound: Boolean(lead),
        hasRegisteredAddress: addressState.hasAddress,
        addressShouldBeHidden: true
      };
    }

    if (!giftWasOffered) {
      return {
        action: 'OFFER_GIFT_BEFORE_ENDING',
        reply: anaGiftOfferReply(lead?.name || event.leadName),
        leadFound: Boolean(lead),
        hasRegisteredAddress: addressState.hasAddress,
        addressShouldBeHidden: true
      };
    }

    return {
      action: 'END_AFTER_GIFT_DECISION',
      reply: `Tudo bem${greetingName}. Agradeço por conversar conosco. Deus abençoe você e sua família.`,
      leadFound: Boolean(lead),
      hasRegisteredAddress: addressState.hasAddress,
      addressShouldBeHidden: true
    };
  }

  if (intent.includes('registrar endereco')) {
    const explicitAddress = plausibleNewAddress(event.address);
    const informedAddress = explicitAddress || plausibleNewAddress(event.inboundText);
    const confirmedExisting = confirmsRegisteredAddress(event.inboundText) && addressState.hasAddress;

    if (lead && informedAddress) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { newAddress: informedAddress }
      });
      await prisma.leadInteraction.create({
        data: {
          leadId: lead.id,
          channel: 'SISTEMA',
          summary: 'Endereco atualizado pela Ana para a entrega do brinde.',
          metadata: {
            type: 'ANA_ADDRESS_UPDATE',
            newAddress: informedAddress,
            previousAddressPresent: Boolean(String(lead.address || '').trim()),
            source: 'gpt-maker-intention'
          }
        }
      });
    } else if (lead && confirmedExisting) {
      await prisma.leadInteraction.create({
        data: {
          leadId: lead.id,
          channel: 'SISTEMA',
          summary: 'Endereco existente confirmado para a entrega do brinde.',
          metadata: {
            type: 'ANA_ADDRESS_CONFIRMATION',
            source: 'gpt-maker-intention'
          }
        }
      });
    }

    if (!informedAddress && !confirmedExisting) {
      return {
        action: addressState.hasAddress ? 'CONFIRM_REGISTERED_ADDRESS' : 'REQUEST_NEW_ADDRESS',
        reply: addressState.hasAddress
          ? 'Temos seu endereço em nossos dados. Ele continua o mesmo para receber o brinde?'
          : 'Pode me informar seu endereço completo para organizarmos a entrega do brinde?',
        leadFound: Boolean(lead),
        hasRegisteredAddress: addressState.hasAddress,
        addressShouldBeHidden: true,
        addressSaved: false
      };
    }

    return {
      action: 'CONFIRM_GIFT_DELIVERY',
      reply: `Perfeito${greetingName}. Só para confirmar: no sábado, dia 19 de setembro, pela parte da tarde, um representante da Novo Tempo irá até sua casa para entregar o seu brinde em mãos. Deus abençoe você e sua família.`,
      leadFound: Boolean(lead),
      hasRegisteredAddress: true,
      addressShouldBeHidden: true,
      addressSaved: Boolean(lead && informedAddress),
      existingAddressConfirmed: Boolean(confirmedExisting)
    };
  }

  return null;
}

function providerMessageId(data) {
  return data?.id
    || data?.messageId
    || data?.key?.id
    || data?.Info?.ID
    || data?.info?.id
    || data?.data?.id
    || data?.data?.messageId
    || data?.data?.Info?.ID
    || data?.data?.info?.id
    || null;
}

function normalizeProviderStatus(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;

  const raw = String(value).trim();
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const numericAck = raw.match(/^(?:ack\D*)?(-?\d+)$/i)?.[1];
  if (normalized === '-1' || /(^|_)(error|failed|failure|rejected|undeliverable|nack)(_|$)/.test(normalized)) {
    return normalized.includes('463') ? 'FAILED_463' : 'FAILED';
  }
  if (normalized.includes('463')) return 'FAILED_463';
  if (numericAck === '4' || normalized.includes('played')) return 'READ';
  if (numericAck === '3' || normalized.includes('read')) return 'READ';
  if (numericAck === '2' || normalized.includes('delivered') || normalized.includes('delivery')) return 'DELIVERED';
  if (numericAck === '1' || normalized.includes('server_ack') || normalized === 'sent') return 'SERVER_ACK';
  if (numericAck === '0' || normalized.includes('pending') || normalized.includes('queued') || normalized.includes('accepted')) return 'ACCEPTED';
  return raw.toUpperCase();
}

function recognizedDeliveryStatus(value) {
  const normalized = normalizeProviderStatus(value);
  return ['ACCEPTED', 'SERVER_ACK', 'DELIVERED', 'READ', 'FAILED', 'FAILED_463'].includes(normalized)
    ? normalized
    : null;
}

function providerResponseDeliveryStatus(data = {}) {
  const nested = data?.data || {};
  const status = firstValue(
    data?.ack,
    data?.messageStatus,
    data?.deliveryStatus,
    data?.receiptStatus,
    data?.key?.status,
    nested?.ack,
    nested?.messageStatus,
    nested?.deliveryStatus,
    nested?.receiptStatus,
    nested?.key?.status
  );
  return recognizedDeliveryStatus(status) || 'ACCEPTED';
}

function providerFailureStatus(status, data) {
  const diagnostic = `${status || ''} ${JSON.stringify(data || {})}`;
  return diagnostic.includes('463') ? 'FAILED_463' : 'FAILED';
}

async function reconcileNearbyWhatsAppDuplicate({ message, occurredAt }) {
  if (!message || !['waha-gows', 'gpt-maker'].includes(message.provider)) {
    return { message, created: true };
  }

  const eventTime = occurredAt instanceof Date && !Number.isNaN(occurredAt.getTime())
    ? occurredAt
    : new Date();
  const timeField = message.direction === 'INBOUND' ? 'receivedAt' : 'sentAt';
  const nearby = await prisma.whatsAppMessage.findMany({
    where: {
      conversationId: message.conversationId,
      direction: message.direction,
      provider: { in: ['waha-gows', 'gpt-maker'] },
      [timeField]: {
        gte: new Date(eventTime.getTime() - 2000),
        lte: new Date(eventTime.getTime() + 2000)
      }
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 20
  }).catch(() => []);
  const signature = normalizeMessageSignature(message.body);
  const duplicates = nearby.filter((candidate) => (
    normalizeMessageSignature(candidate.body) === signature
  ));
  if (duplicates.length < 2) return { message, created: true };

  const canonical = duplicates[0];
  const wahaMessage = duplicates.find((candidate) => candidate.provider === 'waha-gows');
  const aiMessage = duplicates.find((candidate) => candidate.senderType === 'AI');
  const mergedMetadata = duplicates.reduce((result, candidate) => ({
    ...result,
    ...(candidate.metadata && typeof candidate.metadata === 'object' ? candidate.metadata : {})
  }), {});
  const merged = await prisma.whatsAppMessage.update({
    where: { id: canonical.id },
    data: {
      provider: wahaMessage?.provider || canonical.provider,
      providerMessageId: wahaMessage?.providerMessageId || canonical.providerMessageId,
      providerStatus: wahaMessage?.providerStatus || canonical.providerStatus,
      senderType: aiMessage?.senderType || canonical.senderType,
      senderName: aiMessage?.senderName || canonical.senderName,
      metadata: mergedMetadata
    }
  }).catch(() => canonical);

  await prisma.whatsAppMessage.deleteMany({
    where: { id: { in: duplicates.slice(1).map((candidate) => candidate.id) } }
  }).catch(() => null);

  return { message: merged, created: canonical.id === message.id };
}

async function recordWhatsAppMessage({
  phone,
  body,
  direction,
  senderType,
  senderName = null,
  leadId = null,
  leadName = null,
  district = null,
  provider = 'zpro-baileys',
  providerStatus = null,
  providerResponse = null,
  providerMessageId: messageId = null,
  occurredAt = new Date(),
  metadata = {}
}) {
  const normalizedPhone = normalizePhone(phone);
  const cleanBody = String(body || '').trim();
  if (!normalizedPhone || !cleanBody) return null;

  const lead = await findLeadReference({ leadId, phone: normalizedPhone });
  const numericLeadId = externalLeadId(leadId) || lead?.externalId || null;
  const dbLeadId = lead?.id || null;
  const nextLeadName = lead?.name || leadName || null;
  const nextDistrict = lead?.district?.name || district || null;

  const conversation = await prisma.whatsAppConversation.upsert({
    where: { phone: normalizedPhone },
    create: {
      phone: normalizedPhone,
      leadId: dbLeadId,
      externalLeadId: numericLeadId,
      leadName: nextLeadName,
      district: nextDistrict
    },
    update: {
      ...(dbLeadId ? { leadId: dbLeadId } : {}),
      ...(numericLeadId ? { externalLeadId: numericLeadId } : {}),
      ...(nextLeadName ? { leadName: nextLeadName } : {}),
      ...(nextDistrict ? { district: nextDistrict } : {})
    }
  });

  if (messageId) {
    const existingMessage = await prisma.whatsAppMessage.findFirst({
      where: { providerMessageId: messageId },
      include: { conversation: true }
    }).catch(() => null);
    if (existingMessage) {
      const existingMetadata = existingMessage.metadata && typeof existingMessage.metadata === 'object'
        ? existingMessage.metadata
        : {};
      const incomingEvent = String(metadata?.event || '').toLowerCase();
      const existingEvent = String(existingMetadata.event || '').toLowerCase();
      const shouldRelink = provider === 'waha-gows'
        && existingMessage.conversationId !== conversation.id
        && (incomingEvent === 'message' || !existingEvent);
      const updatedMessage = await prisma.whatsAppMessage.update({
        where: { id: existingMessage.id },
        data: {
          ...(shouldRelink ? {
            conversationId: conversation.id,
            leadId: dbLeadId,
            externalLeadId: numericLeadId,
            direction,
            senderType,
            senderName,
            body: cleanBody,
            sentAt: direction === 'OUTBOUND' ? occurredAt : null,
            receivedAt: direction === 'INBOUND' ? occurredAt : null
          } : {}),
          providerStatus: providerStatus || existingMessage.providerStatus,
          metadata: {
            ...existingMetadata,
            ...metadata,
            providerResponse: providerResponse || existingMessage.metadata?.providerResponse || null
          }
        }
      }).catch(() => existingMessage);
      const activeConversation = shouldRelink ? conversation : existingMessage.conversation || conversation;
      await prisma.whatsAppConversation.update({
        where: { id: activeConversation.id },
        data: { updatedAt: occurredAt }
      }).catch(() => null);
      return { conversation: activeConversation, message: updatedMessage, created: false };
    }
  }

  const createdMessage = await prisma.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      leadId: dbLeadId,
      externalLeadId: numericLeadId,
      direction,
      senderType,
      senderName,
      body: cleanBody,
      provider,
      providerMessageId: messageId,
      providerStatus,
      metadata: {
        ...metadata,
        providerResponse: providerResponse || null
      },
      sentAt: direction === 'OUTBOUND' ? occurredAt : null,
      receivedAt: direction === 'INBOUND' ? occurredAt : null
    }
  });

  const reconciled = await reconcileNearbyWhatsAppDuplicate({
    message: createdMessage,
    occurredAt
  });
  const message = reconciled.message;

  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: occurredAt }
  }).catch(() => null);

  if (!reconciled.created) {
    return { conversation, message, created: false };
  }

  if (dbLeadId && direction === 'INBOUND') {
    await prisma.leadInteraction.create({
      data: {
        leadId: dbLeadId,
        channel: 'WHATSAPP',
        summary: cleanBody,
        metadata: {
          conversationId: conversation.id,
          messageId: message.id,
          provider,
          providerMessageId: messageId
        }
      }
    }).catch(() => null);
  }

  if (direction === 'INBOUND') {
    const previousOutbound = await prisma.whatsAppMessage.findFirst({
      where: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        providerStatus: { in: ['ACCEPTED', 'SERVER_ACK', 'PENDING', 'QUEUED', 'SENT'] },
        createdAt: { lt: message.createdAt }
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    }).catch(() => null);

    if (previousOutbound?.id) {
      await prisma.whatsAppMessage.update({
        where: { id: previousOutbound.id },
        data: {
          providerStatus: 'DELIVERED_BY_REPLY',
          metadata: {
            deliveredByReply: true,
            deliveredByReplyMessageId: message.id,
            deliveredByReplyAt: message.createdAt
          }
        }
      }).catch(() => null);
    }
  }

  return { conversation, message, created: true };
}

function normalizePhone(value) {
  const raw = cleanWhatsAppJid(value);
  if (!raw) return '';

  // Aceita apenas a pontuacao comum de um unico telefone. Campos com texto,
  // ramal, barras, ponto e virgula ou mais de um "+" precisam ser corrigidos.
  if (/[^\d\s()+.-]/.test(raw)) return '';
  const plusSigns = raw.match(/\+/g)?.length || 0;
  if (plusSigns > 1 || (plusSigns === 1 && !raw.startsWith('+'))) return '';

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return '';
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

function normalizedPhonesFromValue(value) {
  const direct = normalizePhone(value);
  if (direct) return [direct];

  return Array.from(new Set(String(value || '')
    .split(/(?=\+)|[;,/|]+/)
    .map((item) => normalizePhone(item))
    .filter(Boolean)));
}

function storedPhoneMatches(value, phone) {
  const target = normalizePhone(phone);
  if (!target) return false;
  const suffix = target.slice(-10);
  return normalizedPhonesFromValue(value).some((candidate) => (
    candidate === target || candidate.endsWith(suffix)
  ));
}

const whatsappLeadSelect = {
  id: true,
  externalId: true,
  name: true,
  phone: true,
  address: true,
  newAddress: true,
  priority: true,
  score: true,
  isVip: true,
  hasActiveStudy: true,
  district: { select: { name: true } },
  association: { select: { name: true, slug: true } }
};

function serializeWhatsAppLead(lead) {
  const phone = normalizedPhonesFromValue(lead?.phone)[0] || '';
  return {
    id: lead?.id || null,
    externalId: lead?.externalId || null,
    name: lead?.name || null,
    phone,
    storedPhone: lead?.phone || null,
    address: lead?.address || null,
    newAddress: lead?.newAddress || null,
    district: lead?.district?.name || null,
    priority: lead?.priority || null,
    score: lead?.score == null ? null : Number(lead.score),
    isVip: Boolean(lead?.isVip),
    hasActiveStudy: Boolean(lead?.hasActiveStudy),
    association: lead?.association || null
  };
}

function applyPathParams(pathValue, params) {
  return String(pathValue || '').replace(/\{(\w+)\}/g, (_match, key) => encodeURIComponent(params[key] || ''));
}

function normalizeApiToken(value) {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

function zproConfig() {
  const baseUrl = String(process.env.ZPRO_API_URL || '').trim().replace(/\/+$/, '');
  const token = normalizeApiToken(process.env.ZPRO_API_TOKEN);
  const channelId = String(process.env.ZPRO_CHANNEL_ID || '').trim();
  const apiId = String(process.env.ZPRO_API_ID || process.env.ZPRO_CHANNEL_ID || '').trim();
  const sendPath = String(process.env.ZPRO_SEND_TEXT_PATH || '/v2/api/external/{apiId}').trim();
  const sendMediaPath = String(process.env.ZPRO_SEND_MEDIA_PATH || '/v2/api/external/{apiId}/base64').trim();
  return { baseUrl, token, channelId, apiId, sendPath, sendMediaPath };
}

function whatsappProvider() {
  return 'waha';
}

function wahaConfig() {
  return {
    baseUrl: String(process.env.WAHA_API_URL || '').trim().replace(/\/+$/, ''),
    apiKey: normalizeApiToken(process.env.WAHA_API_KEY),
    session: String(process.env.WAHA_SESSION || 'default').trim() || 'default'
  };
}

function gptMakerConfig() {
  const apiToken = normalizeApiToken(
    process.env.GPTMAKER_API_TOKEN
    || process.env.GPTMAKER_API_KEY
    || process.env.GPT_MAKER_API_TOKEN
  );
  const agentId = String(process.env.GPTMAKER_AGENT_ID || '').trim();
  const autoReplyEnabled = String(process.env.GPTMAKER_AUTO_REPLY || 'true').toLowerCase() !== 'false';
  return {
    name: process.env.GPTMAKER_AGENT_NAME || 'Ana',
    provider: 'gpt-maker',
    configured: Boolean(apiToken && agentId),
    autoReplyEnabled,
    baseUrl: String(process.env.GPTMAKER_API_URL || 'https://api.gptmaker.ai').trim().replace(/\/+$/, ''),
    agentId,
    workspaceId: String(process.env.GPTMAKER_WORKSPACE_ID || '').trim() || null,
    apiToken: { loaded: Boolean(apiToken) }
  };
}

function gptMakerTrainingStatus() {
  const config = gptMakerConfig();
  return {
    loaded: config.configured,
    managedExternally: true,
    provider: 'gpt-maker',
    files: []
  };
}

function anaConfig() {
  const apiKey = normalizeApiToken(process.env.ASSISTENTE_ANA || process.env.ANA_API_KEY);
  const autoReplyEnabled = String(process.env.ASSISTENTE_ANA_AUTO_REPLY || 'false').toLowerCase() === 'true';
  const modelEnabled = String(process.env.ASSISTENTE_ANA_USE_MODEL || 'true').toLowerCase() !== 'false';
  return {
    name: 'Ana',
    provider: 'openai-responses',
    configured: Boolean(apiKey),
    autoReplyEnabled,
    modelEnabled,
    model: process.env.ANA_MODEL || 'gpt-4.1-mini',
    apiKey: tokenDiagnostic(apiKey)
  };
}

function resolveAnaSequenceGuidePath() {
  const configured = String(process.env.ANA_SEQUENCE_GUIDE_PATH || '').trim();
  const candidates = [
    configured && (path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)),
    path.resolve(process.cwd(), '..', ANA_SEQUENCE_GUIDE_FILE),
    path.resolve(process.cwd(), ANA_SEQUENCE_GUIDE_FILE)
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[1];
}

function resolveAnaTrainingDir() {
  const configured = String(process.env.ANA_TRAINING_DIR || '').trim();
  const candidates = [
    configured && (path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)),
    path.resolve(process.cwd(), '..', ANA_TRAINING_DIR),
    path.resolve(process.cwd(), ANA_TRAINING_DIR)
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[1];
}

async function readAnaGuideSource(sourcePath, title) {
  const stat = await fsp.stat(sourcePath);
  const text = await fsp.readFile(sourcePath, 'utf8');
  return {
    path: sourcePath,
    title,
    fileName: path.basename(sourcePath),
    bytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
    mtimeMs: stat.mtimeMs,
    text
  };
}

async function readAnaSequenceGuide() {
  const guidePath = resolveAnaSequenceGuidePath();
  const trainingDir = resolveAnaTrainingDir();
  const sourceSpecs = [
    [guidePath, 'Manual consolidado obrigatorio da Ana'],
    ...ANA_TRAINING_FILES.map(([fileName, description]) => [path.join(trainingDir, fileName), description])
  ];
  const sources = [];
  for (const [sourcePath, title] of sourceSpecs) {
    try {
      sources.push(await readAnaGuideSource(sourcePath, title));
    } catch (error) {
      sources.push({
        path: sourcePath,
        title,
        fileName: path.basename(sourcePath),
        bytes: 0,
        updatedAt: null,
        mtimeMs: 0,
        text: '',
        error: error.message
      });
    }
  }
  const loadedSources = sources.filter((source) => source.text);
  const cacheKey = loadedSources
    .map((source) => `${source.path}:${source.mtimeMs}:${source.bytes}`)
    .join('|');
  if (
    anaSequenceGuideCache.cacheKey === cacheKey
    && anaSequenceGuideCache.text
  ) {
    return {
      path: guidePath,
      text: anaSequenceGuideCache.text,
      bytes: Buffer.byteLength(anaSequenceGuideCache.text, 'utf8'),
      updatedAt: anaSequenceGuideCache.sources
        .map((source) => source.updatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) || null,
      sources: anaSequenceGuideCache.sources
    };
  }

  const text = loadedSources.map((source) => [
    `# Fonte: ${source.fileName}`,
    `Descricao: ${source.title}`,
    '',
    source.text.trim()
  ].join('\n')).join('\n\n---\n\n');
  const sourceSummary = sources.map(({ text: _text, mtimeMs: _mtimeMs, ...source }) => ({
    ...source,
    loaded: Boolean(_text)
  }));
  anaSequenceGuideCache = {
    cacheKey,
    text,
    sources: sourceSummary,
    loadedAt: Date.now()
  };
  return {
    path: guidePath,
    text,
    bytes: Buffer.byteLength(text, 'utf8'),
    updatedAt: sourceSummary
      .map((source) => source.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null,
    sources: sourceSummary
  };
}

async function readAnaTrainingStatus() {
  const trainingDir = resolveAnaTrainingDir();
  const files = [
    [resolveAnaSequenceGuidePath(), 'Sequência específica: material bíblico e presente físico'],
    ...ANA_TRAINING_FILES
  ];

  const items = await Promise.all(files.map(async ([fileName, description]) => {
    const fullPath = path.isAbsolute(fileName) ? fileName : path.join(trainingDir, fileName);
    try {
      const stat = await fsp.stat(fullPath);
      return {
        fileName: path.basename(fileName),
        description,
        loaded: true,
        path: fullPath,
        bytes: stat.size,
        updatedAt: stat.mtime.toISOString()
      };
    } catch {
      return {
        fileName: path.basename(fileName),
        description,
        loaded: false,
        path: fullPath,
        bytes: 0,
        updatedAt: null
      };
    }
  }));
  const sequenceItem = items[0];
  const sourceItems = items.slice(1);
  const sourceTrainingLoaded = sourceItems.length > 0 && sourceItems.every((item) => item.loaded);
  if (sequenceItem && !sequenceItem.loaded && sourceTrainingLoaded) {
    sequenceItem.loaded = true;
    sequenceItem.generated = true;
    sequenceItem.description = `${sequenceItem.description} (gerado pelos arquivos V3 carregados)`;
    sequenceItem.path = resolveAnaSequenceGuidePath();
    sequenceItem.bytes = sourceItems.reduce((total, item) => total + (item.bytes || 0), 0);
    sequenceItem.updatedAt = sourceItems
      .map((item) => item.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
  }

  return {
    loaded: items.every((item) => item.loaded),
    directory: trainingDir,
    files: items
  };
}

function compactText(value, fallback = 'Sem mensagem registrada.') {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}

function normalizeMessageSignature(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function dedupeWhatsAppMessageList(messages = []) {
  const result = [];
  for (const message of messages) {
    const eventTime = new Date(message.receivedAt || message.sentAt || message.createdAt).getTime();
    const signature = `${message.direction}:${normalizeMessageSignature(message.body)}`;
    const duplicateIndex = result.findLastIndex((candidate) => {
      if (!['waha-gows', 'gpt-maker'].includes(candidate.provider)) return false;
      const candidateTime = new Date(candidate.receivedAt || candidate.sentAt || candidate.createdAt).getTime();
      return `${candidate.direction}:${normalizeMessageSignature(candidate.body)}` === signature
        && Math.abs(candidateTime - eventTime) <= 2000;
    });
    if (duplicateIndex < 0 || !['waha-gows', 'gpt-maker'].includes(message.provider)) {
      result.push(message);
      continue;
    }

    const existing = result[duplicateIndex];
    const wahaMessage = [existing, message].find((candidate) => candidate.provider === 'waha-gows');
    const aiMessage = [existing, message].find((candidate) => candidate.senderType === 'AI');
    result[duplicateIndex] = {
      ...existing,
      provider: wahaMessage?.provider || existing.provider,
      providerMessageId: wahaMessage?.providerMessageId || existing.providerMessageId,
      providerStatus: wahaMessage?.providerStatus || existing.providerStatus,
      senderType: aiMessage?.senderType || existing.senderType,
      senderName: aiMessage?.senderName || existing.senderName,
      metadata: {
        ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
        ...(message.metadata && typeof message.metadata === 'object' ? message.metadata : {})
      }
    };
  }
  return result;
}

function classifyAnaConversation(messages = []) {
  const inboundText = messages
    .filter((message) => message.direction === 'INBOUND')
    .map((message) => message.body)
    .join(' ')
    .toLowerCase();
  const outboundText = messages
    .filter((message) => message.direction === 'OUTBOUND')
    .map((message) => message.body)
    .join(' ')
    .toLowerCase();
  const fullText = `${inboundText} ${outboundText}`;

  if (/(parar|remover|cancelar|não quero|nao quero|sem interesse|sair)/i.test(fullText)) {
    return { label: 'Opt-out', tone: 'red', action: 'Respeitar pedido e encerrar contato.' };
  }
  if (/(suicid|me matar|morrer|desespero|abuso|violência|violencia|ameaça|ameaca|urgente)/i.test(fullText)) {
    return { label: 'Encaminhar humano', tone: 'red', action: 'Acionar responsável humano imediatamente.' };
  }
  if (/(visita|igreja|endereço|endereco|pastor|missionário|missionario|voluntário|voluntario)/i.test(fullText)) {
    return { label: 'Visita/igreja', tone: 'green', action: 'Encaminhar para gestor ou voluntário.' };
  }
  if (/(não recebi|nao recebi|ainda não|ainda nao|não chegou|nao chegou|mandar|envia|enviar)/i.test(fullText)) {
    return { label: 'Enviar material', tone: 'orange', action: 'Oferecer ou reenviar o material solicitado.' };
  }
  if (/(recebi|li|gostei|estudo|material|bíblia|biblia|oração|oracao|dúvida|duvida)/i.test(fullText)) {
    return { label: 'Acompanhar estudo', tone: 'blue', action: 'Continuar conversa acolhedora com base no tema.' };
  }
  return { label: 'Triagem', tone: 'slate', action: 'Classificar intenção antes da próxima resposta.' };
}

function gptMakerClassification(messages = []) {
  const qualificationMessage = [...messages].reverse().find((message) => {
    const metadata = message?.metadata;
    return metadata && typeof metadata === 'object' && (
      metadata.gptMakerQualification
      || metadata.intent
      || metadata.gptMakerAction
      || metadata.gptMakerSummary
    );
  });
  const metadata = qualificationMessage?.metadata || {};
  const rawLabel = String(metadata.gptMakerQualification || metadata.intent || '').trim();
  const actionCode = String(metadata.gptMakerAction || '').trim();
  const normalized = normalizedIntentName(`${rawLabel} ${actionCode}`);

  if (!rawLabel && !actionCode) {
    return {
      label: 'Aguardando GPT Maker',
      tone: 'slate',
      action: 'Aguardar a qualificacao enviada pelo agente do GPT Maker.',
      source: 'gpt-maker'
    };
  }
  if (/(opt.?out|encerrar contato|finalizar contato|end_contact)/i.test(normalized)) {
    return { label: 'Opt-out', tone: 'red', action: 'Respeitar pedido e encerrar contato.', source: 'gpt-maker' };
  }
  if (/(humano|human|transfer|sensivel|sensiveis|urgente)/i.test(normalized)) {
    return { label: 'Encaminhar humano', tone: 'red', action: 'Acionar responsavel humano.', source: 'gpt-maker' };
  }
  if (/(visita|igreja|voluntario|pastor|missionario)/i.test(normalized)) {
    return { label: 'Visita/igreja', tone: 'green', action: 'Encaminhar para gestor ou voluntario.', source: 'gpt-maker' };
  }
  if (/(endereco|address|entrega|brinde|presente)/i.test(normalized)) {
    return { label: 'Entrega/endereco', tone: 'orange', action: 'Conferir os dados para a entrega.', source: 'gpt-maker' };
  }
  if (/(material|estudo|biblia|interesse|continuar)/i.test(normalized)) {
    return { label: 'Acompanhar estudo', tone: 'blue', action: 'Continuar o acompanhamento indicado pelo agente.', source: 'gpt-maker' };
  }
  return {
    label: rawLabel || 'Qualificado',
    tone: 'blue',
    action: String(metadata.gptMakerNextAction || '').trim() || 'Seguir a orientacao registrada pelo GPT Maker.',
    source: 'gpt-maker'
  };
}

function summarizeAnaConversation(conversation) {
  const messages = conversation.messages || [];
  const inboundMessages = messages.filter((message) => message.direction === 'INBOUND');
  const aiMessages = messages.filter((message) => message.senderType === 'AI');
  const outboundMessages = messages.filter((message) => message.direction === 'OUTBOUND');
  const lastMessage = messages[messages.length - 1] || null;
  const lastInbound = inboundMessages[inboundMessages.length - 1] || null;
  const lastAi = aiMessages[aiMessages.length - 1] || null;
  const classification = gptMakerClassification(messages);
  const qualificationMessage = [...messages].reverse().find((message) => message?.metadata?.gptMakerSummary);
  const gptMakerSummary = String(qualificationMessage?.metadata?.gptMakerSummary || '').trim();

  return {
    id: conversation.id,
    phone: conversation.phone,
    leadName: conversation.leadName || conversation.lead?.name || 'Contato sem nome',
    district: conversation.district || conversation.lead?.district?.name || 'Distrito não vinculado',
    priority: conversation.leadPriority || conversation.lead?.priority || null,
    status: conversation.status,
    totalMessages: messages.length,
    inboundCount: inboundMessages.length,
    outboundCount: outboundMessages.length,
    aiCount: aiMessages.length,
    hasLeadReply: inboundMessages.length > 0,
    lastMessageAt: lastMessage?.createdAt || conversation.updatedAt,
    lastLeadMessage: compactText(lastInbound?.body),
    lastAnaMessage: compactText(lastAi?.body || outboundMessages[outboundMessages.length - 1]?.body),
    summary: gptMakerSummary || `${classification.label}: ${compactText(lastInbound?.body || lastMessage?.body)}`,
    classification,
    messages: messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      direction: message.direction,
      senderType: message.senderType,
      senderName: message.senderName,
      body: message.body,
      provider: message.provider,
      providerStatus: message.providerStatus,
      metadata: message.metadata,
      sentAt: message.sentAt,
      receivedAt: message.receivedAt,
      createdAt: message.createdAt
    }))
  };
}

function leadFirstName(value) {
  const first = String(value || '').trim().split(/\s+/)[0] || '';
  return /^(oi|olá|ola|bom|boa|bom dia|boa tarde|boa noite)$/i.test(first) ? '' : first;
}

function addressFromConversation(conversation) {
  const leadAddress = String(conversation?.lead?.newAddress || conversation?.lead?.address || '').replace(/\s+/g, ' ').trim();
  if (leadAddress && !/^n\/?i$|^nao informado$|^não informado$/i.test(leadAddress)) return leadAddress;
  const metadataAddress = (conversation?.messages || [])
    .map((message) => message.metadata?.leadAddress || message.metadata?.address)
    .find(Boolean);
  return String(metadataAddress || '').replace(/\s+/g, ' ').trim();
}

function materialFromConversation(conversation) {
  const metadataMaterial = [...(conversation?.messages || [])]
    .reverse()
    .map((message) => message.metadata?.material || message.metadata?.theme || message.metadata?.leadMaterial)
    .find(Boolean);
  return cleanTemplateVariable(metadataMaterial || inferLeadStudyTheme(conversation?.lead || {}), 'um material da Escola Bíblica Novo Tempo');
}

function anaNameText(name) {
  return name ? `${name}, ` : '';
}

function anaNameSuffix(name) {
  return name ? `, ${name}` : '';
}

function detectAnaReplyIntent(messageText) {
  const text = String(messageText || '').toLowerCase();
  if (/(parar|remover|cancelar|não quero|nao quero|sem interesse|sair)/i.test(text)) return 'optout';
  if (/(suicid|me matar|morrer|desespero|abuso|violência|violencia|ameaça|ameaca|urgente)/i.test(text)) return 'human';
  if (/(não lembro|nao lembro|quem é você|quem e voce|qual material|que material)/i.test(text)) return 'does_not_remember';
  if (/(visita|igreja|endereço|endereco|pastor|missionário|missionario|voluntário|voluntario)/i.test(text)) return 'visit';
  if (/(não recebi|nao recebi|ainda não|ainda nao|não chegou|nao chegou|não|nao)/i.test(text)) return 'not_received';
  if (/(recebi|chegou|consegui|sim|li|gostei)/i.test(text)) return 'received';
  return 'general';
}

function isAffirmativeReply(value) {
  return /\b(sim|s|claro|pode|quero|aceito|gostaria|isso|correto|certo|esse mesmo|essa mesma|ta certo|tá certo|esta certo|está certo|confirmo|ok)\b/i.test(String(value || ''));
}

function looksLikeAddress(value) {
  return /(rua|avenida|av\.|travessa|bairro|cep|n[ºo.]|numero|\d{2,})/i.test(String(value || ''));
}

function isNegativeReply(value) {
  const text = String(value || '').trim();
  if (/^n$/i.test(text)) return true;
  return /\b(não|nao|negativo|ainda não|ainda nao|não chegou|nao chegou|não recebi|nao recebi|nao quero|não quero|não pode|nao pode|não posso|nao posso|não precisa|nao precisa)\b/i.test(text);
}

function pickUnusedAnaReply(variants = [], historyText = '') {
  const normalizedHistory = String(historyText || '').toLowerCase();
  return variants.find((variant) => {
    const signature = String(variant || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
    return signature && !normalizedHistory.includes(signature.slice(0, 48));
  }) || variants[0] || '';
}

function anaHistoryIncludes(historyText, pattern) {
  return pattern.test(String(historyText || '').toLowerCase());
}

function inferLeadStudyTheme(lead) {
  const metadata = lead?.metadata && typeof lead.metadata === 'object' ? lead.metadata : {};
  return lead?.studyType
    || lead?.material
    || lead?.course
    || metadata.studyType
    || metadata.material
    || metadata.tema
    || metadata.tipo_estudo
    || 'estudos bíblicos';
}

function conversationMessagesForPrompt(messages = []) {
  return messages.slice(-16).map((message) => ({
    direction: message.direction,
    senderType: message.senderType,
    senderName: message.senderName || (message.direction === 'INBOUND' ? 'Lead' : 'Ana'),
    body: String(message.body || '').slice(0, 900),
    createdAt: message.createdAt
  }));
}

function inferAnaConversationState(conversation) {
  const messages = conversation?.messages || [];
  const fullHistory = messages.map((message) => message.body).join(' ').toLowerCase();
  const outboundHistory = messages
    .filter((message) => message.direction === 'OUTBOUND')
    .map((message) => message.body)
    .join(' ')
    .toLowerCase();
  const inboundHistory = messages
    .filter((message) => message.direction === 'INBOUND')
    .map((message) => message.body)
    .join(' ')
    .toLowerCase();
  const lastInbound = [...messages].reverse().find((message) => message.direction === 'INBOUND');
  const lastOutbound = [...messages].reverse().find((message) => message.direction === 'OUTBOUND');
  const address = addressFromConversation(conversation);

  return {
    initial_message_sent: /(material|escola biblica|escola bíblica|novo tempo)/i.test(outboundHistory),
    material_confirmado: /(recebi|chegou|consegui acessar|sim, chegou|sim chegou)/i.test(inboundHistory)
      ? 'sim'
      : /(não recebi|nao recebi|não chegou|nao chegou|ainda não|ainda nao)/i.test(inboundHistory)
        ? 'nao'
        : 'desconhecido',
    leu_material: /(li|olhei|gostei|dei uma olhada|chamou minha atenção|chamou minha atencao)/i.test(inboundHistory)
      ? 'sim'
      : /(não li|nao li|não olhei|nao olhei|ainda não li|ainda nao li)/i.test(inboundHistory)
        ? 'nao'
        : 'desconhecido',
    interesse_continuar: /(quero|tenho interesse|pode mandar|manda|gostaria|sim)/i.test(inboundHistory)
      ? 'sim'
      : /(não quero|nao quero|sem interesse|parar|cancelar|remover)/i.test(inboundHistory)
        ? 'nao'
        : 'desconhecido',
    convite_presente_enviado: /(presente|brinde|19 de setembro|dia 19)/i.test(outboundHistory),
    aceita_presente: /(quero receber|pode entregar|aceito|gostaria de receber|pode passar|sim.*presente|sim.*brinde)/i.test(inboundHistory)
      ? 'sim'
      : /(não quero|nao quero|não posso|nao posso|não precisa|nao precisa)/i.test(inboundHistory)
        ? 'nao'
        : 'desconhecido',
    possui_endereco_cadastrado: Boolean(address),
    endereco_confirmado: /(endereço está certo|endereco esta certo|esse mesmo|está correto|esta correto|pode ser nesse)/i.test(inboundHistory)
      ? 'sim'
      : 'desconhecido',
    representante_acionado: /(vou deixar registrado|equipe da novo tempo acompanhar|missionario conversar|missionário conversar)/i.test(outboundHistory),
    pausado: /(parar|remover|cancelar|não quero|nao quero|sair)/i.test(inboundHistory),
    ultima_pergunta_feita: lastOutbound?.body || null,
    ultima_resposta_recebida_em: lastInbound?.createdAt || null,
    proxima_acao: classifyAnaConversation(messages).action,
    resumo_historico: compactText(fullHistory, 'Sem historico anterior.')
  };
}

function buildAnaPrompt({ conversation, inboundMessage, guideText }) {
  const name = conversation?.leadName || conversation?.lead?.name || '';
  const firstName = leadFirstName(name);
  const material = materialFromConversation(conversation);
  const address = addressFromConversation(conversation);
  const district = conversation?.district || conversation?.lead?.district?.name || 'Distrito não vinculado';
  const lead = {
    nome_cadastrado: name || null,
    primeiro_nome_confiavel: firstName || null,
    telefone: conversation?.phone || null,
    distrito: district,
    material_solicitado: material,
    possui_endereco_cadastrado: Boolean(address),
    prioridade: conversation?.leadPriority || conversation?.lead?.priority || null
  };
  const state = inferAnaConversationState(conversation);

  return [
    'Você deve responder como a Ana, assistente virtual da Novo Tempo.',
    'Use o documento abaixo como manual obrigatório de comportamento e roteiro.',
    '',
    '=== MANUAL DA ANA ===',
    guideText,
    '',
    '=== DADOS DO LEAD ===',
    JSON.stringify(lead, null, 2),
    '',
    '=== ESTADO INFERIDO DA CONVERSA ===',
    JSON.stringify(state, null, 2),
    '',
    '=== HISTÓRICO RECENTE DA CONVERSA ===',
    JSON.stringify(conversationMessagesForPrompt(conversation?.messages || []), null, 2),
    '',
    '=== ÚLTIMA MENSAGEM RECEBIDA ===',
    String(inboundMessage?.body || ''),
    '',
    '=== TAREFA ===',
    'Gere apenas a próxima mensagem da Ana para WhatsApp.',
    'Não explique sua decisão.',
    'Não use Markdown.',
    'Não use listas.',
    'Faça no máximo uma pergunta principal.',
    'Se não houver nome confiável, não invente nome e não use "Oi" como nome.',
    'Não convide para o presente do dia 19 logo após a pessoa confirmar que recebeu o material.',
    'Antes de falar do presente, converse primeiro sobre o material: pergunte o que ela entendeu, quais pontos chamaram atenção e se gostaria de receber um próximo material semelhante.',
    'Somente depois dessas etapas fale que no sábado, 19 de setembro de 2026, à tarde, uma equipe da Novo Tempo entregará um material/brinde.',
    'Se ela aceitar o presente e houver endereço cadastrado, confirme o endereço citado. Se não houver endereço, peça o endereço completo.',
    'Quando a pessoa enviar o endereço completo, reconheça o endereço, agradeça e diga que passará para a equipe organizar a entrega com carinho. Não trate endereço como resposta negativa.'
  ].join('\n');
}

async function callAnaModel({ conversation, inboundMessage, guideText, config }) {
  const prompt = buildAnaPrompt({ conversation, inboundMessage, guideText });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.ANA_MODEL_TIMEOUT_MS || 18000));
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${normalizeApiToken(process.env.ASSISTENTE_ANA || process.env.ANA_API_KEY)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        {
          role: 'system',
          content: 'Você é a Ana da Novo Tempo. Siga estritamente o manual e responda somente com a mensagem final para WhatsApp.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      max_output_tokens: 220
    })
  }).finally(() => clearTimeout(timeout));

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Modelo da Ana respondeu com status ${response.status}`);
    error.providerStatus = response.status;
    error.providerResponse = payload;
    throw error;
  }

  const text = payload.output_text
    || payload.output?.flatMap((item) => item.content || [])
      .map((content) => content.text || '')
      .join('')
    || '';
  return String(text || '').trim();
}

function validateAnaReply(message, { conversation, inboundMessage }) {
  let clean = String(message || '').replace(/\r/g, '').trim();
  const fallback = buildAnaFallbackReply({ conversation, inboundMessage });
  if (!clean) return fallback;
  clean = clean.replace(/\*\*/g, '').replace(/^\s*Ana:\s*/i, '').trim();
  if (clean.length > 700) clean = fallback;
  if (/^(oi|olá|ola),?\s/i.test(clean) && !leadFirstName(conversation?.leadName || conversation?.lead?.name)) {
    clean = clean.replace(/^(oi|olá|ola),?\s*/i, '');
  }
  if (/\bOi\b[,!]*\s+(obrigad|fico|que|entendi|perfeito)/i.test(clean)) clean = fallback;

  const history = (conversation?.messages || []).map((item) => item.body).join(' ').toLowerCase();
  const alreadyAnsweredMaterial = /(recebi|chegou|chegou sim|material chegou)/i.test(history);
  const repeatsArrivalQuestion = /(material chegou|chegou até aí|chegou ate ai|chegou a receber|receber ou acessar)/i.test(clean);
  if (alreadyAnsweredMaterial && repeatsArrivalQuestion) clean = fallback;

  const askedUnderstanding = anaHistoryIncludes(history, /(o que você entendeu|o que voce entendeu|pontos importantes|chamou mais sua atenção|chamou mais sua atencao|conseguiu dar uma olhada|já conseguiu começar|ja conseguiu comecar)/i);
  const askedNextMaterial = anaHistoryIncludes(history, /(próximo material|proximo material|outro material|material semelhante|continuar recebendo|continuar esse estudo)/i);
  const giftTooEarly = /(19 de setembro|dia 19|presente|brinde|entrega especial)/i.test(clean)
    && (!askedUnderstanding || !askedNextMaterial);
  if (giftTooEarly) clean = fallback;

  const normalizedClean = clean.toLowerCase().replace(/\s+/g, ' ').trim();
  const repeated = (conversation?.messages || []).some((item) => {
    const previous = String(item.body || '').toLowerCase().replace(/\s+/g, ' ').trim();
    return item.direction === 'OUTBOUND' && previous && (
      previous === normalizedClean
      || previous.slice(0, 90) === normalizedClean.slice(0, 90)
    );
  });
  if (repeated) clean = fallback;

  const questionCount = (clean.match(/\?/g) || []).length;
  if (questionCount > 1) {
    const firstQuestionEnd = clean.indexOf('?');
    clean = clean.slice(0, firstQuestionEnd + 1).trim();
  }
  return clean;
}

async function buildAnaReply({ conversation, inboundMessage, config }) {
  let guide = null;
  let guideError = null;
  try {
    guide = await readAnaSequenceGuide();
  } catch (error) {
    guideError = { message: error.message };
    console.error('[ai:ana:guide:error]', error.message);
  }
  const fallback = buildAnaFallbackReply({ conversation, inboundMessage });
  if (!config.configured || String(process.env.ASSISTENTE_ANA_USE_MODEL || 'true').toLowerCase() === 'false') {
    return {
      message: validateAnaReply(fallback, { conversation, inboundMessage }),
      source: config.configured ? 'fallback' : 'fallback-no-api-key',
      guide,
      error: guideError
    };
  }

  try {
    const modelMessage = await callAnaModel({
      conversation,
      inboundMessage,
      guideText: guide?.text || '',
      config
    });
    return {
      message: validateAnaReply(modelMessage, { conversation, inboundMessage }),
      source: 'model',
      guide,
      error: guideError
    };
  } catch (error) {
    console.error('[ai:ana:model:error]', error.message);
    return {
      message: validateAnaReply(fallback, { conversation, inboundMessage }),
      source: 'fallback-after-model-error',
      guide,
      error: {
        message: error.message,
        providerStatus: error.providerStatus || null,
        guide: guideError
      }
    };
  }
}

function anaReplyDelayMs(message, inboundMessage) {
  const inboundLength = String(inboundMessage?.body || '').length;
  const outboundLength = String(message || '').length;
  const base = inboundLength <= 25 ? 4000 : inboundLength <= 140 ? 8000 : 15000;
  const calculated = base + Math.round(outboundLength / 25) * 1000;
  const sensitive = detectAnaReplyIntent(inboundMessage?.body) === 'human';
  const max = sensitive ? 35000 : 25000;
  return Math.min(Math.max(calculated, 4000), max);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendZproTypingIndicator(phone) {
  const typingPath = String(process.env.ZPRO_TYPING_PATH || '').trim();
  if (!typingPath) return { ok: false, skipped: true };
  const config = zproConfig();
  if (!config.baseUrl || !config.token || !config.apiId) return { ok: false, skipped: true };
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return { ok: false, skipped: true };
  const pathValue = applyPathParams(typingPath, {
    apiId: config.apiId,
    channelId: config.channelId || config.apiId,
    sessionId: config.channelId || config.apiId,
    phone: normalizedPhone,
    number: normalizedPhone
  });
  const url = pathValue.startsWith('http') ? pathValue : `${config.baseUrl}${pathValue.startsWith('/') ? '' : '/'}${pathValue}`;

  try {
    const providerResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: normalizedPhone,
        phone: normalizedPhone,
        to: normalizedPhone,
        typing: true,
        presence: 'composing',
        channelId: config.channelId || config.apiId,
        sessionId: config.channelId || config.apiId,
        bearertoken: config.token
      })
    });
    return { ok: providerResponse.ok, status: providerResponse.status };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function sendWahaTypingIndicator(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return { ok: false, skipped: true };
  const config = wahaConfig();
  try {
    await sendWahaRequest('/api/startTyping', {
      session: config.session,
      chatId: `${normalizedPhone}@c.us`
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function sendWhatsAppTypingIndicator(phone) {
  return whatsappProvider() === 'waha'
    ? sendWahaTypingIndicator(phone)
    : sendZproTypingIndicator(phone);
}

function buildAnaFallbackReply({ conversation, inboundMessage }) {
  const name = leadFirstName(conversation?.leadName || conversation?.lead?.name);
  const theme = materialFromConversation(conversation);
  const address = addressFromConversation(conversation);
  const inboundText = String(inboundMessage?.body || '').toLowerCase();
  const intent = detectAnaReplyIntent(inboundMessage?.body);
  const fullHistory = (conversation?.messages || []).map((message) => message.body).join(' ').toLowerCase();
  const alreadyAskedMaterialRead = /(dar uma olhada|chamou mais sua atenção|chamou mais sua atencao)/i.test(fullHistory);
  const alreadyAskedUnderstanding = /(o que você entendeu|o que voce entendeu|pontos importantes|chamou mais sua atenção|chamou mais sua atencao|qual parte fez mais sentido|já conseguiu começar|ja conseguiu comecar)/i.test(fullHistory);
  const alreadyAskedNextMaterial = /(próximo material|proximo material|outro material|material semelhante|continuar recebendo|continuar esse estudo)/i.test(fullHistory);
  const alreadyOfferedGift = /(presente físico|presente fisico|19 de setembro)/i.test(fullHistory);
  const alreadyAskedAddress = /(endereço em nossos registros|endereco em nossos registros|esse ainda é o melhor endereço|esse ainda e o melhor endereco|o seu endereço é|o seu endereco e)/i.test(fullHistory);
  const alreadyConfirmedDelivery = /(entrega no dia 19 de setembro|entregar o presente em mãos|entregar o presente em maos|representantes para esse fim|receber os representantes)/i.test(fullHistory);
  const alreadyAskedCanReceive = /(você poderá receber os representantes|voce podera receber os representantes|você poderá receber esse material|voce podera receber esse material|poderá receber esse material|podera receber esse material)/i.test(fullHistory);
  const acceptedGift = alreadyOfferedGift && !alreadyAskedAddress && (isAffirmativeReply(inboundText) || /(quero receber|pode entregar|aceito|gostaria de receber|sim.*presente|sim.*brinde)/i.test(inboundText));
  const confirmedAddress = alreadyAskedAddress && !alreadyConfirmedDelivery && isAffirmativeReply(inboundText);
  const deniedAddress = alreadyAskedAddress && !alreadyConfirmedDelivery && isNegativeReply(inboundText);
  const confirmedVisit = alreadyAskedCanReceive && isAffirmativeReply(inboundText);
  const sentAddress = alreadyAskedAddress
    && !alreadyConfirmedDelivery
    && !isAffirmativeReply(inboundText)
    && !isNegativeReply(inboundText)
    && looksLikeAddress(inboundText);

  if (intent === 'optout') {
    return `Tudo bem${anaNameSuffix(name)}, sem problema nenhum. Vou respeitar seu pedido e encerrar o contato por aqui. Deus te abençoe! 🙏`;
  }
  if (intent === 'human') {
    return `${anaNameText(name)}obrigada por me contar. Esse assunto merece uma atenção mais cuidadosa, então vou deixar registrado para alguém da equipe Novo Tempo acompanhar com carinho.`;
  }
  if (confirmedVisit) {
    return `Muito obrigado${anaNameSuffix(name)}. Então fica combinado: no sábado, dia 19 de setembro de 2026, pela parte da tarde, um representante da equipe Novo Tempo irá até você para entregar esse material especial em suas mãos.`;
  }
  if (confirmedAddress) {
    return `Perfeito${anaNameSuffix(name)}. Então vou deixar combinado: no dia 19 de setembro de 2026, pela parte da tarde, um representante da Novo Tempo levará o presente até você.\n\nVocê poderá receber os representantes nesse horário?`;
  }
  if (deniedAddress) {
    return `Obrigado por avisar${anaNameSuffix(name)}. Para eu registrar certinho a entrega do presente no dia 19 de setembro de 2026, você pode me enviar seu endereço completo atual?`;
  }
  if (sentAddress) {
    return `Perfeito${anaNameSuffix(name)}, recebi seu endereço. Muito obrigado por enviar.\n\nVou deixar registrado e passar para a equipe da Novo Tempo organizar essa entrega com carinho. No sábado, dia 19 de setembro de 2026, pela parte da tarde, o representante levará esse material especial até você.`;
  }
  if (acceptedGift) {
    if (address) {
      return `Perfeito${anaNameSuffix(name)}. Temos seu endereço em nossos dados. Ele continua o mesmo para você receber o presente?`;
    }
    return `Que bom${anaNameSuffix(name)}. Para organizar a entrega do presente no dia 19 de setembro de 2026, você pode me enviar seu endereço atual completo?`;
  }
  if (alreadyAskedUnderstanding && !alreadyAskedNextMaterial && !isNegativeReply(inboundText)) {
    return pickUnusedAnaReply([
      `Obrigado por compartilhar${anaNameSuffix(name)}. É muito bom saber como você está acompanhando.\n\nVocê gostaria de receber um próximo material semelhante para continuar esse estudo?`,
      `Entendi${anaNameSuffix(name)}. Fico feliz que você já teve contato com o conteúdo.\n\nVocê gostaria que a Novo Tempo te enviasse outro material nessa mesma linha?`,
      `Que bom${anaNameSuffix(name)}. A ideia é caminhar com você aos poucos.\n\nVocê gostaria de continuar recebendo orientação e materiais da Escola Bíblica Novo Tempo?`
    ], fullHistory);
  }
  if (alreadyAskedNextMaterial && !alreadyOfferedGift) {
    if (isNegativeReply(inboundText)) {
      return `Tudo bem${anaNameSuffix(name)}. Vou deixar seu retorno registrado com carinho para a equipe da Novo Tempo.`;
    }
    return pickUnusedAnaReply([
      `Que bom que você deseja continuar${anaNameSuffix(name)}. Olha, no sábado, dia 19 de setembro de 2026, pela parte da tarde, uma equipe da Novo Tempo vai entregar um material especial, um brinde, para quem está acompanhando a Escola Bíblica.\n\nVocê poderá receber esse material?`,
      `${anaNameText(name)}fico feliz em saber disso. No sábado, 19 de setembro de 2026, à tarde, a Novo Tempo terá uma equipe fazendo uma entrega especial de um material/brinde.\n\nVocê poderá receber?`,
      `Perfeito${anaNameSuffix(name)}. Então posso te contar uma coisa: no sábado, dia 19 de setembro de 2026, pela parte da tarde, representantes da Novo Tempo vão entregar um presente para apoiar esse acompanhamento.\n\nVocê poderá receber esse material?`
    ], fullHistory);
  }
  if (alreadyOfferedGift && !alreadyAskedAddress && isNegativeReply(inboundText)) {
    return `Tudo bem${anaNameSuffix(name)}, sem problema. Vou deixar registrado que você não poderá receber essa entrega agora.`;
  }
  if (intent === 'not_received') {
    return pickUnusedAnaReply([
      `Entendi${anaNameSuffix(name)}. Obrigada por me avisar.\n\nPosso verificar uma forma de te ajudar com esse material por aqui?`,
      `Poxa, obrigado por me contar${anaNameSuffix(name)}. Vou deixar isso registrado para a equipe conferir o envio do seu material.\n\nVocê prefere receber ajuda por aqui mesmo no WhatsApp?`,
      `Certo${anaNameSuffix(name)}. Vou te ajudar com isso. Para eu orientar melhor, você lembra se pediu material impresso ou acesso digital?`
    ], fullHistory);
  }
  if (intent === 'does_not_remember') {
    return `Sem problema${anaNameSuffix(name)}. Esse contato é sobre ${theme}, que aparece nos registros da Escola Bíblica Novo Tempo.\n\nVocê gostaria que eu te ajudasse a retomar esse estudo?`;
  }
  if (intent === 'received') {
    if (!alreadyAskedMaterialRead && !alreadyAskedUnderstanding) {
      return pickUnusedAnaReply([
        `Que bom saber${anaNameSuffix(name)}. Fico feliz que o material chegou certinho 😊\n\nO que você conseguiu entender dele até agora?`,
        `Que alegria${anaNameSuffix(name)}. Fico feliz que o material chegou.\n\nQual ponto desse material chamou mais sua atenção?`,
        `Ótimo${anaNameSuffix(name)}. Esse material foi preparado com muito carinho.\n\nTeve alguma parte que fez mais sentido para você?`
      ], fullHistory);
    }
    if (!alreadyAskedNextMaterial) {
      return pickUnusedAnaReply([
        `Obrigado por compartilhar${anaNameSuffix(name)}. É muito bom saber como você está acompanhando.\n\nVocê gostaria de receber um próximo material semelhante para continuar esse estudo?`,
        `Entendi${anaNameSuffix(name)}. Fico feliz que você já teve contato com o conteúdo.\n\nVocê gostaria que a Novo Tempo te enviasse outro material nessa mesma linha?`,
        `Que bom${anaNameSuffix(name)}. A ideia é caminhar com você aos poucos.\n\nVocê gostaria de continuar recebendo orientação e materiais da Escola Bíblica Novo Tempo?`
      ], fullHistory);
    }
    if (!alreadyOfferedGift) {
      return pickUnusedAnaReply([
        `Que bom que você deseja continuar${anaNameSuffix(name)}. Olha, no sábado, dia 19 de setembro de 2026, pela parte da tarde, uma equipe da Novo Tempo vai entregar um material especial, um brinde, para quem está acompanhando a Escola Bíblica.\n\nVocê poderá receber esse material?`,
        `${anaNameText(name)}fico feliz em saber disso. No sábado, 19 de setembro de 2026, à tarde, a Novo Tempo terá uma equipe fazendo uma entrega especial de um material/brinde.\n\nVocê poderá receber?`,
        `Perfeito${anaNameSuffix(name)}. Então posso te contar uma coisa: no sábado, dia 19 de setembro de 2026, pela parte da tarde, representantes da Novo Tempo vão entregar um presente para apoiar esse acompanhamento.\n\nVocê poderá receber esse material?`
      ], fullHistory);
    }
    return `Perfeito${anaNameSuffix(name)}. Vou deixar isso registrado para a equipe da Novo Tempo acompanhar com carinho.`;
  }
  if (intent === 'visit') {
    return `Que bom você falar sobre isso${anaNameSuffix(name)}. Vou deixar registrado para alguém da equipe Novo Tempo acompanhar com carinho.`;
  }
  return `${anaNameText(name)}obrigada por responder 😊\n\nPara eu seguir com o acompanhamento certinho: você chegou a receber o material da Escola Bíblica Novo Tempo?`;
}

function gptMakerContextId(phone) {
  return normalizePhone(phone);
}

async function sendGptMakerRequest(endpoint, body) {
  const config = gptMakerConfig();
  const apiToken = normalizeApiToken(
    process.env.GPTMAKER_API_TOKEN
    || process.env.GPTMAKER_API_KEY
    || process.env.GPT_MAKER_API_TOKEN
  );
  if (!config.baseUrl || !apiToken || !config.agentId) {
    const error = new Error('Configuracao do GPT Maker incompleta. Informe GPTMAKER_API_TOKEN e GPTMAKER_AGENT_ID.');
    error.status = 500;
    throw error;
  }

  const providerResponse = await fetch(`${config.baseUrl}/v2/agent/${encodeURIComponent(config.agentId)}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.min(Math.max(Number(process.env.GPTMAKER_TIMEOUT_MS) || 90000, 5000), 120000))
  });
  const data = await parseProviderResponse(providerResponse);
  if (!providerResponse.ok) {
    const error = new Error(data?.error || data?.message || `GPT Maker respondeu com status ${providerResponse.status}`);
    error.status = 502;
    error.providerStatus = providerResponse.status;
    error.providerResponse = data;
    throw error;
  }
  return data;
}

async function askGptMakerAgent({ conversation, inboundMessage }) {
  const contextId = gptMakerContextId(conversation?.phone);
  const prompt = String(inboundMessage?.body || '').trim();
  if (!contextId || !prompt) return null;

  const data = await sendGptMakerRequest('/conversation', {
    contextId,
    prompt,
    chatName: conversation?.leadName || conversation?.lead?.name || 'Interessado',
    phone: contextId
  });
  const message = String(data?.message || '').trim();
  if (!message) {
    const error = new Error('O agente do GPT Maker respondeu sem texto.');
    error.status = 502;
    error.providerResponse = data;
    throw error;
  }
  return { message, contextId, providerResponse: data };
}

async function addGptMakerContext({ phone, message, role = 'assistant' }) {
  const config = gptMakerConfig();
  const contextId = gptMakerContextId(phone);
  const prompt = String(message || '').trim();
  if (!config.configured || !contextId || !prompt) return { skipped: true };
  return sendGptMakerRequest('/add-message', { contextId, prompt, role });
}

async function maybeReplyWithGptMaker(saved, inboundMessage) {
  if (!saved?.conversation?.id || !inboundMessage?.body) return null;
  const config = gptMakerConfig();
  if (!config.autoReplyEnabled) return null;
  if (!config.configured) {
    console.warn('[gptmaker:auto-reply:skipped] GPT Maker nao configurado');
    return null;
  }

  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { id: saved.conversation.id },
    include: {
      lead: { select: whatsappLeadSelect },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 24
      }
    }
  });
  if (conversation?.messages) {
    conversation.messages = [...conversation.messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
  const recentAgentReply = (conversation?.messages || []).find((message) => (
    message.senderType === 'AI'
    && message.direction === 'OUTBOUND'
    && message.metadata?.replyToMessageId === inboundMessage.id
  ));
  if (recentAgentReply) return null;

  const typing = await sendWhatsAppTypingIndicator(conversation?.phone || saved.conversation.phone);
  let agentReply;
  try {
    agentReply = await askGptMakerAgent({ conversation, inboundMessage });
  } catch (error) {
    await prisma.whatsAppMessage.update({
      where: { id: inboundMessage.id },
      data: {
        metadata: {
          ...(inboundMessage.metadata && typeof inboundMessage.metadata === 'object' ? inboundMessage.metadata : {}),
          gptMakerError: error.message,
          gptMakerHttpStatus: error.providerStatus || null,
          gptMakerAttemptedAt: new Date().toISOString()
        }
      }
    }).catch(() => null);
    throw error;
  }

  const message = agentReply.message;
  let result;
  try {
    result = await sendWhatsAppTextMessage({
      phone: conversation?.phone || saved.conversation.phone,
      message,
      leadId: conversation?.externalLeadId || conversation?.lead?.externalId || conversation?.leadId || null,
      templateId: 'gptmaker-auto-reply'
    });
  } catch (error) {
    return recordWhatsAppMessage({
      phone: conversation?.phone || saved.conversation.phone,
      body: message,
      direction: 'OUTBOUND',
      senderType: 'AI',
      senderName: 'Ana',
      leadId: conversation?.externalLeadId || conversation?.lead?.externalId || conversation?.leadId || null,
      leadName: conversation?.leadName || conversation?.lead?.name || null,
      district: conversation?.district || conversation?.lead?.district?.name || null,
      provider: whatsappProvider() === 'waha' ? 'waha-gows' : 'zpro-baileys',
      providerStatus: error.deliveryStatus || 'FAILED',
      providerResponse: error.providerResponse || null,
      occurredAt: new Date(),
      metadata: {
        assistant: 'Ana',
        aiProvider: 'gpt-maker',
        transport: whatsappProvider() === 'waha' ? 'waha-gows' : 'zpro-baileys',
        autoReply: true,
        replyToMessageId: inboundMessage.id,
        source: 'gpt-maker-conversation',
        gptMakerAgentId: config.agentId,
        gptMakerContextId: agentReply.contextId,
        gptMakerResponse: agentReply.providerResponse,
        typing,
        failure: true,
        providerHttpStatus: error.providerStatus || error.status || null,
        attempts: error.providerAttempts || []
      }
    });
  }

  return recordWhatsAppMessage({
    phone: result.phone,
    body: message,
    direction: 'OUTBOUND',
    senderType: 'AI',
    senderName: 'Ana',
    leadId: conversation?.externalLeadId || conversation?.lead?.externalId || conversation?.leadId || null,
    leadName: conversation?.leadName || conversation?.lead?.name || null,
    district: conversation?.district || conversation?.lead?.district?.name || null,
    provider: result.provider,
    providerStatus: result.deliveryStatus,
    providerResponse: result.providerResponse,
    providerMessageId: providerMessageId(result.providerResponse),
    occurredAt: new Date(),
    metadata: {
      assistant: 'Ana',
      aiProvider: 'gpt-maker',
      transport: result.provider,
      autoReply: true,
      replyToMessageId: inboundMessage.id,
      source: 'gpt-maker-conversation',
      gptMakerAgentId: config.agentId,
      gptMakerContextId: agentReply.contextId,
      gptMakerResponse: agentReply.providerResponse,
      typing,
      attempts: result.attempts || []
    }
  });
}

function firstNameFromName(value) {
  const firstName = String(value || '').trim().split(/\s+/)[0];
  return firstName || 'amigo';
}

function cleanTemplateVariable(value, fallback) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean === 'N/I' || clean === 'Nao informado' || clean === 'Não informado') return fallback;
  return clean;
}

function renderWhatsAppTemplate(message, recipient = {}) {
  const name = cleanTemplateVariable(recipient.name || recipient.leadName, 'amigo(a)');
  const variables = {
    NOME: name,
    PRIMEIRO_NOME: firstNameFromName(name),
    TEMA: cleanTemplateVariable(recipient.material || recipient.theme || recipient.tema || recipient.studyType, 'estudos bíblicos'),
    MATERIAL: cleanTemplateVariable(recipient.material || recipient.theme || recipient.tema || recipient.studyType, 'estudos bíblicos'),
    DISTRITO: cleanTemplateVariable(recipient.district, 'sua região'),
    WHATSAPP: cleanTemplateVariable(recipient.phone || recipient.tel, '')
  };

  return String(message || '').replace(/\{\{\s*([A-Z_]+)\s*\}\}/gi, (match, key) => (
    Object.prototype.hasOwnProperty.call(variables, key.toUpperCase()) ? variables[key.toUpperCase()] : match
  ));
}

function tokenDiagnostic(token) {
  if (!token) return { loaded: false, length: 0, prefix: null };
  return {
    loaded: true,
    length: token.length,
    prefix: `${token.slice(0, 8)}...`
  };
}

function buildZproSendPayload({ phone, message, leadId, templateId, channelId, externalKey, token }) {
  return {
    channelId,
    sessionId: channelId,
    number: phone,
    phone,
    to: phone,
    body: message,
    text: message,
    message,
    externalKey,
    bearertoken: token,
    isClosed: false,
    leadId: leadId || null,
    templateId: templateId || null
  };
}

function isInvalidTokenResponse(status, data) {
  const text = JSON.stringify(data || {}).toLowerCase();
  return status === 401 || text.includes('invalid token') || text.includes('invalid_token') || text.includes('err_auth_invalid_token');
}

async function parseProviderResponse(providerResponse) {
  const text = await providerResponse.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function sendWahaRequest(pathValue, body) {
  const config = wahaConfig();
  if (!config.baseUrl || !config.apiKey) {
    const missing = [
      !config.baseUrl && 'WAHA_API_URL',
      !config.apiKey && 'WAHA_API_KEY'
    ].filter(Boolean);
    const error = new Error(`Configuracao WAHA incompleta: ${missing.join(', ')}`);
    error.status = 500;
    throw error;
  }

  const providerResponse = await fetch(`${config.baseUrl}${pathValue}`, {
    method: 'POST',
    headers: {
      'X-Api-Key': config.apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await parseProviderResponse(providerResponse);
  if (!providerResponse.ok) {
    const error = new Error(data?.message || data?.error || `WAHA respondeu com status ${providerResponse.status}`);
    error.status = 502;
    error.providerStatus = providerResponse.status;
    error.deliveryStatus = providerFailureStatus(providerResponse.status, data);
    error.providerResponse = data;
    throw error;
  }
  return data;
}

async function sendWahaTextMessage({ phone, message }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    const error = new Error('Telefone invalido. Use DDI + DDD + numero, ou DDD + numero brasileiro.');
    error.status = 400;
    throw error;
  }
  const cleanMessage = String(message || '').trim();
  if (cleanMessage.length < 2) {
    const error = new Error('Mensagem vazia ou muito curta.');
    error.status = 400;
    throw error;
  }

  const config = wahaConfig();
  const data = await sendWahaRequest('/api/sendText', {
    session: config.session,
    chatId: `${normalizedPhone}@c.us`,
    text: cleanMessage
  });
  return {
    ok: true,
    provider: 'waha-gows',
    deliveryStatus: providerResponseDeliveryStatus(data),
    phone: normalizedPhone,
    providerResponse: data,
    attempts: []
  };
}

async function sendWahaMediaMessage({ phone, message = '', fileName, mimeType, base64Data }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    const error = new Error('Telefone invalido. Use DDI + DDD + numero, ou DDD + numero brasileiro.');
    error.status = 400;
    throw error;
  }

  const cleanMimeType = String(mimeType || '').toLowerCase();
  if (!cleanMimeType.startsWith('image/') && !cleanMimeType.startsWith('video/')) {
    const error = new Error('Envie somente imagem ou video.');
    error.status = 400;
    throw error;
  }

  const cleanBase64 = String(base64Data || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const mediaBytes = Buffer.byteLength(cleanBase64, 'base64');
  if (!cleanBase64 || !mediaBytes || mediaBytes > 10 * 1024 * 1024) {
    const error = new Error('O anexo deve ter no maximo 10 MB.');
    error.status = 400;
    throw error;
  }

  const safeFileName = path.basename(String(fileName || (cleanMimeType.startsWith('video/') ? 'video' : 'imagem')))
    .replace(/[^\w .()\-À-ÿ]/g, '_');
  const config = wahaConfig();
  const data = await sendWahaRequest(cleanMimeType.startsWith('video/') ? '/api/sendVideo' : '/api/sendImage', {
    session: config.session,
    chatId: `${normalizedPhone}@c.us`,
    file: {
      mimetype: cleanMimeType,
      filename: safeFileName,
      data: cleanBase64
    },
    caption: String(message || '').trim()
  });

  return {
    ok: true,
    provider: 'waha-gows',
    deliveryStatus: providerResponseDeliveryStatus(data),
    phone: normalizedPhone,
    providerResponse: data,
    media: { fileName: safeFileName, mimeType: cleanMimeType }
  };
}

async function sendWhatsAppTextMessage(options) {
  return whatsappProvider() === 'waha'
    ? sendWahaTextMessage(options)
    : sendZproTextMessage(options);
}

async function sendWhatsAppMediaMessage(options) {
  return whatsappProvider() === 'waha'
    ? sendWahaMediaMessage(options)
    : sendZproMediaMessage(options);
}

async function sendZproByParams({ config, phone, message, externalKey }) {
  const paramsPath = applyPathParams('/v2/api/external/{apiId}/params/', {
    apiId: config.apiId
  });
  const url = new URL(`${config.baseUrl}${paramsPath}`);
  url.searchParams.set('body', message);
  url.searchParams.set('number', phone);
  url.searchParams.set('externalKey', externalKey);
  url.searchParams.set('bearertoken', config.token);
  url.searchParams.set('isClosed', 'false');

  const providerResponse = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json'
    }
  });
  const data = await parseProviderResponse(providerResponse);
  return { providerResponse, data, transport: 'params' };
}

function summarizeZproAttempt({ transport, status, data }) {
  return {
    transport,
    status,
    message: data?.message || data?.error || data?.raw || null
  };
}

async function sendZproTextMessage({ phone, message, leadId = null, templateId = null }) {
  const config = zproConfig();
  if (!config.baseUrl || !config.token || !config.apiId) {
    const missing = [
      !config.baseUrl && 'ZPRO_API_URL',
      !config.token && 'ZPRO_API_TOKEN',
      !config.apiId && 'ZPRO_API_ID'
    ].filter(Boolean);
    const error = new Error(`Configuracao Zpro incompleta: ${missing.join(', ')}`);
    error.status = 500;
    throw error;
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    const error = new Error('Telefone invalido. Use DDI + DDD + numero, ou DDD + numero brasileiro.');
    error.status = 400;
    throw error;
  }

  const cleanMessage = String(message || '').trim();
  if (cleanMessage.length < 2) {
    const error = new Error('Mensagem vazia ou muito curta.');
    error.status = 400;
    throw error;
  }

  const externalKey = `leadsnt-${leadId || normalizedPhone}-${Date.now()}`;
  const pathValue = applyPathParams(config.sendPath, {
    apiId: config.apiId,
    channelId: config.channelId || config.apiId,
    sessionId: config.channelId || config.apiId
  });
  const url = pathValue.startsWith('http') ? pathValue : `${config.baseUrl}${pathValue.startsWith('/') ? '' : '/'}${pathValue}`;
  const payload = buildZproSendPayload({
    phone: normalizedPhone,
    message: cleanMessage,
    leadId,
    templateId,
    channelId: config.channelId || config.apiId,
    externalKey,
    token: config.token
  });

  let transport = 'post';
  const attempts = [];
  let providerResponse = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data = await parseProviderResponse(providerResponse);
  attempts.push(summarizeZproAttempt({
    transport,
    status: providerResponse.status,
    data
  }));
  if (!providerResponse.ok && isInvalidTokenResponse(providerResponse.status, data)) {
    const fallback = await sendZproByParams({
      config,
      phone: normalizedPhone,
      message: cleanMessage,
      externalKey
    });
    providerResponse = fallback.providerResponse;
    data = fallback.data;
    transport = fallback.transport;
    attempts.push(summarizeZproAttempt({
      transport,
      status: providerResponse.status,
      data
    }));
  }

  if (!providerResponse.ok) {
    const invalidToken = isInvalidTokenResponse(providerResponse.status, data);
    const error = new Error(invalidToken
      ? 'Token recusado pelo Z-PRO. Gere um novo token de API no Z-PRO e atualize ZPRO_API_TOKEN no backend.'
      : data?.message || data?.error || `Zpro respondeu com status ${providerResponse.status}`);
    error.status = 502;
    error.providerStatus = providerResponse.status;
    error.deliveryStatus = providerFailureStatus(providerResponse.status, data);
    error.providerResponse = data;
    error.providerAttempts = attempts;
    throw error;
  }

  return {
    ok: true,
    provider: 'zpro-baileys',
    deliveryStatus: providerResponseDeliveryStatus(data),
    channelId: config.channelId || null,
    apiId: config.apiId,
    phone: normalizedPhone,
    transport,
    attempts,
    providerResponse: data
  };
}

async function sendZproMediaMessage({ phone, message = '', fileName, mimeType, base64Data, leadId = null }) {
  const config = zproConfig();
  if (!config.baseUrl || !config.token || !config.apiId) {
    const error = new Error('Configuração Zpro incompleta para envio de mídia.');
    error.status = 500;
    throw error;
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    const error = new Error('Telefone inválido. Use DDI + DDD + número, ou DDD + número brasileiro.');
    error.status = 400;
    throw error;
  }

  const cleanMimeType = String(mimeType || '').toLowerCase();
  if (!cleanMimeType.startsWith('image/') && !cleanMimeType.startsWith('video/')) {
    const error = new Error('Envie somente imagem ou vídeo.');
    error.status = 400;
    throw error;
  }

  const cleanBase64 = String(base64Data || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const mediaBytes = Buffer.byteLength(cleanBase64, 'base64');
  if (!cleanBase64 || !mediaBytes || mediaBytes > 10 * 1024 * 1024) {
    const error = new Error('O anexo deve ter no máximo 10 MB.');
    error.status = 400;
    throw error;
  }

  const safeFileName = path.basename(String(fileName || (cleanMimeType.startsWith('video/') ? 'video' : 'imagem')))
    .replace(/[^\w .()\-À-ÿ]/g, '_');
  const cleanMessage = String(message || '').trim();
  const externalKey = `leadsnt-media-${leadId || normalizedPhone}-${Date.now()}`;
  const pathValue = applyPathParams(config.sendMediaPath, {
    apiId: config.apiId,
    channelId: config.channelId || config.apiId,
    sessionId: config.channelId || config.apiId
  });
  const url = pathValue.startsWith('http') ? pathValue : `${config.baseUrl}${pathValue.startsWith('/') ? '' : '/'}${pathValue}`;
  const providerResponse = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: cleanMessage,
      number: normalizedPhone,
      base64Data: cleanBase64,
      mimeType: cleanMimeType,
      fileName: safeFileName,
      externalKey,
      isClosed: false
    })
  });
  const data = await parseProviderResponse(providerResponse);
  if (!providerResponse.ok) {
    const error = new Error(data?.message || data?.error || `Zpro respondeu com status ${providerResponse.status}`);
    error.status = 502;
    error.providerStatus = providerResponse.status;
    error.deliveryStatus = providerFailureStatus(providerResponse.status, data);
    error.providerResponse = data;
    throw error;
  }

  return {
    ok: true,
    provider: 'zpro-baileys',
    deliveryStatus: providerResponseDeliveryStatus(data),
    phone: normalizedPhone,
    providerResponse: data,
    media: { fileName: safeFileName, mimeType: cleanMimeType }
  };
}

function zproExternalUrl(pathValue, query = {}) {
  const config = zproConfig();
  if (!config.baseUrl || !config.token || !config.apiId) {
    const error = new Error('Configuracao Z-PRO incompleta para sincronizar conversas.');
    error.status = 500;
    throw error;
  }
  const resolvedPath = applyPathParams(pathValue, {
    apiId: config.apiId,
    channelId: config.channelId || config.apiId,
    sessionId: config.channelId || config.apiId
  });
  const url = new URL(resolvedPath.startsWith('http')
    ? resolvedPath
    : `${config.baseUrl}${resolvedPath.startsWith('/') ? '' : '/'}${resolvedPath}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  if (!url.searchParams.has('bearertoken')) url.searchParams.set('bearertoken', config.token);
  return { url, config };
}

async function fetchZproExternalJson(pathValue, { method = 'GET', query = {}, body = null } = {}) {
  const { url, config } = zproExternalUrl(pathValue, query);
  const providerResponse = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify({ ...body, bearertoken: config.token }) } : {})
  });
  const data = await parseProviderResponse(providerResponse);
  if (!providerResponse.ok) {
    const error = new Error(data?.message || data?.error || `Z-PRO respondeu com status ${providerResponse.status}`);
    error.status = 502;
    error.providerStatus = providerResponse.status;
    error.providerResponse = data;
    throw error;
  }
  return data;
}

function collectArraysFromPayload(value, arrays = []) {
  if (Array.isArray(value)) {
    arrays.push(value);
    return arrays;
  }
  if (!value || typeof value !== 'object') return arrays;
  Object.values(value).forEach((child) => collectArraysFromPayload(child, arrays));
  return arrays;
}

function largestObjectArray(payload) {
  return collectArraysFromPayload(payload)
    .filter((items) => items.some((item) => item && typeof item === 'object'))
    .sort((left, right) => right.length - left.length)[0] || [];
}

function parseZproDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function zproTicketPhone(ticket = {}) {
  const contact = ticket.contact || ticket.Contact || ticket.sender || {};
  return firstValue(
    ticket.phone,
    ticket.number,
    ticket.whatsapp,
    ticket.remoteJid,
    ticket.contactId,
    contact.phone,
    contact.number,
    contact.remoteJid,
    ticket.lastMessage?.remoteJid,
    ticket.message?.remoteJid,
    ticket.messages?.[0]?.remoteJid
  );
}

function zproTicketName(ticket = {}) {
  const contact = ticket.contact || ticket.Contact || ticket.sender || {};
  return firstValue(contact.name, contact.pushName, ticket.name, ticket.pushName, ticket.contactName);
}

function zproTicketLastText(ticket = {}) {
  const value = firstValue(
    readMessageText(ticket.lastMessage || {}),
    readMessageText(ticket.message || {}),
    ticket.lastMessage,
    ticket.lastMessageBody,
    ticket.body,
    ticket.text
  );
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function zproTicketMessages(ticket = {}) {
  const arrays = [
    ticket.messages,
    ticket.Messages,
    ticket.chatMessages,
    ticket.ticketMessages,
    ticket.lastMessages,
    ...collectArraysFromPayload(ticket)
  ].filter(Array.isArray);
  const unique = new Map();
  for (const item of arrays.flat()) {
    if (!item || typeof item !== 'object') continue;
    const text = String(readMessageText(item) || item.body || item.text || '').trim();
    if (!text) continue;
    const key = providerMessageId(item)
      || `${firstValue(item.createdAt, item.timestamp, item.messageTimestamp, item.updatedAt) || ''}:${Boolean(item.fromMe || item.key?.fromMe)}:${text.slice(0, 80)}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return Array.from(unique.values())
    .sort((left, right) => {
      const leftDate = parseZproDate(firstValue(left.createdAt, left.timestamp, left.messageTimestamp, left.updatedAt)) || new Date(0);
      const rightDate = parseZproDate(firstValue(right.createdAt, right.timestamp, right.messageTimestamp, right.updatedAt)) || new Date(0);
      return leftDate - rightDate;
    })
    .slice(-200);
}

function zproTicketDate(ticket = {}) {
  return parseZproDate(firstValue(
    ticket.updatedAt,
    ticket.lastMessageAt,
    ticket.lastMessage?.createdAt,
    ticket.lastMessage?.messageTimestamp,
    ticket.message?.createdAt,
    ticket.createdAt
  )) || new Date();
}

function stableZproMessageId(ticket = {}, message = {}) {
  const rawId = providerMessageId(message) || providerMessageId(ticket);
  if (rawId) return rawId;
  const ticketId = ticket.id || ticket.ticketId || ticket.uuid || ticket.protocol || zproTicketPhone(ticket);
  const dateValue = firstValue(message.createdAt, message.timestamp, message.messageTimestamp, ticket.updatedAt, ticket.lastMessageAt, ticket.createdAt);
  const direction = message.fromMe || ticket.fromMe ? 'out' : 'in';
  const body = compactText(readMessageText(message) || zproTicketLastText(ticket), '').slice(0, 60);
  return `zpro-sync:${ticketId || 'ticket'}:${dateValue || 'date'}:${direction}:${body}`;
}

async function syncZproConversations({ statuses = ['open', 'pending', 'closed'], limit = 120 } = {}) {
  const listPath = String(process.env.ZPRO_LIST_TICKETS_PATH || '/v2/api/external/{apiId}/listTickets').trim();
  const normalizedStatuses = Array.from(new Set(statuses.map((status) => String(status || '').trim()).filter(Boolean)));
  const seenPhones = new Set();
  const result = { imported: 0, skipped: 0, tickets: 0, errors: [] };

  for (const status of normalizedStatuses.length ? normalizedStatuses : ['open']) {
    if (seenPhones.size >= limit) break;
    try {
      const payload = await fetchZproExternalJson(listPath, {
        query: {
          status,
          pageNumber: 1,
          page: 1,
          limit
        }
      });
      const tickets = largestObjectArray(payload).slice(0, Math.max(1, limit - seenPhones.size));
      result.tickets += tickets.length;
      for (const ticket of tickets) {
        const phone = normalizePhone(zproTicketPhone(ticket));
        if (!phone || seenPhones.has(phone)) {
          result.skipped += 1;
          continue;
        }
        seenPhones.add(phone);
        const ticketMessages = zproTicketMessages(ticket);
        if (ticketMessages.length > 1) {
          for (const ticketMessage of ticketMessages) {
            const messageText = String(readMessageText(ticketMessage) || ticketMessage.body || ticketMessage.text || '').trim();
            if (!messageText) continue;
            const messageFromMe = Boolean(ticketMessage.fromMe || ticketMessage.key?.fromMe || ticketMessage.message?.key?.fromMe);
            const messageOccurredAt = parseZproDate(firstValue(
              ticketMessage.createdAt,
              ticketMessage.timestamp,
              ticketMessage.messageTimestamp,
              ticketMessage.updatedAt,
              ticket.updatedAt
            )) || zproTicketDate(ticket);
            await recordWhatsAppMessage({
              phone,
              body: messageText,
              direction: messageFromMe ? 'OUTBOUND' : 'INBOUND',
              senderType: messageFromMe ? 'SYSTEM' : 'LEAD',
              senderName: messageFromMe ? 'WhatsApp' : zproTicketName(ticket) || null,
              provider: 'zpro-baileys',
              providerStatus: 'SYNCED',
              providerMessageId: stableZproMessageId(ticket, ticketMessage),
              occurredAt: messageOccurredAt,
              metadata: {
                syncedFromZpro: true,
                ticketId: ticket.id || ticket.ticketId || null,
                ticketStatus: ticket.status || status || null
              }
            });
          }
          result.imported += ticketMessages.length;
          continue;
        }
        const text = String(zproTicketLastText(ticket) || '').trim();
        const fromMe = Boolean(ticket.lastMessage?.fromMe || ticket.message?.fromMe || ticket.fromMe);
        const occurredAt = zproTicketDate(ticket);
        if (!text) {
          await prisma.whatsAppConversation.upsert({
            where: { phone },
            create: {
              phone,
              leadName: zproTicketName(ticket) || null,
              status: String(ticket.status || status || 'ABERTA').toUpperCase()
            },
            update: {
              ...(zproTicketName(ticket) ? { leadName: zproTicketName(ticket) } : {}),
              status: String(ticket.status || status || 'ABERTA').toUpperCase(),
              updatedAt: occurredAt
            }
          });
          result.imported += 1;
          continue;
        }
        await recordWhatsAppMessage({
          phone,
          body: text,
          direction: fromMe ? 'OUTBOUND' : 'INBOUND',
          senderType: fromMe ? 'SYSTEM' : 'LEAD',
          senderName: fromMe ? 'WhatsApp' : zproTicketName(ticket) || null,
          provider: 'zpro-baileys',
          providerStatus: 'SYNCED',
          providerMessageId: stableZproMessageId(ticket, ticket.lastMessage || ticket.message || ticket),
          occurredAt,
          metadata: {
            syncedFromZpro: true,
            ticketId: ticket.id || ticket.ticketId || null,
            ticketStatus: ticket.status || status || null
          }
        });
        result.imported += 1;
      }
    } catch (error) {
      result.errors.push({ status, message: error.message, providerStatus: error.providerStatus || null });
    }
  }

  return result;
}

app.use(cors({
  origin(origin, callback) {
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
    if (!origin || allowedOrigins.has(normalizeOrigin(origin)) || isLocalOrigin) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origem nao permitida: ${origin}`));
  },
  credentials: true
}));
app.use(cookieParser());

app.post(
  '/api/dataset/upload',
  express.raw({ type: 'multipart/form-data', limit: MAX_DATASET_UPLOAD_BYTES }),
  requireAuth,
  requireAdminGeral,
  async (request, response) => {
    let tempDir = null;
    try {
      const files = parseMultipartFiles(request);
      if (!files.length) {
        response.status(400).json({ message: 'Envie pelo menos um arquivo .xlsx.' });
        return;
      }

      tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'dataset-upload-'));
      const uploadPaths = [];
      for (const [index, file] of files.entries()) {
        const filename = `${String(index + 1).padStart(2, '0')}-${file.filename}`;
        const uploadPath = path.join(tempDir, filename);
        await fsp.writeFile(uploadPath, file.buffer);
        uploadPaths.push(uploadPath);
      }

      const processingStartedAt = new Date();
      const result = await runDatasetUpdate(uploadPaths);
      invalidateDashboardCache();
      const processingCompletedAt = new Date();
      let savedHistory = null;
      let historyWarning = null;
      try {
        savedHistory = await saveDatasetUploadHistory({
          result,
          files,
          user: request.user,
          processingStartedAt,
          processingCompletedAt
        });
      } catch (historyError) {
        historyWarning = historyError.message || 'Historico nao foi salvo no banco.';
        console.error('[dataset:history:error]', historyWarning);
      }
      response.json({
        ok: true,
        uploadedFiles: files.map((file) => file.filename),
        result,
        historySaved: Boolean(savedHistory),
        history: normalizeDatasetHistoryEntry(savedHistory),
        historyWarning
      });
    } catch (error) {
      response.status(error.status || 500).json({
        ok: false,
        message: error.message || 'Nao foi possivel atualizar a base de dados.'
      });
    } finally {
      if (tempDir) {
        await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
);

app.use(express.json({ limit: '16mb', type: ['application/json', 'application/*+json'] }));
app.use(express.urlencoded({ extended: true, limit: '16mb' }));
app.use(express.text({ limit: '2mb', type: ['text/*', 'application/xml'] }));

app.get('/api/health', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ ok: true, database: 'connected' });
  } catch (error) {
    response.status(500).json({ ok: false, database: 'error', message: error.message });
  }
});

app.post('/api/auth/login', async (request, response) => {
  const user = await validateCredentials(prisma, request.body?.email, request.body?.password);

  if (!user) {
    response.status(401).json({ message: 'Credenciais invalidas' });
    return;
  }

  const token = createSessionToken(user);
  response.cookie('sevenflow_session', token, sessionCookieOptions());
  response.json({ user, token });
});

app.post('/api/auth/logout', (_request, response) => {
  response.clearCookie('sevenflow_session', sessionCookieOptions());
  response.json({ ok: true });
});

app.get('/api/auth/me', (request, response) => {
  const bearerToken = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = verifySessionToken(request.cookies?.sevenflow_session) || verifySessionToken(bearerToken);
  if (!user) {
    response.status(401).json({ user: null });
    return;
  }
  response.json({ user });
});

app.get('/api/dashboard', requireAuth, async (request, response) => {
  response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.set('Pragma', 'no-cache');
  response.set('Expires', '0');
  try {
    await hydrateGeocodeCacheFromDb();
  } catch (error) {
    console.error('[dashboard:geocode-cache:error]', error.message);
  }
  const payload = getDashboardData();
  try {
    if (isAdminGeralUser(request.user) || userAssociationSlug(request.user) === 'paulistana') {
      const dbHistory = await readDatasetHistoryFromDb(50);
      if (dbHistory.length) {
        payload.meta.datasetUpdateHistory = dbHistory;
        payload.meta.lastDatasetUpdate = dbHistory[0];
      } else if (payload.meta.datasetUpdateHistory?.length) {
        const importedHistory = await importDatasetHistoryFromFiles(payload.meta.datasetUpdateHistory);
        if (importedHistory.length) {
          payload.meta.datasetUpdateHistory = importedHistory;
          payload.meta.lastDatasetUpdate = importedHistory[0];
        }
      }
    }
  } catch (error) {
    console.error('[dashboard:dataset-history:error]', error.message);
  }
  const scopedPayload = scopedDashboardPayload(payload, request.user);
  const shouldIncludeInterestDistricts = request.query?.includeInterestDistricts === '1';
  await sendDashboardJson(
    request,
    response,
    shouldIncludeInterestDistricts ? scopedPayload : omitInterestDistrictPayloads(scopedPayload)
  );
});

app.get('/api/dashboard/district-interest/:slug', requireAuth, async (request, response) => {
  response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.set('Pragma', 'no-cache');
  response.set('Expires', '0');

  const slug = districtSlug(request.params.slug);
  if (!isAdminGeralUser(request.user) && userAssociationSlug(request.user) !== 'paulistana') {
    response.status(403).json({ message: 'Acesso nao permitido para este distrito.' });
    return;
  }

  const payload = getDashboardData();
  const records = payload.interestRecordsByDistrict?.[slug] || [];
  response.json({ slug, records });
});

app.get('/api/geocode/status', requireAuth, requireAdminGeral, async (_request, response) => {
  response.json(await geocodeStatus());
});

app.post('/api/geocode/run', requireAuth, requireAdminGeral, async (request, response) => {
  const result = startGeocodingBatch({
    limit: request.body?.limit,
    district: request.body?.district,
    scope: request.body?.scope,
    force: Boolean(request.body?.force),
    leadId: request.body?.leadId
  });
  response.status(result.started ? 202 : 409).json(result.started ? result.status : await geocodeStatus());
});

app.get('/api/dataset/history', requireAuth, requireAdminGeral, async (_request, response) => {
  response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.set('Pragma', 'no-cache');
  response.set('Expires', '0');
  try {
    const history = await readDatasetHistoryFromDb(100);
    response.json({ history });
  } catch (error) {
    response.status(500).json({
      history: [],
      message: error.message || 'Nao foi possivel carregar o historico do dataset.'
    });
  }
});

app.get('/api/whatsapp/provider', requireAuth, (_request, response) => {
  if (whatsappProvider() === 'waha') {
    const config = wahaConfig();
    response.json({
      provider: 'waha-gows',
      configured: Boolean(config.baseUrl && config.apiKey),
      baseUrl: config.baseUrl || null,
      session: config.session,
      token: { loaded: Boolean(config.apiKey) }
    });
    return;
  }
  const config = zproConfig();
  response.json({
    provider: 'zpro-baileys',
    configured: Boolean(config.baseUrl && config.token && config.apiId),
    baseUrl: config.baseUrl || null,
    channelId: config.channelId || null,
    apiId: config.apiId || null,
    sendPath: config.sendPath,
    token: tokenDiagnostic(config.token)
  });
});

app.get('/api/ai/ana/summary', requireAuth, async (request, response) => {
  response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.set('Pragma', 'no-cache');
  response.set('Expires', '0');

  try {
    const training = gptMakerTrainingStatus();
    if (!isAdminGeralUser(request.user) && userAssociationSlug(request.user) !== 'paulistana') {
      response.json({
        agent: gptMakerConfig(),
        training,
        metrics: { conversations: 0, contacted: 0, leadReplies: 0, aiReplies: 0, needsHuman: 0, optOut: 0 },
        conversations: []
      });
      return;
    }

    const limit = Math.min(Math.max(Number(request.query?.limit) || 80, 1), 200);
    const conversations = await prisma.whatsAppConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        lead: { select: whatsappLeadSelect },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200
        }
      }
    });

    const summarized = conversations
      .map(summarizeAnaConversation)
      .filter((conversation) => conversation.hasLeadReply || conversation.aiCount > 0);

    response.json({
      agent: gptMakerConfig(),
      training,
      metrics: {
        conversations: summarized.length,
        contacted: conversations.filter((conversation) => (conversation.messages || []).some((message) => message.direction === 'OUTBOUND')).length,
        leadReplies: summarized.filter((conversation) => conversation.hasLeadReply).length,
        aiReplies: summarized.filter((conversation) => conversation.aiCount > 0).length,
        needsHuman: summarized.filter((conversation) => conversation.classification?.label === 'Encaminhar humano').length,
        optOut: summarized.filter((conversation) => conversation.classification?.label === 'Opt-out').length
      },
      conversations: summarized
    });
  } catch (error) {
    console.error('[ai:ana:summary:error]', error.message);
    response.status(500).json({
      agent: gptMakerConfig(),
      training: gptMakerTrainingStatus(),
      metrics: { conversations: 0, contacted: 0, leadReplies: 0, aiReplies: 0, needsHuman: 0, optOut: 0 },
      conversations: [],
      message: 'Nao foi possivel carregar o resumo da Ana.'
    });
  }
});

app.get('/api/ai-intentions', (request, response) => {
  if (!aiIntentWebhookAllowed(request)) {
    response.status(401).json({ ok: false, message: 'Webhook da Ana nao autorizado' });
    return;
  }
  response.json({
    ok: true,
    webhook: 'ready',
    provider: 'gpt-maker',
    requiredFields: ['phone ou telefone', 'agentMessage ou resposta'],
    optionalFields: ['userMessage', 'intent', 'name', 'leadId', 'address ou endereco']
  });
});

async function mergeWhatsAppMessageMetadata(messageId, metadata) {
  if (!messageId) return null;
  const current = await prisma.whatsAppMessage.findUnique({ where: { id: messageId } }).catch(() => null);
  if (!current) return null;
  return prisma.whatsAppMessage.update({
    where: { id: messageId },
    data: {
      metadata: {
        ...(current.metadata && typeof current.metadata === 'object' ? current.metadata : {}),
        ...metadata
      }
    }
  });
}

app.post('/api/ai-intentions', async (request, response) => {
  if (!aiIntentWebhookAllowed(request)) {
    response.status(401).json({ ok: false, message: 'Webhook da Ana nao autorizado' });
    return;
  }

  const payload = coerceWebhookPayload(request.body);
  const event = readGptMakerIntentEvent(payload);
  const occurredAt = new Date();

  console.log('[gptmaker:intention]', JSON.stringify({
    phone: event.phone || event.rawPhone || null,
    intent: event.intentName,
    hasInbound: Boolean(event.inboundText),
    hasAgentMessage: Boolean(event.agentText),
    leadName: event.leadName || null
  }));

  try {
    const intentReply = await anaIntentReply(event);
    const qualification = event.qualification || event.intentName;
    const qualificationMetadata = {
      source: 'gpt-maker-intention',
      aiProvider: 'gpt-maker',
      intent: event.intentName,
      gptMakerQualification: qualification,
      gptMakerSummary: event.summary || null,
      gptMakerNextAction: event.nextAction || null,
      gptMakerAction: intentReply?.action || null,
      gptMakerEventId: event.eventId || null,
      gptMakerReceivedAt: occurredAt.toISOString(),
      raw: event.raw
    };
    const conversation = event.phone
      ? await prisma.whatsAppConversation.findUnique({ where: { phone: event.phone } }).catch(() => null)
      : null;
    let inboundSaved = null;
    let inboundMessage = null;
    if (event.phone && event.inboundText) {
      const signature = normalizeMessageSignature(event.inboundText);
      const candidates = conversation ? await prisma.whatsAppMessage.findMany({
        where: { conversationId: conversation.id, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        take: 20
      }) : [];
      inboundMessage = candidates.find((message) => normalizeMessageSignature(message.body) === signature) || null;
      if (inboundMessage) {
        inboundMessage = await mergeWhatsAppMessageMetadata(inboundMessage.id, qualificationMetadata);
      } else {
        inboundSaved = await recordWhatsAppMessage({
          phone: event.phone,
          body: event.inboundText,
          direction: 'INBOUND',
          senderType: 'LEAD',
          senderName: event.leadName || 'Interessado',
          leadId: event.leadId || null,
          leadName: event.leadName || null,
          provider: 'gpt-maker',
          providerStatus: event.intentName,
          providerMessageId: event.eventId ? `${event.eventId}:inbound` : null,
          occurredAt,
          metadata: qualificationMetadata
        });
        inboundMessage = inboundSaved?.message || null;
      }
    }

    let saved = null;
    if (event.phone && event.agentText) {
      const activeConversation = conversation || inboundSaved?.conversation || null;
      const signature = normalizeMessageSignature(event.agentText);
      const candidates = activeConversation ? await prisma.whatsAppMessage.findMany({
        where: { conversationId: activeConversation.id, direction: 'OUTBOUND', senderType: 'AI' },
        orderBy: { createdAt: 'desc' },
        take: 20
      }) : [];
      const existingAgentMessage = candidates.find((message) => normalizeMessageSignature(message.body) === signature) || null;
      if (existingAgentMessage) {
        const updated = await mergeWhatsAppMessageMetadata(existingAgentMessage.id, {
          ...qualificationMetadata,
          inboundMessageId: inboundMessage?.id || null
        });
        saved = { conversation: activeConversation, message: updated };
      } else {
        saved = await recordWhatsAppMessage({
          phone: event.phone,
          body: event.agentText,
          direction: 'OUTBOUND',
          senderType: 'AI',
          senderName: event.agentName || 'Ana',
          leadId: event.leadId || null,
          leadName: event.leadName || null,
          provider: 'gpt-maker',
          providerStatus: event.intentName,
          providerMessageId: event.eventId ? `${event.eventId}:agent` : null,
          occurredAt,
          metadata: {
            ...qualificationMetadata,
            inboundMessageId: inboundMessage?.id || null
          }
        });
      }
    } else if (event.phone && !inboundMessage) {
      const latestMessage = conversation ? await prisma.whatsAppMessage.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' }
      }) : null;
      if (latestMessage) await mergeWhatsAppMessageMetadata(latestMessage.id, qualificationMetadata);
    }

    response.json({
      ok: true,
      received: true,
      saved: Boolean(saved || inboundMessage),
      conversationId: saved?.conversation?.id || inboundSaved?.conversation?.id || conversation?.id || null,
      messageId: saved?.message?.id || null,
      inboundMessageId: inboundMessage?.id || null,
      missingPhone: !event.phone,
      action: intentReply?.action || 'REGISTER_EVENT',
      reply: intentReply?.reply || '',
      leadFound: intentReply?.leadFound ?? Boolean(saved?.conversation?.leadId || inboundSaved?.conversation?.leadId || conversation?.leadId),
      hasRegisteredAddress: intentReply?.hasRegisteredAddress ?? false,
      addressShouldBeHidden: intentReply?.addressShouldBeHidden ?? true,
      addressSaved: intentReply?.addressSaved ?? false,
      existingAddressConfirmed: intentReply?.existingAddressConfirmed ?? false,
      message: event.phone
        ? 'Evento da Ana recebido pelo backend.'
        : 'Evento recebido, mas nao foi salvo em conversa porque faltou telefone.'
    });
  } catch (error) {
    console.error('[gptmaker:intention:error]', error.message);
    response.status(500).json({
      ok: false,
      message: 'Nao foi possivel registrar o evento da Ana no backend.'
    });
  }
});

app.get('/api/whatsapp/leads', requireAuth, async (request, response) => {
  if (!isAdminGeralUser(request.user) && userAssociationSlug(request.user) !== 'paulistana') {
    response.json({ leads: [], districts: [] });
    return;
  }

  const search = String(request.query?.search || '').trim();
  const district = String(request.query?.district || '').trim();
  const requestedPriority = String(request.query?.priority || '').trim().toUpperCase();
  const priority = ['HOT', 'WARM', 'COOL', 'COLD'].includes(requestedPriority) ? requestedPriority : '';
  const requestedAssociation = normalizeAssociationSlug(request.query?.association);
  const associationSlug = isAdminGeralUser(request.user)
    ? requestedAssociation || 'paulistana'
    : userAssociationSlug(request.user);
  const limit = Math.min(Math.max(Number(request.query?.limit) || 80, 1), 200);

  const where = {
    phone: { not: null },
    association: { is: { slug: associationSlug } },
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    ...(district ? { district: { is: { name: district } } } : {}),
    ...(priority ? { priority } : {})
  };

  try {
    const [leads, districts] = await Promise.all([
      prisma.lead.findMany({
        where,
        select: whatsappLeadSelect,
        orderBy: [{ name: 'asc' }],
        take: limit
      }),
      prisma.district.findMany({
        where: { association: { is: { slug: associationSlug } } },
        select: { name: true },
        orderBy: { name: 'asc' }
      })
    ]);

    response.json({
      leads: leads.map(serializeWhatsAppLead).filter((lead) => lead.phone),
      districts: districts.map((item) => item.name),
      limit,
      association: associationSlug
    });
  } catch (error) {
    console.error('[whatsapp:leads:error]', error.message);
    response.status(500).json({ leads: [], districts: [], message: 'Nao foi possivel buscar os leads do banco.' });
  }
});

app.post('/api/whatsapp/leads', requireAuth, async (request, response) => {
  if (!isAdminGeralUser(request.user) && userAssociationSlug(request.user) !== 'paulistana') {
    response.status(403).json({ message: 'Usuario sem permissao para cadastrar contatos.' });
    return;
  }

  const phone = normalizePhone(request.body?.phone);
  if (!phone) {
    response.status(400).json({ message: 'WhatsApp invalido. Informe DDI + DDD + numero, ou DDD + numero brasileiro.' });
    return;
  }

  const requestedAssociation = normalizeAssociationSlug(request.body?.association);
  const associationSlug = isAdminGeralUser(request.user)
    ? requestedAssociation || 'paulistana'
    : userAssociationSlug(request.user);
  const name = String(request.body?.name || '').trim();
  const districtName = String(request.body?.district || '').trim();
  const requestedPriority = String(request.body?.priority || '').trim().toUpperCase();
  const priority = ['HOT', 'WARM', 'COOL', 'COLD'].includes(requestedPriority) ? requestedPriority : null;

  try {
    const association = await prisma.association.findUnique({
      where: { slug: associationSlug },
      select: { id: true }
    });
    if (!association) {
      response.status(400).json({ message: 'Associacao nao encontrada para cadastrar o contato.' });
      return;
    }

    const district = districtName
      ? await prisma.district.upsert({
        where: { associationId_name: { associationId: association.id, name: districtName } },
        create: { associationId: association.id, name: districtName },
        update: {},
        select: { id: true }
      })
      : null;
    const existing = await prisma.lead.findFirst({
      where: {
        associationId: association.id,
        phone: { contains: phone.slice(-10) }
      },
      select: { id: true }
    });

    const lead = existing
      ? await prisma.lead.update({
        where: { id: existing.id },
        data: {
          phone,
          ...(name ? { name } : {}),
          priority,
          districtId: district?.id || null
        },
        select: whatsappLeadSelect
      })
      : await prisma.lead.create({
        data: {
          associationId: association.id,
          name: name || `Novo contato ${phone.slice(-4)}`,
          phone,
          priority,
          ...(district ? { districtId: district.id } : {})
        },
        select: whatsappLeadSelect
      });

    response.status(existing ? 200 : 201).json({
      ok: true,
      created: !existing,
      lead: serializeWhatsAppLead(lead)
    });
  } catch (error) {
    console.error('[whatsapp:lead:create:error]', error.message);
    response.status(500).json({ message: 'Nao foi possivel salvar o novo contato.' });
  }
});

app.post('/api/whatsapp/sync-zpro', requireAuth, async (request, response) => {
  response.status(410).json({
    ok: false,
    message: 'A sincronizacao do Z-PRO foi desativada. As conversas agora chegam em tempo real pelo webhook do WAHA.'
  });
  return;

  response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.set('Pragma', 'no-cache');
  response.set('Expires', '0');

  if (!isAdminGeralUser(request.user) && userAssociationSlug(request.user) !== 'paulistana') {
    response.status(403).json({ ok: false, message: 'Usuario sem permissao para sincronizar o Z-PRO.' });
    return;
  }

  try {
    const statuses = Array.isArray(request.body?.statuses)
      ? request.body.statuses
      : String(request.body?.statuses || 'open,pending,closed').split(',');
    const result = await syncZproConversations({
      statuses,
      limit: Math.min(Math.max(Number(request.body?.limit) || 120, 1), 300)
    });
    response.json({ ok: true, ...result });
  } catch (error) {
    console.error('[whatsapp:zpro-sync:error]', error.message);
    response.status(error.status || 500).json({
      ok: false,
      message: error.message || 'Nao foi possivel sincronizar conversas do Z-PRO.',
      providerStatus: error.providerStatus || null
    });
  }
});

app.get('/api/whatsapp/conversations', requireAuth, async (request, response) => {
  response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.set('Pragma', 'no-cache');
  response.set('Expires', '0');

  if (!isAdminGeralUser(request.user) && userAssociationSlug(request.user) !== 'paulistana') {
    response.json({ conversations: [] });
    return;
  }

  const phone = normalizePhone(request.query?.phone);
  const conversationId = String(request.query?.id || '').trim();
  const numericLeadId = externalLeadId(request.query?.leadId);
  const limit = Math.min(Math.max(Number(request.query?.limit) || 50, 1), 200);

  let where = {};
  if (conversationId) {
    where.id = conversationId;
  } else {
    const filters = [];
    if (phone) {
      const suffix = phone.slice(-10);
      filters.push({ phone });
      if (suffix) filters.push({ phone: { endsWith: suffix } });
    }
    if (numericLeadId) filters.push({ externalLeadId: numericLeadId });
    where = filters.length > 1 ? { OR: filters } : filters[0] || {};
  }

  const conversations = await prisma.whatsAppConversation.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      lead: { select: whatsappLeadSelect },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 200
      }
    }
  });

  const unresolved = conversations.filter((conversation) => !conversation.lead);
  const suffixes = Array.from(new Set(unresolved
    .map((conversation) => normalizePhone(conversation.phone)?.slice(-10))
    .filter(Boolean)));
  const candidates = suffixes.length
    ? await prisma.lead.findMany({
      where: {
        phone: { not: null },
        OR: suffixes.map((suffix) => ({ phone: { contains: suffix } }))
      },
      select: whatsappLeadSelect
    })
    : [];

  const enrichedConversations = conversations.map((conversation) => {
    const lead = conversation.lead
      || candidates.find((candidate) => storedPhoneMatches(candidate.phone, conversation.phone))
      || null;
    const serializedLead = lead ? serializeWhatsAppLead(lead) : null;
    const { lead: _lead, ...conversationData } = conversation;
    return {
      ...conversationData,
      messages: dedupeWhatsAppMessageList(conversationData.messages),
      lead: serializedLead,
      leadId: conversation.leadId || serializedLead?.id || null,
      externalLeadId: conversation.externalLeadId || serializedLead?.externalId || null,
      leadName: serializedLead?.name || conversation.leadName || null,
      district: serializedLead?.district || conversation.district || null,
      leadPriority: serializedLead?.priority || null
    };
  });

  response.json({ conversations: enrichedConversations });
});

app.post('/api/whatsapp/send', requireAuth, async (request, response) => {
  try {
    const sentAt = new Date();
    const result = await sendWhatsAppTextMessage({
      phone: request.body?.phone,
      message: request.body?.message,
      leadId: request.body?.leadId,
      templateId: request.body?.templateId
    });
    const saved = await recordWhatsAppMessage({
      phone: result.phone,
      body: request.body?.message,
      direction: 'OUTBOUND',
      senderType: request.body?.senderType || 'USER',
      senderName: request.user?.email || request.user?.sub || 'Sistema',
      leadId: request.body?.leadId,
      leadName: request.body?.name || null,
      district: request.body?.district || null,
      provider: result.provider,
      providerStatus: result.deliveryStatus,
      providerResponse: result.providerResponse,
      providerMessageId: providerMessageId(result.providerResponse),
      occurredAt: sentAt,
      metadata: { templateId: request.body?.templateId || null, attempts: result.attempts || [] }
    });
    await addGptMakerContext({
      phone: result.phone,
      message: request.body?.message,
      role: 'assistant'
    }).catch((error) => console.warn('[gptmaker:add-context:error]', error.message));
    response.json({
      ...result,
      conversationId: saved?.conversation?.id || null,
      messageId: saved?.message?.id || null,
      sentBy: request.user?.email || request.user?.sub || null,
      sentAt: sentAt.toISOString()
    });
  } catch (error) {
    console.error('[whatsapp:send:error]', error.message, error.providerResponse || '');
    const failed = await recordWhatsAppMessage({
      phone: request.body?.phone,
      body: request.body?.message,
      direction: 'OUTBOUND',
      senderType: request.body?.senderType || 'USER',
      senderName: request.user?.email || request.user?.sub || 'Sistema',
      leadId: request.body?.leadId,
      leadName: request.body?.name || null,
      district: request.body?.district || null,
      provider: whatsappProvider() === 'waha' ? 'waha-gows' : 'zpro-baileys',
      providerStatus: error.deliveryStatus || 'FAILED',
      providerResponse: error.providerResponse || null,
      occurredAt: new Date(),
      metadata: {
        failure: true,
        providerHttpStatus: error.providerStatus || null,
        attempts: error.providerAttempts || []
      }
    }).catch(() => null);
    response.status(error.status || 500).json({
      ok: false,
      message: error.message,
      deliveryStatus: error.deliveryStatus || 'FAILED',
      providerStatus: error.providerStatus || null,
      providerResponse: error.providerResponse || null,
      providerAttempts: error.providerAttempts || null,
      conversationId: failed?.conversation?.id || null,
      messageId: failed?.message?.id || null
    });
  }
});

app.post('/api/whatsapp/send-media', requireAuth, async (request, response) => {
  const mediaLabel = String(request.body?.mimeType || '').startsWith('video/') ? 'Vídeo' : 'Imagem';
  const savedBody = String(request.body?.message || '').trim() || `[${mediaLabel}] ${request.body?.fileName || 'anexo'}`;
  try {
    const sentAt = new Date();
    const result = await sendWhatsAppMediaMessage({
      phone: request.body?.phone,
      message: request.body?.message,
      fileName: request.body?.fileName,
      mimeType: request.body?.mimeType,
      base64Data: request.body?.base64Data,
      leadId: request.body?.leadId
    });
    const saved = await recordWhatsAppMessage({
      phone: result.phone,
      body: savedBody,
      direction: 'OUTBOUND',
      senderType: request.body?.senderType || 'USER',
      senderName: request.user?.email || request.user?.sub || 'Sistema',
      leadId: request.body?.leadId,
      leadName: request.body?.name || null,
      district: request.body?.district || null,
      provider: result.provider,
      providerStatus: result.deliveryStatus,
      providerResponse: result.providerResponse,
      providerMessageId: providerMessageId(result.providerResponse),
      occurredAt: sentAt,
      metadata: { media: result.media }
    });
    await addGptMakerContext({
      phone: result.phone,
      message: savedBody,
      role: 'assistant'
    }).catch((error) => console.warn('[gptmaker:add-context:error]', error.message));
    response.json({
      ...result,
      conversationId: saved?.conversation?.id || null,
      messageId: saved?.message?.id || null,
      sentAt: sentAt.toISOString()
    });
  } catch (error) {
    console.error('[whatsapp:send-media:error]', error.message, error.providerResponse || '');
    await recordWhatsAppMessage({
      phone: request.body?.phone,
      body: savedBody,
      direction: 'OUTBOUND',
      senderType: request.body?.senderType || 'USER',
      senderName: request.user?.email || request.user?.sub || 'Sistema',
      leadId: request.body?.leadId,
      leadName: request.body?.name || null,
      district: request.body?.district || null,
      provider: whatsappProvider() === 'waha' ? 'waha-gows' : 'zpro-baileys',
      providerStatus: error.deliveryStatus || 'FAILED',
      providerResponse: error.providerResponse || null,
      occurredAt: new Date(),
      metadata: {
        failure: true,
        media: { fileName: request.body?.fileName || null, mimeType: request.body?.mimeType || null }
      }
    }).catch(() => null);
    response.status(error.status || 500).json({ ok: false, message: error.message });
  }
});

app.post('/api/whatsapp/send-batch', requireAuth, async (request, response) => {
  const recipients = Array.isArray(request.body?.recipients) ? request.body.recipients.slice(0, 50) : [];
  const message = request.body?.message;
  const listName = String(request.body?.listName || '').trim().slice(0, 120);
  const broadcastId = String(request.body?.broadcastId || '').trim().slice(0, 120) || randomUUID();
  const recipientTotal = Math.max(Number(request.body?.recipientTotal) || recipients.length, recipients.length);
  if (!recipients.length) {
    response.status(400).json({ ok: false, message: 'Informe ao menos um destinatario.' });
    return;
  }
  if (!listName) {
    response.status(400).json({ ok: false, message: 'Informe o nome da transmissao.' });
    return;
  }

  const results = [];
  const broadcast = await prisma.whatsAppBroadcast.upsert({
    where: { broadcastKey: broadcastId },
    create: {
      broadcastKey: broadcastId,
      name: listName,
      messageTemplate: String(message || '').trim(),
      recipientTotal,
      createdById: request.user?.sub || null,
      createdByName: request.user?.email || request.user?.name || request.user?.sub || 'Sistema'
    },
    update: {
      name: listName,
      messageTemplate: String(message || '').trim(),
      recipientTotal: Math.max(recipientTotal, recipients.length)
    }
  });

  for (const recipient of recipients) {
    const phone = recipient.phone || recipient.tel || recipient;
    const normalizedPhone = normalizePhone(phone);
    const personalizedMessage = renderWhatsAppTemplate(message, recipient);
    const recipientRecord = await prisma.whatsAppBroadcastRecipient.upsert({
      where: { broadcastId_phone: { broadcastId: broadcast.id, phone: normalizedPhone || String(phone) } },
      create: {
        broadcastId: broadcast.id,
        leadId: recipient.leadId || recipient.id || null,
        externalLeadId: Number.isFinite(Number(recipient.externalLeadId)) ? Number(recipient.externalLeadId) : null,
        leadName: recipient.name || null,
        phone: normalizedPhone || String(phone),
        district: recipient.district || null,
        material: recipient.material || recipient.theme || null,
        personalizedMessage,
        status: 'PENDENTE'
      },
      update: {
        leadId: recipient.leadId || recipient.id || null,
        externalLeadId: Number.isFinite(Number(recipient.externalLeadId)) ? Number(recipient.externalLeadId) : null,
        leadName: recipient.name || null,
        district: recipient.district || null,
        material: recipient.material || recipient.theme || null,
        personalizedMessage,
        status: 'PENDENTE',
        error: null
      }
    });
    try {
      const result = await sendWhatsAppTextMessage({
        phone,
        message: personalizedMessage,
        leadId: recipient.leadId || recipient.id || null,
        templateId: request.body?.templateId || null
      });
      const saved = await recordWhatsAppMessage({
        phone: result.phone,
        body: personalizedMessage,
        direction: 'OUTBOUND',
        senderType: request.body?.senderType || 'USER',
        senderName: request.user?.email || request.user?.sub || 'Sistema',
        leadId: recipient.leadId || recipient.id || null,
        leadName: recipient.name || null,
        district: recipient.district || null,
        provider: result.provider,
        providerStatus: result.deliveryStatus,
        providerResponse: result.providerResponse,
        providerMessageId: providerMessageId(result.providerResponse),
        metadata: {
          templateId: request.body?.templateId || null,
          batch: true,
          broadcastId,
          listName,
          recipientTotal,
          templateMessage: message,
          material: recipient.material || recipient.theme || null,
          theme: recipient.theme || recipient.material || null,
          leadAddress: recipient.address || null,
          attempts: result.attempts || []
        }
      });
      await addGptMakerContext({
        phone: result.phone,
        message: personalizedMessage,
        role: 'assistant'
      }).catch((error) => console.warn('[gptmaker:add-context:error]', error.message));
      await prisma.whatsAppBroadcastRecipient.update({
        where: { id: recipientRecord.id },
        data: {
          status: 'ENVIADO',
          deliveryStatus: result.deliveryStatus,
          conversationId: saved?.conversation?.id || null,
          messageId: saved?.message?.id || null,
          sentAt: new Date(),
          error: null
        }
      });
      results.push({
        ok: true,
        phone: result.phone,
        leadId: recipient.leadId || recipient.id || null,
        deliveryStatus: result.deliveryStatus,
        conversationId: saved?.conversation?.id || null,
        messageId: saved?.message?.id || null
      });
    } catch (error) {
      const failed = await recordWhatsAppMessage({
        phone: recipient.phone || recipient.tel || recipient,
        body: personalizedMessage,
        direction: 'OUTBOUND',
        senderType: request.body?.senderType || 'USER',
        senderName: request.user?.email || request.user?.sub || 'Sistema',
        leadId: recipient.leadId || recipient.id || null,
        leadName: recipient.name || null,
        district: recipient.district || null,
        provider: whatsappProvider() === 'waha' ? 'waha-gows' : 'zpro-baileys',
        providerStatus: error.deliveryStatus || 'FAILED',
        providerResponse: error.providerResponse || null,
        metadata: {
          failure: true,
          batch: true,
          broadcastId,
          listName,
          recipientTotal,
          material: recipient.material || recipient.theme || null,
          theme: recipient.theme || recipient.material || null,
          leadAddress: recipient.address || null,
          providerHttpStatus: error.providerStatus || null,
          attempts: error.providerAttempts || []
        }
      }).catch(() => null);
      await prisma.whatsAppBroadcastRecipient.update({
        where: { id: recipientRecord.id },
        data: {
          status: 'FALHA',
          deliveryStatus: error.deliveryStatus || 'FAILED',
          conversationId: failed?.conversation?.id || null,
          messageId: failed?.message?.id || null,
          error: error.message || 'Falha no envio'
        }
      });
      results.push({
        ok: false,
        phone,
        leadId: recipient.leadId || recipient.id || null,
        message: error.message,
        deliveryStatus: error.deliveryStatus || 'FAILED',
        conversationId: failed?.conversation?.id || null,
        messageId: failed?.message?.id || null
      });
    }
  }

  const sent = results.filter((item) => item.ok).length;
  const failed = results.length - sent;
  const firstFailure = results.find((item) => !item.ok);
  const messageText = sent
    ? failed
      ? `${sent} mensagem(ns) foram aceitas pelo WAHA e ${failed} falharam.`
      : `${sent} mensagem(ns) foram aceitas pelo WAHA.`
    : `Nenhuma mensagem foi aceita pelo WAHA.${firstFailure?.message ? ` Motivo: ${firstFailure.message}` : ''}`;

  response.status(sent ? 200 : 502).json({
    ok: sent > 0,
    message: messageText,
    total: results.length,
    sent,
    failed,
    results
  });
});

app.get('/api/whatsapp/broadcast-analytics', requireAuth, async (request, response) => {
  response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (!isAdminGeralUser(request.user) && userAssociationSlug(request.user) !== 'paulistana') {
    response.json({ transmissions: [] });
    return;
  }

  try {
    const savedBroadcasts = await prisma.whatsAppBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        recipients: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (savedBroadcasts.length) {
      const conversationIds = Array.from(new Set(savedBroadcasts.flatMap((broadcast) => (
        broadcast.recipients.map((recipient) => recipient.conversationId).filter(Boolean)
      ))));
      const earliestCreatedAt = savedBroadcasts.reduce((earliest, broadcast) => (
        new Date(broadcast.createdAt) < earliest ? new Date(broadcast.createdAt) : earliest
      ), new Date(savedBroadcasts[0].createdAt));
      const inboundMessages = conversationIds.length ? await prisma.whatsAppMessage.findMany({
        where: {
          direction: 'INBOUND',
          conversationId: { in: conversationIds },
          createdAt: { gte: earliestCreatedAt }
        },
        orderBy: { createdAt: 'asc' },
        select: { conversationId: true, createdAt: true }
      }) : [];
      const inboundByConversation = new Map();
      for (const inbound of inboundMessages) {
        if (!inboundByConversation.has(inbound.conversationId)) inboundByConversation.set(inbound.conversationId, []);
        inboundByConversation.get(inbound.conversationId).push(inbound.createdAt);
      }

      response.json({
        transmissions: savedBroadcasts.map((broadcast) => {
          const recipients = broadcast.recipients.map((recipient) => {
            const replies = inboundByConversation.get(recipient.conversationId) || [];
            const repliedAt = replies.find((createdAt) => (
              new Date(createdAt) >= new Date(recipient.sentAt || broadcast.createdAt)
            )) || recipient.repliedAt || null;
            const deliveryStatus = String(recipient.deliveryStatus || '').toUpperCase();
            const failed = recipient.status === 'FALHA' || deliveryStatus.startsWith('FAILED');
            const delivered = Boolean(repliedAt) || ['DELIVERED', 'READ', 'PLAYED', 'DELIVERED_BY_REPLY'].includes(deliveryStatus);
            return {
              id: recipient.id,
              leadId: recipient.leadId,
              name: recipient.leadName || 'Contato sem nome',
              phone: recipient.phone,
              district: recipient.district,
              material: recipient.material,
              status: failed ? 'FALHA' : recipient.status,
              deliveryStatus: recipient.deliveryStatus,
              sentAt: recipient.sentAt,
              repliedAt,
              error: recipient.error,
              delivered
            };
          });
          return {
            id: broadcast.broadcastKey,
            name: broadcast.name,
            message: broadcast.messageTemplate,
            createdAt: broadcast.createdAt,
            targeted: Math.max(Number(broadcast.recipientTotal) || 0, recipients.length),
            sent: recipients.filter((recipient) => recipient.status === 'ENVIADO').length,
            delivered: recipients.filter((recipient) => recipient.delivered).length,
            responded: recipients.filter((recipient) => recipient.repliedAt).length,
            failed: recipients.filter((recipient) => recipient.status === 'FALHA').length,
            lastError: recipients.find((recipient) => recipient.status === 'FALHA' && recipient.error)?.error || null,
            recipients
          };
        })
      });
      return;
    }

    const outboundMessages = await prisma.whatsAppMessage.findMany({
      where: { direction: 'OUTBOUND' },
      orderBy: { createdAt: 'desc' },
      take: 20000,
      select: {
        id: true,
        conversationId: true,
        body: true,
        providerStatus: true,
        metadata: true,
        createdAt: true,
        sentAt: true
      }
    });
    const transmissionIdFor = (messageItem) => {
      const metadata = messageItem.metadata && typeof messageItem.metadata === 'object'
        ? messageItem.metadata
        : {};
      if (!metadata.batch) return null;
      const legacyDay = messageItem.createdAt.toISOString().slice(0, 10);
      return String(metadata.broadcastId || `legacy:${metadata.listName || 'sem-nome'}:${messageItem.body}:${legacyDay}`);
    };
    const batchMessages = outboundMessages
      .filter((messageItem) => messageItem.metadata?.batch)
      .reverse();
    const transmissions = new Map();

    for (const messageItem of batchMessages) {
      const metadata = messageItem.metadata && typeof messageItem.metadata === 'object'
        ? messageItem.metadata
        : {};
      const transmissionId = transmissionIdFor(messageItem);
      if (!transmissions.has(transmissionId)) {
        transmissions.set(transmissionId, {
          id: transmissionId,
          name: metadata.listName || 'Transmissão sem nome',
          message: messageItem.body,
          createdAt: messageItem.sentAt || messageItem.createdAt,
          recipientTarget: Number(metadata.recipientTotal) || 0,
          recipients: new Set(),
          sent: new Set(),
          delivered: new Set(),
          failed: new Set(),
          responded: new Set()
        });
      }

      const transmission = transmissions.get(transmissionId);
      const status = String(messageItem.providerStatus || 'ACCEPTED').toUpperCase();
      const conversationId = messageItem.conversationId;
      transmission.recipientTarget = Math.max(transmission.recipientTarget, Number(metadata.recipientTotal) || 0);
      transmission.recipients.add(conversationId);
      if (status.startsWith('FAILED')) {
        transmission.failed.add(conversationId);
      } else {
        transmission.sent.add(conversationId);
      }
      if (['DELIVERED', 'READ', 'PLAYED', 'DELIVERED_BY_REPLY'].includes(status)) {
        transmission.delivered.add(conversationId);
      }
    }

    const recentTransmissions = Array.from(transmissions.values())
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, 12);
    const recentIds = new Set(recentTransmissions.map((item) => item.id));
    const conversationIds = Array.from(new Set(recentTransmissions.flatMap((item) => Array.from(item.recipients))));
    const conversationIdSet = new Set(conversationIds);

    if (recentTransmissions.length && conversationIds.length) {
      const earliestCreatedAt = recentTransmissions.reduce((earliest, item) => (
        new Date(item.createdAt) < earliest ? new Date(item.createdAt) : earliest
      ), new Date(recentTransmissions[0].createdAt));
      const inboundMessages = await prisma.whatsAppMessage.findMany({
        where: {
          direction: 'INBOUND',
          conversationId: { in: conversationIds },
          createdAt: { gte: earliestCreatedAt }
        },
        orderBy: { createdAt: 'asc' },
        select: { conversationId: true, createdAt: true }
      });
      const outboundTimeline = new Map();
      for (const outbound of outboundMessages) {
        if (!conversationIdSet.has(outbound.conversationId) || new Date(outbound.createdAt) < earliestCreatedAt) continue;
        if (!outboundTimeline.has(outbound.conversationId)) outboundTimeline.set(outbound.conversationId, []);
        outboundTimeline.get(outbound.conversationId).push({
          createdAt: outbound.createdAt,
          transmissionId: transmissionIdFor(outbound)
        });
      }
      for (const entries of outboundTimeline.values()) {
        entries.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
      }
      for (const inbound of inboundMessages) {
        const timeline = outboundTimeline.get(inbound.conversationId) || [];
        const preceding = [...timeline].reverse().find((item) => new Date(item.createdAt) <= new Date(inbound.createdAt));
        if (!preceding || !recentIds.has(preceding.transmissionId)) continue;
        transmissions.get(preceding.transmissionId)?.responded.add(inbound.conversationId);
        transmissions.get(preceding.transmissionId)?.delivered.add(inbound.conversationId);
      }
    }

    response.json({
      transmissions: recentTransmissions.map((transmission) => ({
        id: transmission.id,
        name: transmission.name,
        message: transmission.message,
        createdAt: transmission.createdAt,
        targeted: Math.max(transmission.recipientTarget, transmission.recipients.size),
        sent: transmission.sent.size,
        delivered: transmission.delivered.size,
        responded: transmission.responded.size,
        failed: transmission.failed.size
      }))
    });
  } catch (error) {
    console.error('[whatsapp:broadcast-analytics:error]', error.message);
    response.status(500).json({ message: 'Não foi possível carregar os indicadores das transmissões.' });
  }
});

app.get('/api/webhooks/zpro/whatsapp', (request, response) => {
  response.status(410).json({ ok: false, provider: 'zpro-baileys', webhook: 'disabled' });
  return;

  if (!webhookAllowed(request)) {
    response.status(401).json({ ok: false, message: 'Webhook nao autorizado' });
    return;
  }
  response.json({ ok: true, provider: 'zpro-baileys', webhook: 'ready' });
});

app.post('/api/webhooks/zpro/whatsapp', async (request, response) => {
  response.status(410).json({
    ok: false,
    received: false,
    message: 'Webhook do Z-PRO desativado. Use /api/webhooks/waha/whatsapp.'
  });
  return;

  if (!webhookAllowed(request)) {
    response.status(401).json({ ok: false, message: 'Webhook nao autorizado' });
    return;
  }

  const payload = coerceWebhookPayload(request.body);
  const event = readZproMessage(payload);
  const normalizedStatus = recognizedDeliveryStatus(event.status);
  console.log('[zpro:webhook]', JSON.stringify(webhookDiagnostics(request, payload, event)));

  if (normalizedStatus) {
    let updated = { count: 0 };
    if (event.messageId) {
      updated = await prisma.whatsAppMessage.updateMany({
        where: { providerMessageId: event.messageId },
        data: {
          providerStatus: normalizedStatus,
          metadata: {
            status: normalizedStatus,
            rawStatus: event.status,
            channelId: event.channelId,
            event: event.event,
            raw: payload
          }
        }
      });
    }
    if (!updated.count && event.phone) {
      const conversation = await prisma.whatsAppConversation.findUnique({
        where: { phone: normalizePhone(event.phone) || event.phone },
        select: {
          messages: {
            where: {
              direction: 'OUTBOUND',
              providerStatus: { in: ['ACCEPTED', 'SERVER_ACK', 'PENDING', 'QUEUED', 'SENT'] },
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            },
            orderBy: { createdAt: 'desc' },
            take: 2,
            select: { id: true }
          }
        }
      }).catch(() => null);
      const latestMessageId = conversation?.messages?.length === 1 ? conversation.messages[0].id : null;
      if (latestMessageId) {
        await prisma.whatsAppMessage.update({
          where: { id: latestMessageId },
          data: {
            providerStatus: normalizedStatus,
            metadata: {
              status: normalizedStatus,
              rawStatus: event.status,
              channelId: event.channelId,
              event: event.event,
              raw: payload
            }
          }
        });
        updated = { count: 1 };
      }
    }
    if (!event.text || (event.fromMe && updated.count)) {
      response.json({
        ok: true,
        received: true,
        statusUpdated: updated.count,
        providerMessageId: event.messageId
      });
      return;
    }
  }

  if (event.fromMe && event.text && event.messageId && !normalizedStatus) {
    const echoed = await prisma.whatsAppMessage.findFirst({
      where: { providerMessageId: event.messageId, direction: 'OUTBOUND' },
      select: { id: true }
    }).catch(() => null);
    if (echoed?.id) {
      await prisma.whatsAppMessage.update({
        where: { id: echoed.id },
        data: {
          providerStatus: 'SERVER_ACK',
          metadata: {
            status: 'SERVER_ACK',
            rawStatus: event.status,
            channelId: event.channelId,
            event: event.event,
            raw: payload
          }
        }
      });
      response.json({
        ok: true,
        received: true,
        statusUpdated: 1,
        providerMessageId: event.messageId
      });
      return;
    }
  }

  if (!event.fromMe && event.messageId) {
    const existingInbound = await prisma.whatsAppMessage.findFirst({
      where: {
        providerMessageId: event.messageId,
        direction: 'INBOUND'
      },
      select: { id: true, conversationId: true }
    }).catch(() => null);
    if (existingInbound?.id) {
      response.json({
        ok: true,
        received: true,
        duplicate: true,
        conversationId: existingInbound.conversationId,
        messageId: existingInbound.id
      });
      return;
    }
  }

  if (!event.fromMe && event.phone && event.text) {
    const normalizedPhone = normalizePhone(event.phone) || event.phone;
    const recentConversation = await prisma.whatsAppConversation.findUnique({
      where: { phone: normalizedPhone },
      include: {
        messages: {
          where: { createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
          orderBy: { createdAt: 'desc' },
          take: 30
        }
      }
    }).catch(() => null);
    const incomingSignature = normalizeMessageSignature(event.text);
    const repeatedInbound = (recentConversation?.messages || []).find((message) => (
      message.direction === 'INBOUND'
      && normalizeMessageSignature(message.body) === incomingSignature
    ));
    if (repeatedInbound?.id) {
      response.json({
        ok: true,
        received: true,
        duplicate: true,
        reason: 'recent-inbound-body',
        conversationId: repeatedInbound.conversationId,
        messageId: repeatedInbound.id
      });
      return;
    }
    const outboundEcho = (recentConversation?.messages || []).find((message) => (
      message.direction === 'OUTBOUND'
      && normalizeMessageSignature(message.body) === incomingSignature
    ));
    if (outboundEcho?.id) {
      await prisma.whatsAppMessage.update({
        where: { id: outboundEcho.id },
        data: {
          providerStatus: normalizedStatus || 'SERVER_ACK',
          metadata: {
            ...(outboundEcho.metadata && typeof outboundEcho.metadata === 'object' ? outboundEcho.metadata : {}),
            outboundEchoIgnored: true,
            rawStatus: event.status,
            channelId: event.channelId,
            event: event.event
          }
        }
      }).catch(() => null);
      response.json({
        ok: true,
        received: true,
        duplicate: true,
        reason: 'outbound-echo',
        conversationId: outboundEcho.conversationId,
        messageId: outboundEcho.id
      });
      return;
    }
  }

  const saved = await recordWhatsAppMessage({
    phone: event.phone,
    body: event.text,
    direction: event.fromMe ? 'OUTBOUND' : 'INBOUND',
    senderType: event.fromMe ? 'SYSTEM' : 'LEAD',
    senderName: event.fromMe ? 'WhatsApp' : event.name,
    provider: 'zpro-baileys',
    providerStatus: normalizedStatus || event.event,
    providerMessageId: event.messageId,
    occurredAt: new Date(),
    metadata: {
      channelId: event.channelId,
      event: event.event,
      raw: payload
    }
  });

  response.json({
    ok: true,
    received: true,
    saved: Boolean(saved),
    conversationId: saved?.conversation?.id || null,
    messageId: saved?.message?.id || null,
    agentReplyQueued: false
  });
});

app.get('/api/webhooks/waha/whatsapp', (request, response) => {
  if (!wahaWebhookAllowed(request)) {
    response.status(401).json({ ok: false, message: 'Webhook nao autorizado' });
    return;
  }
  response.json({ ok: true, provider: 'waha-gows', webhook: 'ready' });
});

app.post('/api/webhooks/waha/whatsapp', async (request, response) => {
  if (!wahaWebhookAllowed(request)) {
    response.status(401).json({ ok: false, message: 'Webhook nao autorizado' });
    return;
  }

  const payload = coerceWebhookPayload(request.body);
  const event = readWahaMessage(payload);
  const normalizedStatus = recognizedDeliveryStatus(event.status);
  console.log('[waha:webhook]', JSON.stringify({
    event: event.event,
    session: event.session,
    phone: event.phone,
    fromMe: event.fromMe,
    messageId: event.messageId,
    status: normalizedStatus
  }));

  if (event.event === 'message.ack') {
    const messages = event.messageId
      ? await prisma.whatsAppMessage.findMany({ where: { providerMessageId: event.messageId } })
      : [];
    await Promise.all(messages.map((message) => prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        providerStatus: normalizedStatus || 'ACCEPTED',
        metadata: {
          ...(message.metadata && typeof message.metadata === 'object' ? message.metadata : {}),
          deliveryEvent: event.event,
          deliverySession: event.session,
          deliveryPayload: payload
        }
      }
    })));
    response.json({ ok: true, received: true, statusUpdated: messages.length });
    return;
  }

  if (!['message', 'message.any'].includes(event.event)) {
    response.json({ ok: true, received: true, ignored: true, event: event.event || null });
    return;
  }

  if (!event.phone || !event.text) {
    response.json({ ok: true, received: true, ignored: true, reason: 'message-without-phone-or-text' });
    return;
  }

  const saved = await recordWhatsAppMessage({
    phone: event.phone,
    body: event.text,
    direction: event.fromMe ? 'OUTBOUND' : 'INBOUND',
    senderType: event.fromMe ? 'SYSTEM' : 'LEAD',
    senderName: event.fromMe ? 'WhatsApp' : event.name,
    provider: 'waha-gows',
    providerStatus: normalizedStatus || event.event,
    providerMessageId: event.messageId,
    occurredAt: event.occurredAt,
    metadata: {
      session: event.session,
      event: event.event,
      raw: payload
    }
  });

  if (saved?.created && saved.message?.direction === 'INBOUND') {
    maybeReplyWithGptMaker(saved, saved.message).catch((error) => {
      console.error('[gptmaker:auto-reply:error]', error.message, error.providerResponse || '');
    });
  }

  response.json({
    ok: true,
    received: true,
    saved: Boolean(saved),
    duplicate: Boolean(saved && !saved.created),
    conversationId: saved?.conversation?.id || null,
    messageId: saved?.message?.id || null,
    agentReplyQueued: Boolean(saved?.created && saved.message?.direction === 'INBOUND' && gptMakerConfig().configured)
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Amigos NT backend running on port ${port}`);
});
