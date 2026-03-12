import { NextRequest, NextResponse } from 'next/server';
import { getDashboardBundle } from '@/lib/portals/store';
import type { PortalRole } from '@/types/portal';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = (searchParams.get('role') as PortalRole | null) ?? 'executive';
  const workspaceId = searchParams.get('workspaceId') ?? undefined;
  const dashboard = getDashboardBundle(role, workspaceId);

  if (!dashboard) {
    return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
  }

  return NextResponse.json({ data: dashboard, cached: true });
}
