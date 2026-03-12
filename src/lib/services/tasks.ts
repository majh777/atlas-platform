import { randomUUID } from 'node:crypto';
import { run, get, all } from '@/lib/db';
import { emitEvent } from './events';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  org_id: string | null;
  workspace_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskParams {
  orgId?: string;
  workspaceId?: string;
  assignedTo?: string;
  createdBy?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
}

export function createTask(params: CreateTaskParams): Task {
  const id = randomUUID();
  const now = new Date().toISOString();

  run(
    `INSERT INTO tasks (id, org_id, workspace_id, assigned_to, created_by, title, description, priority, due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    params.orgId ?? null,
    params.workspaceId ?? null,
    params.assignedTo ?? null,
    params.createdBy ?? null,
    params.title,
    params.description ?? null,
    params.priority ?? 'medium',
    params.dueDate ?? null,
    now,
    now
  );

  const task: Task = {
    id,
    org_id: params.orgId ?? null,
    workspace_id: params.workspaceId ?? null,
    assigned_to: params.assignedTo ?? null,
    created_by: params.createdBy ?? null,
    title: params.title,
    description: params.description ?? null,
    status: 'pending',
    priority: params.priority ?? 'medium',
    due_date: params.dueDate ?? null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  emitEvent('task.created', task);
  return task;
}

export function updateTask(
  taskId: string,
  updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'due_date' | 'assigned_to'>>
): Task | null {
  const existing = get<Task>('SELECT * FROM tasks WHERE id = ?', taskId);
  if (!existing) return null;

  const fields: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    const col = key === 'due_date' ? 'due_date' : key === 'assigned_to' ? 'assigned_to' : key;
    fields.push(`${col} = ?`);
    params.push(value ?? null);
  }

  if (updates.status === 'completed' && existing.status !== 'completed') {
    fields.push('completed_at = datetime(\'now\')');
  }

  fields.push('updated_at = datetime(\'now\')');
  params.push(taskId);

  run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, ...params);

  const updated = get<Task>('SELECT * FROM tasks WHERE id = ?', taskId)!;
  emitEvent('task.updated', updated);
  return updated;
}

export interface TaskFilter {
  orgId?: string;
  workspaceId?: string;
  assignedTo?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  limit?: number;
  offset?: number;
}

export function queryTasks(filter: TaskFilter): { data: Task[]; total: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.orgId) { conditions.push('org_id = ?'); params.push(filter.orgId); }
  if (filter.workspaceId) { conditions.push('workspace_id = ?'); params.push(filter.workspaceId); }
  if (filter.assignedTo) { conditions.push('assigned_to = ?'); params.push(filter.assignedTo); }
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
  if (filter.priority) { conditions.push('priority = ?'); params.push(filter.priority); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM tasks ${where}`, ...params);
  const total = countRow?.cnt ?? 0;

  const data = all<Task>(
    `SELECT * FROM tasks ${where} ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    filter.limit ?? 50,
    filter.offset ?? 0
  );

  return { data, total };
}

export function getTask(taskId: string): Task | null {
  return get<Task>('SELECT * FROM tasks WHERE id = ?', taskId) ?? null;
}
