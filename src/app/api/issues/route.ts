import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { createIssue, listIssues, updateIssue } from '@/lib/execution/service';
import type { IssueCategory, IssueStatus } from '@/lib/execution/types';

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') as IssueStatus | null) ?? undefined;
  const category = (searchParams.get('category') as IssueCategory | null) ?? undefined;
  const issues = listIssues(status, category);

  return NextResponse.json({ issues, total: issues.length });
}

async function handlePost(request: NextRequest, _auth: AuthenticatedRequest) {
  const body = await request.json().catch(() => ({}));
  const required = ['title', 'category', 'workPackageId', 'location', 'priority', 'status', 'assignee', 'reportedBy', 'description', 'mobileCaptured'];
  for (const field of required) {
    if (body[field] === undefined) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  const issue = createIssue(body);
  return NextResponse.json({ issue }, { status: 201 });
}

async function handlePatch(request: NextRequest, _auth: AuthenticatedRequest) {
  const body = await request.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const issue = updateIssue(body.id, {
    status: body.status,
    assignee: body.assignee,
    priority: body.priority,
    dueDate: body.dueDate,
  });

  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  return NextResponse.json({ issue });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PATCH = withAuth(handlePatch);
