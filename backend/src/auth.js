import crypto from 'crypto';

const encoder = new TextEncoder();
const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_KEY_LENGTH = 64;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(input) {
  const secret = process.env.AUTH_SECRET || 'leads-nt-local-development-secret';
  return crypto.createHmac('sha256', encoder.encode(secret)).update(input).digest('base64url');
}

export function createSessionToken(user) {
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

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    associationId: user.associationId,
    associationName: user.association?.name || null
  };
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

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(password), salt, PASSWORD_KEY_LENGTH).toString('base64url');
  return `${PASSWORD_HASH_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [algorithm, salt, hash] = String(storedHash || '').split('$');
  if (algorithm !== PASSWORD_HASH_PREFIX || !salt || !hash) return false;

  try {
    const expected = Buffer.from(hash, 'base64url');
    const actual = crypto.scryptSync(String(password), salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function validateCredentials(prisma, email, password) {
  const user = await prisma.user.findUnique({
    where: { email: String(email || '').trim().toLowerCase() },
    include: { association: true }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return publicUser(user);
}

export function requireAuth(request, response, next) {
  const bearerToken = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = verifySessionToken(request.cookies?.sevenflow_session) || verifySessionToken(bearerToken);
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
