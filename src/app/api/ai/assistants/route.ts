import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getPromptRegistry, workflowAssistant } from '@/lib/ai/service';

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const capability = searchParams.get('capability') ?? undefined;
  return NextResponse.json({ prompts: getPromptRegistry(capability as never) });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const orgId = body.orgId ?? auth.orgId;
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    const response = await workflowAssistant({
      orgId: String(orgId),
      reviewerMode: body.reviewerMode,
      includeEvaluations: Boolean(body.includeEvaluations),
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
