import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { listPortals, scheduleReport } from '@/lib/portals/store';
import type { PortalRole, ReportFormat } from '@/types/portal';

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const role = (searchParams.get('role') as PortalRole | null) ?? undefined;
  const data = listPortals(role);
  return NextResponse.json({ data, total: data.length });
}

async function handlePost(request: NextRequest, _auth: AuthenticatedRequest) {
  const body = await request.json();
  const scheduled = scheduleReport({
    portalId: body.portalId,
    cadence: body.cadence ?? 'monthly',
    channel: body.channel ?? 'workspace',
    nextRunAt: body.nextRunAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    recipients: body.recipients ?? [],
    format: (body.format as ReportFormat) ?? 'pdf',
  });

  return NextResponse.json({ data: scheduled }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
