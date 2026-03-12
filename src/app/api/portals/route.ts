import { NextRequest, NextResponse } from 'next/server';
import { listPortals, scheduleReport } from '@/lib/portals/store';
import type { PortalRole, ReportFormat } from '@/types/portal';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = (searchParams.get('role') as PortalRole | null) ?? undefined;
  const data = listPortals(role);
  return NextResponse.json({ data, total: data.length });
}

export async function POST(request: NextRequest) {
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
