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
  const received = String(
    request.headers['x-webhook-secret']
    || request.headers['x-zpro-webhook-secret']
    || request.query?.token
    || ''
  ).trim();
  return Boolean(secret && received === secret);
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
  const phone = String(rawPhone).replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
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
  const numericLeadId = externalLeadId(leadId);
  if (numericLeadId) {
    const lead = await prisma.lead.findFirst({
      where: { externalId: numericLeadId },
      select: { id: true, externalId: true, name: true, phone: true, district: { select: { name: true } } }
    });
    if (lead) return lead;
  }

  const textLeadId = String(leadId || '').trim();
  if (textLeadId && !numericLeadId && !textLeadId.startsWith('manual-')) {
    const lead = await prisma.lead.findUnique({
      where: { id: textLeadId },
      select: { id: true, externalId: true, name: true, phone: true, district: { select: { name: true } } }
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
      select: { id: true, externalId: true, name: true, phone: true, district: { select: { name: true } } }
    });
    if (lead) return lead;
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

  const message = await prisma.whatsAppMessage.create({
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

  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: occurredAt }
  }).catch(() => null);

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

  return { conversation, message };
}

function normalizePhone(value) {
  const raw = String(value || '').trim().replace(/@s\.whatsapp\.net$/i, '');
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

app.get('/api/whatsapp/conversations', requireAuth, async (request, response) => {
  response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.set('Pragma', 'no-cache');
  response.set('Expires', '0');

  if (!isAdminGeralUser(request.user) && userAssociationSlug(request.user) !== 'paulistana') {
    response.json({ conversations: [] });
    return;
  }

  const phone = normalizePhone(request.query?.phone);
  const numericLeadId = externalLeadId(request.query?.leadId);
  const limit = Math.min(Math.max(Number(request.query?.limit) || 50, 1), 200);

  const where = {};
  if (phone) where.phone = phone;
  if (numericLeadId) where.externalLeadId = numericLeadId;

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
    const result = await sendZproTextMessage({
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
    response.json({
      ...result,
      conversationId: saved?.conversation?.id || null,
      messageId: saved?.message?.id || null,
      sentBy: request.user?.email || request.user?.sub || null,
      sentAt: sentAt.toISOString()
    });
  } catch (error) {
    console.error('[zpro:send:error]', error.message, error.providerResponse || '');
    const failed = await recordWhatsAppMessage({
      phone: request.body?.phone,
      body: request.body?.message,
      direction: 'OUTBOUND',
      senderType: request.body?.senderType || 'USER',
      senderName: request.user?.email || request.user?.sub || 'Sistema',
      leadId: request.body?.leadId,
      leadName: request.body?.name || null,
      district: request.body?.district || null,
      provider: 'zpro-baileys',
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
    const result = await sendZproMediaMessage({
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
    response.json({
      ...result,
      conversationId: saved?.conversation?.id || null,
      messageId: saved?.message?.id || null,
      sentAt: sentAt.toISOString()
    });
  } catch (error) {
    console.error('[zpro:send-media:error]', error.message, error.providerResponse || '');
    await recordWhatsAppMessage({
      phone: request.body?.phone,
      body: savedBody,
      direction: 'OUTBOUND',
      senderType: request.body?.senderType || 'USER',
      senderName: request.user?.email || request.user?.sub || 'Sistema',
      leadId: request.body?.leadId,
      leadName: request.body?.name || null,
      district: request.body?.district || null,
      provider: 'zpro-baileys',
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
  const listName = String(request.body?.listName || '').trim().slice(0, 120) || null;
  if (!recipients.length) {
    response.status(400).json({ ok: false, message: 'Informe ao menos um destinatario.' });
    return;
  }

  const results = [];
  for (const recipient of recipients) {
    try {
      const result = await sendZproTextMessage({
        phone: recipient.phone || recipient.tel || recipient,
        message,
        leadId: recipient.leadId || recipient.id || null,
        templateId: request.body?.templateId || null
      });
      const saved = await recordWhatsAppMessage({
        phone: result.phone,
        body: message,
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
        metadata: { templateId: request.body?.templateId || null, batch: true, listName, attempts: result.attempts || [] }
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
        body: message,
        direction: 'OUTBOUND',
        senderType: request.body?.senderType || 'USER',
        senderName: request.user?.email || request.user?.sub || 'Sistema',
        leadId: recipient.leadId || recipient.id || null,
        leadName: recipient.name || null,
        district: recipient.district || null,
        provider: 'zpro-baileys',
        providerStatus: error.deliveryStatus || 'FAILED',
        providerResponse: error.providerResponse || null,
        metadata: {
          failure: true,
          batch: true,
          listName,
          providerHttpStatus: error.providerStatus || null,
          attempts: error.providerAttempts || []
        }
      }).catch(() => null);
      results.push({
        ok: false,
        phone: recipient.phone || recipient.tel || recipient,
        leadId: recipient.leadId || recipient.id || null,
        message: error.message,
        deliveryStatus: error.deliveryStatus || 'FAILED',
        conversationId: failed?.conversation?.id || null,
        messageId: failed?.message?.id || null
      });
    }
  }

  response.json({
    ok: results.some((item) => item.ok),
    total: results.length,
    sent: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results
  });
});

app.get('/api/webhooks/zpro/whatsapp', (request, response) => {
  if (!webhookAllowed(request)) {
    response.status(401).json({ ok: false, message: 'Webhook nao autorizado' });
    return;
  }
  response.json({ ok: true, provider: 'zpro-baileys', webhook: 'ready' });
});

app.post('/api/webhooks/zpro/whatsapp', async (request, response) => {
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
    messageId: saved?.message?.id || null
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Amigos NT backend running on port ${port}`);
});
