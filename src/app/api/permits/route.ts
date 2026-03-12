import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import {
  createObligation,
  createPermit,
  getPermitDashboard,
  type ObligationType,
  type PermitStatus,
  type RiskLevel,
} from '@/lib/esg/service';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const dashboard = getPermitDashboard({
    orgId: sp.get('orgId') ?? undefined,
    workspaceId: sp.get('workspaceId') ?? undefined,
    portfolioId: sp.get('portfolioId') ?? undefined,
  });

  return NextResponse.json(dashboard);
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const entityType = body.entityType ?? 'permit';

  if (entityType === 'obligation') {
    if (!body.title || !body.orgId || !body.obligationType) {
      return NextResponse.json({ error: 'orgId, title, and obligationType are required' }, { status: 400 });
    }

    const obligation = createObligation({
      orgId: body.orgId,
      workspaceId: body.workspaceId,
      portfolioId: body.portfolioId,
      permitId: body.permitId,
      title: body.title,
      obligationType: body.obligationType as ObligationType,
      sourceReference: body.sourceReference,
      commitmentParty: body.commitmentParty,
      status: body.status,
      priority: body.priority,
      dueDate: body.dueDate,
      ownerUserId: body.ownerUserId ?? auth.userId,
      notes: body.notes,
      evidenceLinks: body.evidenceLinks,
      createdBy: auth.userId,
    });

    writeAuditLog({
      orgId: body.orgId,
      userId: auth.userId,
      action: 'task.create',
      resourceType: 'obligation',
      resourceId: obligation.id,
      details: { title: obligation.title, obligationType: obligation.obligation_type },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json(obligation, { status: 201 });
  }

  if (!body.orgId || !body.title || !body.permitNumber || !body.permitType || !body.authority) {
    return NextResponse.json({ error: 'orgId, title, permitNumber, permitType, and authority are required' }, { status: 400 });
  }

  const permit = createPermit({
    orgId: body.orgId,
    workspaceId: body.workspaceId,
    portfolioId: body.portfolioId,
    title: body.title,
    permitNumber: body.permitNumber,
    permitType: body.permitType,
    authority: body.authority,
    jurisdiction: body.jurisdiction,
    issueDate: body.issueDate,
    expiryDate: body.expiryDate,
    reviewDate: body.reviewDate,
    status: body.status as PermitStatus | undefined,
    riskLevel: body.riskLevel as RiskLevel | undefined,
    alertDays: body.alertDays,
    ownerUserId: body.ownerUserId ?? auth.userId,
    notes: body.notes,
    evidenceLinks: body.evidenceLinks,
    metadata: body.metadata,
    createdBy: auth.userId,
  });

  writeAuditLog({
    orgId: body.orgId,
    userId: auth.userId,
    action: 'task.create',
    resourceType: 'permit',
    resourceId: permit.id,
    details: { title: permit.title, permitNumber: permit.permit_number },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(permit, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
