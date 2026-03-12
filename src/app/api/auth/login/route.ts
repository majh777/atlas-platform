import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { initDb, get } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { generateTokens } from '@/lib/auth/jwt';
import { createSession } from '@/lib/auth/session';
import { verifyMfaToken, verifyRecoveryCode } from '@/lib/auth/mfa';
import { run } from '@/lib/db';
import { writeAuditLog } from '@/lib/services/audit';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  mfa_enabled: number;
  mfa_secret: string | null;
  mfa_recovery_codes: string | null;
  status: string;
}

export async function POST(request: NextRequest) {
  initDb();

  const body = await request.json();
  const { email, password, mfaToken, recoveryCode } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }

  const user = get<UserRow>('SELECT * FROM users WHERE email = ? AND status = ?', email, 'active');
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (user.mfa_enabled && user.mfa_secret) {
    if (recoveryCode) {
      const codes: string[] = user.mfa_recovery_codes ? JSON.parse(user.mfa_recovery_codes) : [];
      const result = verifyRecoveryCode(codes, recoveryCode);
      if (!result.valid) {
        return NextResponse.json({ error: 'Invalid recovery code' }, { status: 401 });
      }
      run('UPDATE users SET mfa_recovery_codes = ? WHERE id = ?', JSON.stringify(result.remaining), user.id);
    } else if (mfaToken) {
      if (!verifyMfaToken(user.mfa_secret, mfaToken)) {
        return NextResponse.json({ error: 'Invalid MFA token' }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: 'MFA token required', mfaRequired: true }, { status: 403 });
    }
  }

  const sessionId = randomUUID();
  const tokens = await generateTokens({ userId: user.id, email: user.email, sessionId });
  const session = createSession(
    user.id,
    tokens.accessToken,
    tokens.refreshToken,
    request.headers.get('x-forwarded-for') ?? undefined,
    request.headers.get('user-agent') ?? undefined
  );

  writeAuditLog({
    userId: user.id,
    action: 'user.login',
    resourceType: 'user',
    resourceId: user.id,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.display_name },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    sessionId: session.id,
  });
}
