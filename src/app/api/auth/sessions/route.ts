import { NextRequest, NextResponse } from 'next/server';
import { getUserSessions, revokeAllSessions } from '@/lib/auth/session';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest) {
  const sessions = getUserSessions(auth.userId);

  const safe = sessions.map((s) => ({
    id: s.id,
    ipAddress: s.ip_address,
    userAgent: s.user_agent,
    createdAt: s.created_at,
    expiresAt: s.expires_at,
    current: s.id === auth.sessionId,
  }));

  return NextResponse.json({ data: safe });
}

async function handleDelete(request: NextRequest, auth: AuthenticatedRequest) {
  revokeAllSessions(auth.userId, auth.sessionId);

  writeAuditLog({
    userId: auth.userId,
    action: 'session.revoke_all',
    resourceType: 'session',
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ success: true, message: 'All other sessions revoked' });
}

export const GET = withAuth(handleGet);
export const DELETE = withAuth(handleDelete);
