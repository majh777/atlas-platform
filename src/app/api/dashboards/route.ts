import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getDashboardBundle } from '@/lib/portals/store';
import type { PortalRole } from '@/types/portal';

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const role = (searchParams.get('role') as PortalRole | null) ?? 'executive';
  const workspaceId = searchParams.get('workspaceId') ?? undefined;
  const dashboard = getDashboardBundle(role, workspaceId);

  if (!dashboard) {
    return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
  }

  return NextResponse.json({ data: dashboard, cached: true });
}

export const GET = withAuth(handleGet);
