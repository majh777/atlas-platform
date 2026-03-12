import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { createCaseAction, createIncident, getIncidentDashboard } from '@/lib/esg/service';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const dashboard = getIncidentDashboard({
    orgId: sp.get('orgId') ?? undefined,
    workspaceId: sp.get('workspaceId') ?? undefined,
    portfolioId: sp.get('portfolioId') ?? undefined,
  });
  return NextResponse.json(dashboard);
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const entityType = body.entityType ?? 'incident';

  if (!body.orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  if (entityType === 'action') {
    if (!body.targetId || !body.title) {
      return NextResponse.json({ error: 'targetId and title are required' }, { status: 400 });
    }
    const action = createCaseAction({ ...body, targetType: 'incident', createdBy: auth.userId });
    writeAuditLog({
      orgId: body.orgId,
      userId: auth.userId,
      action: 'task.create',
      resourceType: 'incident_action',
      resourceId: action.id,
      details: { title: action.title },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    });
    return NextResponse.json(action, { status: 201 });
  }

  if (!body.category || !body.severity || !body.title || !body.description) {
    return NextResponse.json({ error: 'category, severity, title, and description are required' }, { status: 400 });
  }

  const incident = createIncident({ ...body, createdBy: auth.userId });
  writeAuditLog({
    orgId: body.orgId,
    userId: auth.userId,
    action: 'task.create',
    resourceType: 'incident',
    resourceId: incident.id,
    details: { title: incident.title, severity: incident.severity },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });
  return NextResponse.json(incident, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
