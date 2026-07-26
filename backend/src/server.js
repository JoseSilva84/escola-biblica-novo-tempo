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

function readZproMessage(payload = {}) {
  const data = payload.data || payload.message || payload;
  const contact = data.contact || data.sender || data.from || {};
  const rawPhone = data.remoteJid || data.from || data.phone || contact.phone || contact.number || '';
  const phone = String(rawPhone).replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
  const text = data.text
    || data.body
    || data.message?.conversation
    || data.message?.extendedTextMessage?.text
    || data.messages?.[0]?.message?.conversation
    || '';

  return {
    event: payload.event || payload.type || payload.action || 'zpro.webhook',
    channelId: payload.channelId || payload.sessionId || data.channelId || data.sessionId || null,
    messageId: data.id || data.messageId || data.key?.id || null,
    fromMe: Boolean(data.fromMe || data.key?.fromMe),
    phone,
    name: contact.name || contact.pushName || data.pushName || null,
    text: String(text || '').trim()
  };
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
  let providerResponse = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data = await parseProviderResponse(providerResponse);
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
  }

  if (!providerResponse.ok) {
    const error = new Error(data?.message || data?.error || `Zpro respondeu com status ${providerResponse.status}`);
    error.status = 502;
    error.providerStatus = providerResponse.status;
    error.providerResponse = data;
    throw error;
  }

  return {
    ok: true,
    provider: 'zpro-baileys',
    channelId: config.channelId || null,
    apiId: config.apiId,
    phone: normalizedPhone,
    transport,
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
app.use(express.json({ limit: '2mb' }));
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

app.post('/api/whatsapp/send', requireAuth, async (request, response) => {
  try {
    const result = await sendZproTextMessage({
      phone: request.body?.phone,
      message: request.body?.message,
      leadId: request.body?.leadId,
      templateId: request.body?.templateId
    });
    response.json({
      ...result,
      sentBy: request.user?.email || request.user?.sub || null,
      sentAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[zpro:send:error]', error.message, error.providerResponse || '');
    response.status(error.status || 500).json({
      ok: false,
      message: error.message,
      providerStatus: error.providerStatus || null,
      providerResponse: error.providerResponse || null
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
      results.push({ ok: true, phone: result.phone, leadId: recipient.leadId || recipient.id || null });
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

  const event = readZproMessage(request.body);
  console.log('[zpro:webhook]', JSON.stringify({
    event: event.event,
    channelId: event.channelId,
    phone: event.phone,
    fromMe: event.fromMe,
    hasText: Boolean(event.text)
  }));

  response.json({ ok: true, received: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Leads NT backend running on port ${port}`);
});
