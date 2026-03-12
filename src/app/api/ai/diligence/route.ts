import { NextResponse } from 'next/server';
import { runDiligenceCopilot } from '@/lib/ai/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const response = await runDiligenceCopilot({
      query: String(body.query),
      orgId: body.orgId ? String(body.orgId) : undefined,
      reviewerMode: body.reviewerMode,
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
