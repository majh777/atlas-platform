import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { createRelease, queryReleases, updateRelease } from '@/lib/ops/service';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const orgId = sp.get('orgId') ?? undefined;
  const environment = sp.get('environment') as 'dev' | 'staging' | 'production' | 'dr' | null;
  const status = sp.get('status') as 'draft' | 'approved' | 'scheduled' | 'released' | 'rolled_back' | 'cancelled' | null;
  return NextResponse.json({ data: queryReleases({ orgId, environment: environment ?? undefined, status: status ?? undefined }) });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();

  if (body.action === 'update') {
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const release = updateRelease(body.id, body);
    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }
    writeAuditLog({
      orgId: release.org_id,
      userId: auth.userId,
      action: 'approval.approve',
      resourceType: 'ops_release',
      resourceId: release.id,
      details: { status: release.status, environment: release.environment, version: release.version },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    });
    return NextResponse.json(release);
  }

  const required = ['orgId', 'version', 'name', 'environment'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  const release = createRelease({
    orgId: body.orgId,
    version: body.version,
    name: body.name,
    environment: body.environment,
    riskLevel: body.riskLevel,
    releaseNotes: body.releaseNotes,
    changeSummary: body.changeSummary,
    runbookId: body.runbookId,
    rollbackVersion: body.rollbackVersion,
    scheduledFor: body.scheduledFor,
    approvedBy: body.approvedBy,
    deployedAt: body.deployedAt,
    createdBy: auth.userId,
    metadata: body.metadata,
    status: body.status,
  });

  writeAuditLog({
    orgId: release.org_id,
    userId: auth.userId,
    action: 'approval.submit',
    resourceType: 'ops_release',
    resourceId: release.id,
    details: { version: release.version, riskLevel: release.risk_level },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });
  return NextResponse.json(release, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
