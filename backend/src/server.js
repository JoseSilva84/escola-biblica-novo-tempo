import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createSessionToken, requireAuth, sessionCookieOptions, validateDemoCredentials, verifySessionToken } from './auth.js';
import { getDashboardData } from './data.js';
import { prisma } from './prisma.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
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

app.post('/api/auth/login', (request, response) => {
  const user = validateDemoCredentials(request.body?.email, request.body?.password);

  if (!user) {
    response.status(401).json({ message: 'Credenciais invalidas' });
    return;
  }

  response.cookie('sevenflow_session', createSessionToken(user), sessionCookieOptions());
  response.json(user);
});

app.post('/api/auth/logout', (_request, response) => {
  response.clearCookie('sevenflow_session', sessionCookieOptions());
  response.json({ ok: true });
});

app.get('/api/auth/me', (request, response) => {
  const user = verifySessionToken(request.cookies?.sevenflow_session);
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
