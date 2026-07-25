import crypto from 'crypto';

const encoder = new TextEncoder();
const DEMO_USER = {
  id: 'usr_admin_leads_nt',
  name: 'Admin',
  email: 'admin@leadsnt.com.br',
  role: 'ADMIN_GERAL',
  associationId: null,
  associationName: null
};

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(input) {
  const secret = process.env.AUTH_SECRET || 'leads-nt-local-development-secret';
  return crypto.createHmac('sha256', encoder.encode(secret)).update(input).digest('base64url');
}

export function createSessionToken(user = DEMO_USER) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    associationId: user.associationId,
    associationName: user.associationName,
    iat: now,
    exp: now + 60 * 60 * 8
  }));
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);

  try {
    const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;
  } catch {
    return null;
  }

  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}

export function validateDemoCredentials(email, password) {
  const allowedEmails = new Set([DEMO_USER.email, 'jose@novotempo.org.br']);
  return allowedEmails.has(email) && password === 'demo123' ? DEMO_USER : null;
}

export function requireAuth(request, response, next) {
  const user = verifySessionToken(request.cookies?.sevenflow_session);
  if (!user) {
    response.status(401).json({ user: null });
    return;
  }
  request.user = user;
  next();
}

export function sessionCookieOptions() {
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: production ? 'none' : 'lax',
    secure: production,
    maxAge: 60 * 60 * 8 * 1000,
    path: '/'
  };
}
