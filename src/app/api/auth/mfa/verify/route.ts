import { NextRequest, NextResponse } from 'next/server';
import { run, get } from '@/lib/db';
import { verifyMfaToken, generateRecoveryCodes } from '@/lib/auth/mfa';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { writeAuditLog } from '@/lib/services/audit';
import { createNotification } from '@/lib/services/notifications';

async function handler(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const { token } = body;

  if (!token) {
    return NextResponse.json({ error: 'MFA token is required' }, { status: 400 });
  }

  const user = get<{ mfa_secret: string | null; mfa_enabled: number }>(
    'SELECT mfa_secret, mfa_enabled FROM users WHERE id = ?',
    auth.userId
  );

  if (!user?.mfa_secret) {
    return NextResponse.json({ error: 'MFA not enrolled. Call /api/auth/mfa/enroll first.' }, { status: 400 });
  }

  if (user.mfa_enabled) {
    return NextResponse.json({ error: 'MFA is already verified and enabled' }, { status: 409 });
  }

  const valid = verifyMfaToken(user.mfa_secret, token);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid MFA token' }, { status: 401 });
  }

  const recoveryCodes = generateRecoveryCodes();
  run(
    'UPDATE users SET mfa_enabled = 1, mfa_recovery_codes = ? WHERE id = ?',
    JSON.stringify(recoveryCodes),
    auth.userId
  );

  writeAuditLog({
    userId: auth.userId,
    action: 'user.mfa_verify',
    resourceType: 'user',
    resourceId: auth.userId,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  createNotification({
    userId: auth.userId,
    type: 'security',
    title: 'MFA Enabled',
    body: 'Two-factor authentication has been enabled on your account.',
  });

  return NextResponse.json({ enabled: true, recoveryCodes });
}

export const POST = withAuth(handler);
