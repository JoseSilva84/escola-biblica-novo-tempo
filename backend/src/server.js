import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createSessionToken, requireAuth, sessionCookieOptions, validateCredentials, verifySessionToken } from './auth.js';
import { getDashboardData } from './data.js';
import { prisma } from './prisma.js';

const app = express();
const port = Number(process.env.PORT || 4000);

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

  return {
    event: payload.event || payload.type || payload.action || 'zpro.webhook',
    channelId: payload.channelId || payload.sessionId || data.channelId || data.sessionId || data.whatsappId || ticket.channelId || ticket.whatsappId || null,
    messageId: data.id || data.messageId || key.id || data.message?.key?.id || null,
    fromMe,
    phone,
    name: contact.name || contact.pushName || data.pushName || data.senderName || null,
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
    || data?.data?.id
    || data?.data?.messageId
    || null;
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
  const normalizedPhone = normalizePhone(phone) || String(phone || '').replace(/\D/g, '');
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

  return { conversation, message };
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return '';
  if (digits.length <= 11) return `55${digits}`;
  return digits;
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
  return { baseUrl, token, channelId, apiId, sendPath };
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
    error.providerResponse = data;
    error.providerAttempts = attempts;
    throw error;
  }

  return {
    ok: true,
    provider: 'zpro-baileys',
    channelId: config.channelId || null,
    apiId: config.apiId,
    phone: normalizedPhone,
    transport,
    attempts,
    providerResponse: data
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
app.use(express.json({ limit: '2mb', type: ['application/json', 'application/*+json'] }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.text({ limit: '2mb', type: ['text/*', 'application/xml'] }));
app.use(cookieParser());

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

app.get('/api/dashboard', requireAuth, (_request, response) => {
  response.json(getDashboardData());
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

app.get('/api/whatsapp/conversations', requireAuth, async (request, response) => {
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
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 200
      }
    }
  });

  response.json({ conversations });
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
      providerStatus: 'SENT',
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
    response.status(error.status || 500).json({
      ok: false,
      message: error.message,
      providerStatus: error.providerStatus || null,
      providerResponse: error.providerResponse || null,
      providerAttempts: error.providerAttempts || null
    });
  }
});

app.post('/api/whatsapp/send-batch', requireAuth, async (request, response) => {
  const recipients = Array.isArray(request.body?.recipients) ? request.body.recipients.slice(0, 50) : [];
  const message = request.body?.message;
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
        providerStatus: 'SENT',
        providerResponse: result.providerResponse,
        providerMessageId: providerMessageId(result.providerResponse),
        metadata: { templateId: request.body?.templateId || null, batch: true, attempts: result.attempts || [] }
      });
      results.push({
        ok: true,
        phone: result.phone,
        leadId: recipient.leadId || recipient.id || null,
        conversationId: saved?.conversation?.id || null,
        messageId: saved?.message?.id || null
      });
    } catch (error) {
      results.push({
        ok: false,
        phone: recipient.phone || recipient.tel || recipient,
        leadId: recipient.leadId || recipient.id || null,
        message: error.message
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
  console.log('[zpro:webhook]', JSON.stringify(webhookDiagnostics(request, payload, event)));

  const saved = await recordWhatsAppMessage({
    phone: event.phone,
    body: event.text,
    direction: event.fromMe ? 'OUTBOUND' : 'INBOUND',
    senderType: event.fromMe ? 'SYSTEM' : 'LEAD',
    senderName: event.fromMe ? 'WhatsApp' : event.name,
    provider: 'zpro-baileys',
    providerStatus: event.event,
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
