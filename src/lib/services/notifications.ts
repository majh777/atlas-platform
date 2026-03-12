import { randomUUID } from 'node:crypto';
import { run, get, all } from '@/lib/db';
import { emitEvent } from './events';

export interface Notification {
  id: string;
  user_id: string;
  org_id: string | null;
  type: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationParams {
  userId: string;
  orgId?: string;
  type?: string;
  title: string;
  body?: string;
  link?: string;
}

export function createNotification(params: CreateNotificationParams): Notification {
  const id = randomUUID();

  run(
    `INSERT INTO notifications (id, user_id, org_id, type, title, body, link)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    params.userId,
    params.orgId ?? null,
    params.type ?? null,
    params.title,
    params.body ?? null,
    params.link ?? null
  );

  const notification: Notification = {
    id,
    user_id: params.userId,
    org_id: params.orgId ?? null,
    type: params.type ?? null,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
    read_at: null,
    created_at: new Date().toISOString(),
  };

  emitEvent('notification.created', notification);
  return notification;
}

export function getUserNotifications(
  userId: string,
  opts: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
): { data: Notification[]; total: number } {
  const conditions = ['user_id = ?'];
  const params: unknown[] = [userId];

  if (opts.unreadOnly) {
    conditions.push('read_at IS NULL');
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const countRow = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM notifications ${where}`, ...params);
  const total = countRow?.cnt ?? 0;

  const data = all<Notification>(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    opts.limit ?? 50,
    opts.offset ?? 0
  );

  return { data, total };
}

export function markNotificationRead(notificationId: string, userId: string): boolean {
  const result = run(
    `UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL`,
    notificationId,
    userId
  );
  return result.changes > 0;
}

export function markAllNotificationsRead(userId: string): number {
  const result = run(
    `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`,
    userId
  );
  return result.changes;
}
