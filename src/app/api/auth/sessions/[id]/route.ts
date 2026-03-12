import { NextRequest, NextResponse } from 'next/server';
import { revokeSession } from '@/lib/auth/session';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { writeAuditLog } from '@/lib/services/audit';

async function handleDelete(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const sessionId = params?.id;
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  revokeSession(sessionId, auth.userId);

  writeAuditLog({
    userId: auth.userId,
    action: 'session.revoke',
    resourceType: 'session',
    resourceId: sessionId,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json({ success: true });
}

export const DELETE = withAuth(handleDelete);
