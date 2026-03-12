import { NextResponse } from 'next/server';
import { getPromptRegistry, workflowAssistant } from '@/lib/ai/service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const capability = searchParams.get('capability') ?? undefined;
  return NextResponse.json({ prompts: getPromptRegistry(capability as never) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    const response = await workflowAssistant({
      orgId: String(body.orgId),
      reviewerMode: body.reviewerMode,
      includeEvaluations: Boolean(body.includeEvaluations),
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
