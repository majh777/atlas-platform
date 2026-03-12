import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { getTask, updateTask } from '@/lib/services/tasks';
import { writeAuditLog } from '@/lib/services/audit';

async function handleGet(_request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const taskId = params?.id;
  if (!taskId) return NextResponse.json({ error: 'Task ID required' }, { status: 400 });

  const task = getTask(taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(task);
}

async function handlePatch(request: NextRequest, auth: AuthenticatedRequest, params?: Record<string, string>) {
  const taskId = params?.id;
  if (!taskId) return NextResponse.json({ error: 'Task ID required' }, { status: 400 });

  const body = await request.json();
  const updated = updateTask(taskId, body);

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const action = updated.status === 'completed' ? 'task.complete' as const : 'task.update' as const;
  writeAuditLog({
    orgId: updated.org_id ?? undefined,
    userId: auth.userId,
    action,
    resourceType: 'task',
    resourceId: taskId,
    details: body,
    ip: request.headers.get('x-forwarded-for') ?? undefined,
  });

  return NextResponse.json(updated);
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
