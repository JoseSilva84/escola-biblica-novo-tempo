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
