import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { opportunityStore } from '@/lib/opportunity-store';
import type { OpportunityInput } from '@/types/opportunity';

async function handleGet(_request: NextRequest, _auth: AuthenticatedRequest, params?: Record<string, string>) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const opportunity = opportunityStore.get(id);
  if (!opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  }

  return NextResponse.json({ data: opportunity });
}

async function handlePut(request: NextRequest, _auth: AuthenticatedRequest, params?: Record<string, string>) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const body = (await request.json()) as Partial<OpportunityInput>;
  const opportunity = opportunityStore.update(id, body);

  if (!opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  }

  return NextResponse.json({ data: opportunity });
}

async function handleDelete(_request: NextRequest, _auth: AuthenticatedRequest, params?: Record<string, string>) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const deleted = opportunityStore.remove(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
