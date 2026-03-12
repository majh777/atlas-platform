import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import {
  createCaseAction,
  createCommunityCase,
  createObligation,
  createReportPack,
  createStakeholderMetric,
  getESGDashboard,
} from '@/lib/esg/service';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const dashboard = getESGDashboard({
    orgId: sp.get('orgId') ?? undefined,
    workspaceId: sp.get('workspaceId') ?? undefined,
    portfolioId: sp.get('portfolioId') ?? undefined,
  });
  return NextResponse.json(dashboard);
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const entityType = body.entityType;

  if (!body.orgId || !entityType) {
    return NextResponse.json({ error: 'orgId and entityType are required' }, { status: 400 });
  }

  let payload: unknown;
  let resourceType = entityType;

  switch (entityType) {
    case 'obligation':
      if (!body.title || !body.obligationType) {
        return NextResponse.json({ error: 'title and obligationType are required' }, { status: 400 });
      }
      payload = createObligation({ ...body, createdBy: auth.userId });
      break;
    case 'community_case':
      if (!body.caseType || !body.stakeholderName || !body.summary) {
        return NextResponse.json({ error: 'caseType, stakeholderName, and summary are required' }, { status: 400 });
      }
      payload = createCommunityCase({ ...body, createdBy: auth.userId });
      break;
    case 'action':
      if (!body.targetType || !body.targetId || !body.title) {
        return NextResponse.json({ error: 'targetType, targetId, and title are required' }, { status: 400 });
      }
      payload = createCaseAction({ ...body, createdBy: auth.userId });
      resourceType = 'case_action';
      break;
    case 'report_pack':
      if (!body.packType || !body.title) {
        return NextResponse.json({ error: 'packType and title are required' }, { status: 400 });
      }
      payload = createReportPack({ ...body, generatedBy: auth.userId });
      break;
    case 'metric':
      if (!body.metricType || !body.metricKey || typeof body.metricValue !== 'number') {
        return NextResponse.json({ error: 'metricType, metricKey, and numeric metricValue are required' }, { status: 400 });
      }
      payload = createStakeholderMetric({ ...body, recordedBy: auth.userId });
      resourceType = 'stakeholder_metric';
      break;
    default:
      return NextResponse.json({ error: 'Unsupported entityType' }, { status: 400 });
  }

  const resourceId = typeof payload === 'object' && payload && 'id' in payload
    ? String((payload as { id: string }).id)
    : typeof payload === 'object' && payload && 'pack' in payload
      ? String((payload as { pack: { id: string } }).pack.id)
      : undefined;

  writeAuditLog({
    orgId: body.orgId,
    userId: auth.userId,
    action: 'task.create',
    resourceType,
    resourceId,
    details: { entityType },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(payload, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
