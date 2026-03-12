import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getCaseAction, getCommunityCase, getObligation, getReportPack, getStakeholderMetric, updateCaseAction, updateCommunityCase, updateObligation } from '@/lib/esg/service';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest, params?: Record<string, string>) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const entityType = new URL(request.url).searchParams.get('entityType') ?? 'community_case';
  const entity = entityType === 'obligation'
    ? getObligation(id)
    : entityType === 'action'
      ? getCaseAction(id)
      : entityType === 'report_pack'
        ? getReportPack(id)
        : entityType === 'metric'
          ? getStakeholderMetric(id)
          : getCommunityCase(id);
  if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(entity);
}

async function handlePatch(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const entityType = new URL(request.url).searchParams.get('entityType') ?? 'community_case';
  const body = await request.json();

  const updated = entityType === 'obligation'
    ? updateObligation(id, body)
    : entityType === 'action'
      ? updateCaseAction(id, body)
      : updateCommunityCase(id, body);

  if (!updated) return NextResponse.json({ error: 'Not found or immutable entity' }, { status: 404 });

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
