import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { initDb, run, get } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { generateTokens } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/services/audit';
import { createNotification } from '@/lib/services/notifications';

export async function POST(request: NextRequest) {
  initDb();

  const body = await request.json();
  const { email, password, displayName } = body;

  if (!email || !password || !displayName) {
    return NextResponse.json({ error: 'email, password, and displayName are required' }, { status: 400 });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const existing = get<{ id: string }>('SELECT id FROM users WHERE email = ?', email);
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);

  run(
    `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
    userId, email, passwordHash, displayName
  );

  const tokens = await generateTokens({ userId, email, sessionId: randomUUID() });
  const session = createSession(
    userId,
    tokens.accessToken,
    tokens.refreshToken,
    request.headers.get('x-forwarded-for') ?? undefined,
    request.headers.get('user-agent') ?? undefined
  );

  writeAuditLog({
    userId,
    action: 'user.register',
    resourceType: 'user',
    resourceId: userId,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  createNotification({
    userId,
    type: 'system',
    title: 'Welcome to Atlas',
    body: 'Your account has been created. Set up MFA in your security settings.',
    link: '/admin/security',
  });

  return NextResponse.json({
    user: { id: userId, email, displayName },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    sessionId: session.id,
  }, { status: 201 });
}
