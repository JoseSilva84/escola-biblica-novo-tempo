import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '../../../../lib/auth';

export async function GET() {
  const store = await cookies();
  const token = store.get('sevenflow_session')?.value;
  const user = verifySessionToken(token);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
