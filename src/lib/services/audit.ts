import { randomUUID } from 'node:crypto';
import { run, all, get } from '@/lib/db';
import { emitEvent } from './events';

export type AuditAction =
  | 'user.register'
  | 'user.login'
  | 'user.logout'
  | 'user.mfa_enroll'
  | 'user.mfa_verify'
  | 'user.password_change'
  | 'session.create'
  | 'session.revoke'
  | 'session.revoke_all'
  | 'session.refresh'
  | 'org.create'
  | 'org.update'
  | 'org.delete'
  | 'org.member_add'
  | 'org.member_remove'
  | 'org.member_role_change'
  | 'workspace.create'
  | 'workspace.update'
  | 'workspace.delete'
  | 'workspace.member_add'
  | 'workspace.member_remove'
  | 'portfolio.create'
  | 'portfolio.update'
  | 'portfolio.delete'
  | 'sso.configure'
  | 'sso.enable'
  | 'sso.disable'
  | 'task.create'
  | 'task.update'
  | 'task.complete'
  | 'approval.submit'
  | 'approval.approve'
  | 'approval.reject'
  | 'export.generate';

export interface AuditEntry {
  id: string;
  org_id: string | null;
  user_id: string | null;
  action: AuditAction;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogParams {
  orgId?: string;
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export function writeAuditLog(params: AuditLogParams): AuditEntry {
  const id = randomUUID();
  const detailsJson = params.details ? JSON.stringify(params.details) : null;

  run(
    `INSERT INTO audit_logs (id, org_id, user_id, action, resource_type, resource_id, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    params.orgId ?? null,
    params.userId ?? null,
    params.action,
    params.resourceType ?? null,
    params.resourceId ?? null,
    detailsJson,
    params.ip ?? null
  );

  const entry: AuditEntry = {
    id,
    org_id: params.orgId ?? null,
    user_id: params.userId ?? null,
    action: params.action,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    details: params.details ?? null,
    ip_address: params.ip ?? null,
    created_at: new Date().toISOString(),
  };

  emitEvent('audit.created', entry);
  return entry;
}

export interface AuditLogFilter {
  orgId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export function queryAuditLogs(filter: AuditLogFilter): { data: AuditEntry[]; total: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.orgId) {
    conditions.push('org_id = ?');
    params.push(filter.orgId);
  }
  if (filter.userId) {
    conditions.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.action) {
    conditions.push('action = ?');
    params.push(filter.action);
  }
  if (filter.resourceType) {
    conditions.push('resource_type = ?');
    params.push(filter.resourceType);
  }
  if (filter.from) {
    conditions.push('created_at >= ?');
    params.push(filter.from);
  }
  if (filter.to) {
    conditions.push('created_at <= ?');
    params.push(filter.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM audit_logs ${where}`, ...params);
  const total = countRow?.cnt ?? 0;

  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  const rows = all<AuditEntry>(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );

  return {
    data: rows.map((r) => ({
      ...r,
      details: r.details ? (typeof r.details === 'string' ? JSON.parse(r.details as unknown as string) : r.details) : null,
    })),
    total,
  };
}
