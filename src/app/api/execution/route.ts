import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { advanceChangeOrder, createChangeOrder, getExecutionTwin } from '@/lib/execution/service';
import type { ChangeOrderStatus } from '@/lib/execution/types';

async function handleGet(_request: NextRequest, _auth: AuthenticatedRequest) {
  return NextResponse.json(getExecutionTwin());
}

async function handlePost(request: NextRequest, _auth: AuthenticatedRequest) {
  const body = await request.json().catch(() => ({}));

  if (body.action === 'advanceChangeOrder') {
    if (!body.id || !body.status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
    }

    const changeOrder = advanceChangeOrder(body.id, body.status as ChangeOrderStatus, body.comment ?? 'Workflow advanced.');
    if (!changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
    }

    return NextResponse.json({ changeOrder });
  }

  const required = ['title', 'contractor', 'workPackageId', 'status', 'requestedCostUsd', 'approvedCostUsd', 'scheduleImpactDays', 'reason', 'approvers'];
  for (const field of required) {
    if (body[field] === undefined) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  const changeOrder = createChangeOrder(body);
  return NextResponse.json({ changeOrder }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
