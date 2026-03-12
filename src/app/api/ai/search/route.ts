import { NextResponse } from 'next/server';
import { semanticSearch } from '@/lib/ai/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const response = await semanticSearch({
      query: String(body.query),
      orgId: body.orgId ? String(body.orgId) : undefined,
      limit: body.limit ? Number(body.limit) : undefined,
      reviewerMode: body.reviewerMode,
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
