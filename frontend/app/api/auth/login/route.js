import { NextResponse } from 'next/server';
import { createSessionToken, validateDemoCredentials } from '../../../../lib/auth';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const user = validateDemoCredentials(body.email, body.password);

  if (!user) {
    return NextResponse.json({ message: 'Credenciais inválidas' }, { status: 401 });
  }

  const response = NextResponse.json(user);
  response.cookies.set('sevenflow_session', createSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
    path: '/'
  });

  return response;
}
