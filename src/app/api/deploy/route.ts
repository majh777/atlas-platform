import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { createDeployment, getOpsOverview, queryDeployments, updateDeploymentStatus } from '@/lib/ops/service';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const orgId = sp.get('orgId') ?? undefined;
  const environment = sp.get('environment') as 'dev' | 'staging' | 'production' | 'dr' | null;

  if (sp.get('view') === 'overview') {
    return NextResponse.json(getOpsOverview(orgId));
  }

  return NextResponse.json({ data: queryDeployments({ orgId, environment: environment ?? undefined }) });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();

  if (body.action === 'updateStatus') {
    if (!body.id || !body.status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }
    const deployment = updateDeploymentStatus(body.id, body.status, { notes: body.notes, traceId: body.traceId });
    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }
    writeAuditLog({
      orgId: deployment.org_id,
      userId: auth.userId,
      action: 'task.update',
      resourceType: 'ops_deployment',
      resourceId: deployment.id,
      details: { status: deployment.status, environment: deployment.environment },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    });
    return NextResponse.json(deployment);
  }

  const required = ['orgId', 'environment', 'version'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  const deployment = createDeployment({
    orgId: body.orgId,
    releaseId: body.releaseId,
    environment: body.environment,
    version: body.version,
    strategy: body.strategy,
    rollbackVersion: body.rollbackVersion,
    changeWindow: body.changeWindow,
    approvalTicket: body.approvalTicket,
    observabilityDashboard: body.observabilityDashboard,
    traceId: body.traceId,
    initiatedBy: auth.userId,
    notes: body.notes,
  });

  writeAuditLog({
    orgId: deployment.org_id,
    userId: auth.userId,
    action: 'task.create',
    resourceType: 'ops_deployment',
    resourceId: deployment.id,
    details: { version: deployment.version, environment: deployment.environment },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(deployment, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
