import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { createRunbook, queryRunbooks } from '@/lib/ops/service';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  return NextResponse.json({
    data: queryRunbooks({
      orgId: sp.get('orgId') ?? undefined,
      category: sp.get('category') ?? undefined,
      status: (sp.get('status') as 'draft' | 'active' | 'archived' | null) ?? undefined,
    }),
  });
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const required = ['orgId', 'slug', 'title', 'category', 'summary'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  const runbook = createRunbook({
    orgId: body.orgId,
    slug: body.slug,
    title: body.title,
    category: body.category,
    summary: body.summary,
    ownerTeam: body.ownerTeam,
    severityScope: body.severityScope,
    repositoryPath: body.repositoryPath,
    tags: body.tags,
    steps: body.steps,
    verification: body.verification,
    createdBy: auth.userId,
  });

  writeAuditLog({
    orgId: runbook.org_id,
    userId: auth.userId,
    action: 'task.create',
    resourceType: 'ops_runbook',
    resourceId: runbook.id,
    details: { slug: runbook.slug, category: runbook.category },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });
  return NextResponse.json(runbook, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
