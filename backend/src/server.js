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

app.listen(port, '0.0.0.0', () => {
  console.log(`Leads NT backend running on port ${port}`);
});
