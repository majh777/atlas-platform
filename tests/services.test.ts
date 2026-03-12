import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDb, run, closeDb } from '@/lib/db';
import { writeAuditLog, queryAuditLogs } from '@/lib/services/audit';
import { createNotification, getUserNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/services/notifications';
import { createTask, updateTask, queryTasks, getTask } from '@/lib/services/tasks';
import { emitEvent, onEvent, clearListeners } from '@/lib/services/events';

beforeAll(() => {
  initDb();
  // Insert test users to satisfy FK constraints
  for (const uid of ['user1', 'user2', 'user3', 'user5']) {
    run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      uid, `${uid}@test.dev`, 'hash', uid
    );
  }
});

afterAll(() => {
  closeDb();
});

describe('Event system', () => {
  beforeEach(() => clearListeners());

  it('emits and receives events', () => {
    const received: unknown[] = [];
    onEvent('test.event', (data) => received.push(data));
    emitEvent('test.event', { foo: 'bar' });
    expect(received).toEqual([{ foo: 'bar' }]);
  });

  it('supports unsubscribe', () => {
    const received: unknown[] = [];
    const unsub = onEvent('test.event', (data) => received.push(data));
    emitEvent('test.event', 1);
    unsub();
    emitEvent('test.event', 2);
    expect(received).toEqual([1]);
  });

  it('handles errors in handlers gracefully', () => {
    onEvent('err.event', () => { throw new Error('boom'); });
    expect(() => emitEvent('err.event', null)).not.toThrow();
  });
});

describe('Audit service', () => {
  it('writes and queries audit logs', () => {
    const entry = writeAuditLog({
      orgId: 'org1',
      userId: 'user1',
      action: 'org.create',
      resourceType: 'organization',
      resourceId: 'org1',
      details: { name: 'Test Org' },
      ip: '10.0.0.1',
    });

    expect(entry.id).toBeTruthy();
    expect(entry.action).toBe('org.create');

    const result = queryAuditLogs({ orgId: 'org1' });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.data.some((e) => e.id === entry.id)).toBe(true);
  });

  it('filters by action', () => {
    writeAuditLog({ userId: 'user1', action: 'user.login', ip: '10.0.0.2' });
    const result = queryAuditLogs({ action: 'user.login' });
    expect(result.data.every((e) => e.action === 'user.login')).toBe(true);
  });
});

describe('Notifications service', () => {
  it('creates and lists notifications', () => {
    const notif = createNotification({
      userId: 'user1',
      type: 'system',
      title: 'Hello',
      body: 'Test notification',
    });

    expect(notif.id).toBeTruthy();
    expect(notif.read_at).toBeNull();

    const result = getUserNotifications('user1');
    expect(result.data.some((n) => n.id === notif.id)).toBe(true);
  });

  it('marks a notification as read', () => {
    const notif = createNotification({ userId: 'user2', title: 'Test' });
    const ok = markNotificationRead(notif.id, 'user2');
    expect(ok).toBe(true);

    const result = getUserNotifications('user2', { unreadOnly: true });
    expect(result.data.some((n) => n.id === notif.id)).toBe(false);
  });

  it('marks all notifications as read', () => {
    createNotification({ userId: 'user3', title: 'A' });
    createNotification({ userId: 'user3', title: 'B' });
    const count = markAllNotificationsRead('user3');
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

describe('Tasks service', () => {
  it('creates and retrieves a task', () => {
    const task = createTask({
      orgId: 'org1',
      title: 'Test task',
      description: 'A test task',
      priority: 'high',
      createdBy: 'user1',
      assignedTo: 'user1',
    });

    expect(task.id).toBeTruthy();
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('high');

    const fetched = getTask(task.id);
    expect(fetched?.title).toBe('Test task');
  });

  it('updates a task status', () => {
    const task = createTask({ title: 'To complete', createdBy: 'user1' });
    const updated = updateTask(task.id, { status: 'completed' });
    expect(updated?.status).toBe('completed');
    expect(updated?.completed_at).toBeTruthy();
  });

  it('queries tasks with filters', () => {
    createTask({ orgId: 'org2', title: 'Org2 task', priority: 'urgent', assignedTo: 'user5' });
    const result = queryTasks({ orgId: 'org2' });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.data.every((t) => t.org_id === 'org2')).toBe(true);
  });

  it('returns null for non-existent task update', () => {
    const result = updateTask('nonexistent', { status: 'completed' });
    expect(result).toBeNull();
  });
});
