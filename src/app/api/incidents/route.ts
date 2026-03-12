import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { createCaseAction, createIncident, getIncidentDashboard } from '@/lib/esg/service';
import { createOpsIncident, getOpsOverview, queryOpsIncidents } from '@/lib/ops/service';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const domain = sp.get('domain') ?? 'esg';

  if (domain === 'enterprise') {
    const orgId = sp.get('orgId') ?? undefined;
    if (sp.get('view') === 'overview') {
      return NextResponse.json(getOpsOverview(orgId));
    }
    return NextResponse.json({
      data: queryOpsIncidents({
        orgId,
        severity: (sp.get('severity') as 'sev1' | 'sev2' | 'sev3' | 'sev4' | null) ?? undefined,
        status: (sp.get('status') as 'open' | 'triaged' | 'mitigating' | 'monitoring' | 'resolved' | 'closed' | null) ?? undefined,
      }),
    });
  }

  const dashboard = getIncidentDashboard({
    orgId: sp.get('orgId') ?? undefined,
    workspaceId: sp.get('workspaceId') ?? undefined,
    portfolioId: sp.get('portfolioId') ?? undefined,
  });
  return NextResponse.json(dashboard);
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const domain = body.domain ?? 'esg';

  if (!body.orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  if (domain === 'enterprise') {
    if (!body.title || !body.severity || !body.source || !body.summary) {
      return NextResponse.json({ error: 'title, severity, source, and summary are required' }, { status: 400 });
    }
    const incident = createOpsIncident({
      orgId: body.orgId,
      deploymentId: body.deploymentId,
      releaseId: body.releaseId,
      title: body.title,
      severity: body.severity,
      source: body.source,
      service: body.service,
      summary: body.summary,
      impact: body.impact,
      runbookId: body.runbookId,
      ownerUserId: body.ownerUserId ?? auth.userId,
      commanderUserId: body.commanderUserId,
      detectedAt: body.detectedAt,
      timeline: body.timeline,
      customerUpdates: body.customerUpdates,
    });
    writeAuditLog({
      orgId: body.orgId,
      userId: auth.userId,
      action: 'task.create',
      resourceType: 'ops_incident',
      resourceId: incident.id,
      details: { title: incident.title, severity: incident.severity, source: incident.source },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    });
    return NextResponse.json(incident, { status: 201 });
  }

  const entityType = body.entityType ?? 'incident';

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
