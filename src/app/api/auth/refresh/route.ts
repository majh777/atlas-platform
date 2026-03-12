import { NextRequest, NextResponse } from 'next/server';
import { initDb, get } from '@/lib/db';
import { verifyRefreshToken, generateTokens } from '@/lib/auth/jwt';
import { hashToken, refreshSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/services/audit';

export async function POST(request: NextRequest) {
  initDb();

  const body = await request.json();
  const { refreshToken } = body;

  if (!refreshToken) {
    return NextResponse.json({ error: 'refreshToken is required' }, { status: 400 });
  }

  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  const user = get<{ email: string }>('SELECT email FROM users WHERE id = ? AND status = ?', payload.userId, 'active');
  if (!user) {
    return NextResponse.json({ error: 'User not found or suspended' }, { status: 401 });
  }

  const newTokens = await generateTokens({
    userId: payload.userId,
    email: user.email,
    sessionId: payload.sessionId,
  });

  const refreshTokenHash = hashToken(refreshToken);
  const updatedSession = refreshSession(
    refreshTokenHash,
    newTokens.accessToken,
    newTokens.refreshToken
  );

  if (!updatedSession) {
    return NextResponse.json({ error: 'Session expired or revoked' }, { status: 401 });
  }

  writeAuditLog({
    userId: payload.userId,
    action: 'session.refresh',
    resourceType: 'session',
    resourceId: updatedSession.id,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({
    accessToken: newTokens.accessToken,
    refreshToken: newTokens.refreshToken,
    expiresAt: newTokens.expiresAt,
  });
}
