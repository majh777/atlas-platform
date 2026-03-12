import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getUserNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/services/notifications';

async function handleGet(request: NextRequest, auth: AuthenticatedRequest) {
  const sp = new URL(request.url).searchParams;
  const unreadOnly = sp.get('unreadOnly') === 'true';
  const limit = sp.has('limit') ? Number(sp.get('limit')) : undefined;
  const offset = sp.has('offset') ? Number(sp.get('offset')) : undefined;

  const result = getUserNotifications(auth.userId, { unreadOnly, limit, offset });
  return NextResponse.json(result);
}

async function handlePatch(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();

  if (body.markAllRead) {
    const count = markAllNotificationsRead(auth.userId);
    return NextResponse.json({ success: true, count });
  }

  if (body.notificationId) {
    const ok = markNotificationRead(body.notificationId, auth.userId);
    return NextResponse.json({ success: ok });
  }

  return NextResponse.json({ error: 'Provide markAllRead or notificationId' }, { status: 400 });
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
