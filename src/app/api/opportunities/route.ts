import { NextRequest, NextResponse } from 'next/server';
import { opportunityStore } from '@/lib/opportunity-store';
import type { OpportunityInput } from '@/types/opportunity';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const opportunities = opportunityStore.list({
    q: searchParams.get('q') ?? undefined,
    country: searchParams.get('country') ?? undefined,
    sector: searchParams.get('sector') ?? undefined,
    sponsorType: (searchParams.get('sponsorType') as OpportunityInput['sponsorType']) ?? undefined,
    stage: (searchParams.get('stage') as OpportunityInput['stage']) ?? undefined,
  });

  return NextResponse.json({ data: opportunities, total: opportunities.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.kind === 'signal') {
    const opportunity = opportunityStore.ingestSignal(body);
    return NextResponse.json({ data: opportunity }, { status: 201 });
  }

  const opportunity = opportunityStore.create(body as OpportunityInput);
  return NextResponse.json({ data: opportunity }, { status: 201 });
}
