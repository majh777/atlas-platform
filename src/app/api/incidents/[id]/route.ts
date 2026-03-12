import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getCaseAction, getIncident, updateCaseAction, updateIncident } from '@/lib/esg/service';
import { getOpsIncident, updateOpsIncident } from '@/lib/ops/service';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest, params?: Record<string, string>) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const sp = new URL(request.url).searchParams;
  const domain = sp.get('domain') ?? 'esg';

  if (domain === 'enterprise') {
    const entity = getOpsIncident(id);
    if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(entity);
  }

  const entityType = sp.get('entityType') ?? 'incident';
  const entity = entityType === 'action' ? getCaseAction(id) : getIncident(id);
  if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(entity);
}

async function handlePatch(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const sp = new URL(request.url).searchParams;
  const domain = sp.get('domain') ?? 'esg';
  const body = await request.json();

  if (domain === 'enterprise') {
    const updated = updateOpsIncident(id, {
      title: body.title,
      severity: body.severity,
      status: body.status,
      source: body.source,
      service: body.service,
      summary: body.summary,
      impact: body.impact,
      runbookId: body.runbookId,
      ownerUserId: body.ownerUserId,
      commanderUserId: body.commanderUserId,
      detectedAt: body.detectedAt,
      resolvedAt: body.resolvedAt,
      timeline: body.timeline,
      customerUpdates: body.customerUpdates,
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    writeAuditLog({
      orgId: updated.org_id ?? undefined,
      userId: auth.userId,
      action: 'task.update',
      resourceType: 'ops_incident',
      resourceId: id,
      details: body,
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json(updated);
  }

  const entityType = sp.get('entityType') ?? 'incident';
  const updated = entityType === 'action' ? updateCaseAction(id, body) : updateIncident(id, body);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  writeAuditLog({
    orgId: (updated as { org_id?: string | null }).org_id ?? undefined,
    userId: auth.userId,
    action: 'task.update',
    resourceType: entityType,
    resourceId: id,
    details: body,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(updated);
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
