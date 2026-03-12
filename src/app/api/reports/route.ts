import { NextRequest, NextResponse } from 'next/server';
import { generateReport, listScheduledReports } from '@/lib/portals/store';
import type { ReportFormat } from '@/types/portal';

function getContentType(format: ReportFormat) {
  if (format === 'pdf') return 'application/pdf';
  if (format === 'spreadsheet') return 'text/csv; charset=utf-8';
  return 'application/json; charset=utf-8';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const portalId = searchParams.get('portalId');
  const format = (searchParams.get('format') as ReportFormat | null) ?? 'json';

  if (!portalId) {
    return NextResponse.json({ data: listScheduledReports() });
  }

  const report = generateReport(portalId, format);
  if (!report) {
    return NextResponse.json({ error: 'Report target not found' }, { status: 404 });
  }

  if (searchParams.get('download') === '1') {
    return new NextResponse(report.payload, {
      headers: {
        'content-type': getContentType(format),
        'content-disposition': `attachment; filename="${report.exportName}"`,
      },
    });
  }

  return NextResponse.json({ data: report });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const report = generateReport(body.portalId, (body.format as ReportFormat) ?? 'pdf');

  if (!report) {
    return NextResponse.json({ error: 'Report target not found' }, { status: 404 });
  }

  return NextResponse.json({ data: report }, { status: 201 });
}
