import { NextRequest, NextResponse } from 'next/server';
import { run, get } from '@/lib/db';
import { generateMfaSecret } from '@/lib/auth/mfa';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { writeAuditLog } from '@/lib/services/audit';

async function handler(request: NextRequest, auth: AuthenticatedRequest) {
  const user = get<{ mfa_enabled: number; email: string }>(
    'SELECT mfa_enabled, email FROM users WHERE id = ?',
    auth.userId
  );

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.mfa_enabled) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 409 });
  }

  const { secret, uri } = generateMfaSecret(user.email);

  run('UPDATE users SET mfa_secret = ? WHERE id = ?', secret, auth.userId);

  writeAuditLog({
    userId: auth.userId,
    action: 'user.mfa_enroll',
    resourceType: 'user',
    resourceId: auth.userId,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ secret, uri });
}

export const POST = withAuth(handler);
