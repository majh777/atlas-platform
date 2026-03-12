import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { createTask, queryTasks, type TaskPriority, type TaskStatus } from '@/lib/services/tasks';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(request: NextRequest, auth: AuthenticatedRequest) {
  const sp = new URL(request.url).searchParams;

  const result = queryTasks({
    orgId: sp.get('orgId') ?? undefined,
    workspaceId: sp.get('workspaceId') ?? undefined,
    assignedTo: sp.get('assignedTo') ?? auth.userId,
    status: (sp.get('status') as TaskStatus) ?? undefined,
    priority: (sp.get('priority') as TaskPriority) ?? undefined,
    limit: sp.has('limit') ? Number(sp.get('limit')) : undefined,
    offset: sp.has('offset') ? Number(sp.get('offset')) : undefined,
  });

  return NextResponse.json(result);
}

async function handlePost(request: NextRequest, auth: AuthenticatedRequest) {
  const body = await request.json();
  const { title, description, orgId, workspaceId, assignedTo, priority, dueDate } = body;

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const task = createTask({
    title,
    description,
    orgId,
    workspaceId,
    assignedTo: assignedTo ?? auth.userId,
    createdBy: auth.userId,
    priority,
    dueDate,
  });

  writeAuditLog({
    orgId,
    userId: auth.userId,
    action: 'task.create',
    resourceType: 'task',
    resourceId: task.id,
    details: { title },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(task, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
