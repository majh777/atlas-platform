import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { hashToken, getSession, revokeSession } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/services/audit';

export async function POST(request: NextRequest) {
  initDb();

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const tokenHash = hashToken(token);
  const session = getSession(tokenHash);
  if (session) {
    revokeSession(session.id, payload.userId);

    writeAuditLog({
      userId: payload.userId,
      action: 'user.logout',
      resourceType: 'session',
      resourceId: session.id,
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    });
  }

  return NextResponse.json({ success: true });
}
