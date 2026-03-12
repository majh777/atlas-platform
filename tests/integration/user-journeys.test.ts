/**
 * Integration Tests: Complete User Journeys
 * 
 * Tests the full user lifecycle from registration through dashboard usage.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, initDb, run, get } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { generateTokens, verifyAccessToken } from '@/lib/auth/jwt';
import { createSession, getSession, hashToken, getUserSessions, revokeSession } from '@/lib/auth/session';
import { generateMfaSecret, generateRecoveryCodes, verifyRecoveryCode } from '@/lib/auth/mfa';
import { writeAuditLog, queryAuditLogs } from '@/lib/services/audit';
import { createNotification, getUserNotifications, markNotificationRead } from '@/lib/services/notifications';
import { createTask, updateTask, queryTasks, getTask } from '@/lib/services/tasks';
import { randomUUID } from 'node:crypto';

beforeAll(() => {
  initDb();
});

afterAll(() => {
  closeDb();
});

describe('User Journey: Registration → Login → Dashboard', () => {
  const testUser = {
    id: randomUUID(),
    email: `integration-test-${Date.now()}@atlas.dev`,
    password: 'SecurePass123!',
    displayName: 'Integration Test User'
  };
  let accessToken: string;
  let refreshToken: string;
  let sessionId: string;

  it('step 1: registers a new user with password hashing', async () => {
    const passwordHash = await hashPassword(testUser.password);
    
    run(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      testUser.id, testUser.email, passwordHash, testUser.displayName
    );

    const user = get<{ id: string; email: string; display_name: string }>(
      'SELECT id, email, display_name FROM users WHERE id = ?',
      testUser.id
    );

    expect(user).toBeDefined();
    expect(user?.email).toBe(testUser.email);
    expect(user?.display_name).toBe(testUser.displayName);
  });

  it('step 2: creates a welcome notification on registration', () => {
    const notification = createNotification({
      userId: testUser.id,
      type: 'system',
      title: 'Welcome to Atlas',
      body: 'Your account has been created successfully.',
      link: '/dashboard'
    });

    expect(notification.id).toBeTruthy();
    expect(notification.title).toBe('Welcome to Atlas');

    const notifications = getUserNotifications(testUser.id);
    expect(notifications.data.length).toBeGreaterThanOrEqual(1);
  });

  it('step 3: logs an audit entry for registration', () => {
    const auditEntry = writeAuditLog({
      userId: testUser.id,
      action: 'user.register',
      resourceType: 'user',
      resourceId: testUser.id,
      ip: '127.0.0.1'
    });

    expect(auditEntry.id).toBeTruthy();
    expect(auditEntry.action).toBe('user.register');

    const logs = queryAuditLogs({ userId: testUser.id, action: 'user.register' });
    expect(logs.total).toBeGreaterThanOrEqual(1);
  });

  it('step 4: verifies password on login', async () => {
    const user = get<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = ?',
      testUser.id
    );

    const isValid = await verifyPassword(testUser.password, user!.password_hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('wrong-password', user!.password_hash);
    expect(isInvalid).toBe(false);
  });

  it('step 5: generates JWT tokens on successful login', async () => {
    const tokens = await generateTokens({
      userId: testUser.id,
      email: testUser.email,
      sessionId: randomUUID()
    });

    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    expect(tokens.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('step 6: creates a session with token hashing', () => {
    const session = createSession(
      testUser.id,
      accessToken,
      refreshToken,
      '192.168.1.100',
      'Mozilla/5.0 Test Browser'
    );

    sessionId = session.id;

    expect(session.id).toBeTruthy();
    expect(session.user_id).toBe(testUser.id);
    expect(session.ip_address).toBe('192.168.1.100');
  });

  it('step 7: verifies access token is valid', async () => {
    const payload = await verifyAccessToken(accessToken);
    
    expect(payload.userId).toBe(testUser.id);
    expect(payload.email).toBe(testUser.email);
  });

  it('step 8: lists active sessions for user', () => {
    const sessions = getUserSessions(testUser.id);
    
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.some(s => s.id === sessionId)).toBe(true);
  });

  it('step 9: logs an audit entry for login', () => {
    const auditEntry = writeAuditLog({
      userId: testUser.id,
      action: 'user.login',
      ip: '192.168.1.100'
    });

    expect(auditEntry.action).toBe('user.login');
  });

  it('step 10: can revoke a session (logout)', () => {
    revokeSession(sessionId, testUser.id);

    // Session should no longer be valid
    const tokenHash = hashToken(accessToken);
    const session = getSession(tokenHash);
    expect(session).toBeNull();
  });
});

describe('User Journey: MFA Enrollment and Verification', () => {
  const mfaUser = {
    id: randomUUID(),
    email: `mfa-test-${Date.now()}@atlas.dev`,
    password: 'MfaPass123!'
  };
  let mfaSecret: string;
  let recoveryCodes: string[];

  beforeAll(async () => {
    const passwordHash = await hashPassword(mfaUser.password);
    run(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      mfaUser.id, mfaUser.email, passwordHash, 'MFA Test User'
    );
  });

  it('step 1: generates MFA secret and URI', () => {
    const result = generateMfaSecret(mfaUser.email);
    mfaSecret = result.secret;

    expect(result.secret).toBeTruthy();
    expect(result.secret.length).toBeGreaterThanOrEqual(16);
    expect(result.uri).toContain('otpauth://totp/');
    expect(result.uri).toContain('Atlas');
    expect(result.uri).toContain(encodeURIComponent(mfaUser.email));
  });

  it('step 2: generates 10 recovery codes', () => {
    recoveryCodes = generateRecoveryCodes();

    expect(recoveryCodes).toHaveLength(10);
    recoveryCodes.forEach(code => {
      expect(code).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  it('step 3: stores MFA secret in database', () => {
    run(
      `UPDATE users SET mfa_secret = ?, mfa_recovery_codes = ?, mfa_enabled = 1 WHERE id = ?`,
      mfaSecret,
      JSON.stringify(recoveryCodes),
      mfaUser.id
    );

    const user = get<{ mfa_enabled: number; mfa_secret: string }>(
      'SELECT mfa_enabled, mfa_secret FROM users WHERE id = ?',
      mfaUser.id
    );

    expect(user?.mfa_enabled).toBe(1);
    expect(user?.mfa_secret).toBe(mfaSecret);
  });

  it('step 4: verifies and consumes a recovery code', () => {
    const codeToUse = recoveryCodes[5];
    const result = verifyRecoveryCode(recoveryCodes, codeToUse);

    expect(result.valid).toBe(true);
    expect(result.remaining).toHaveLength(9);
    expect(result.remaining).not.toContain(codeToUse);
  });

  it('step 5: rejects invalid recovery codes', () => {
    const result = verifyRecoveryCode(recoveryCodes, 'badcode1');

    expect(result.valid).toBe(false);
    expect(result.remaining).toHaveLength(10);
  });

  it('step 6: creates audit log for MFA enrollment', () => {
    const entry = writeAuditLog({
      userId: mfaUser.id,
      action: 'user.mfa_enabled',
      resourceType: 'user',
      resourceId: mfaUser.id,
      ip: '127.0.0.1'
    });

    expect(entry.action).toBe('user.mfa_enabled');
  });
});

describe('User Journey: Notification Management', () => {
  const notifUser = {
    id: randomUUID(),
    email: `notif-test-${Date.now()}@atlas.dev`
  };

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');
    run(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      notifUser.id, notifUser.email, passwordHash, 'Notification Test User'
    );
  });

  it('step 1: creates multiple notifications', () => {
    const notif1 = createNotification({
      userId: notifUser.id,
      type: 'task',
      title: 'Task assigned',
      body: 'You have been assigned a new task'
    });

    const notif2 = createNotification({
      userId: notifUser.id,
      type: 'alert',
      title: 'Permit expiring',
      body: 'Environmental permit expires in 30 days',
      link: '/permits/123'
    });

    const notif3 = createNotification({
      userId: notifUser.id,
      type: 'system',
      title: 'System update',
      body: 'New features have been deployed'
    });

    expect(notif1.id).toBeTruthy();
    expect(notif2.id).toBeTruthy();
    expect(notif3.id).toBeTruthy();
  });

  it('step 2: lists unread notifications', () => {
    const result = getUserNotifications(notifUser.id, { unreadOnly: true });

    expect(result.data.length).toBeGreaterThanOrEqual(3);
    result.data.forEach(n => {
      expect(n.read_at).toBeNull();
    });
  });

  it('step 3: marks a notification as read', () => {
    const notifications = getUserNotifications(notifUser.id);
    const firstNotif = notifications.data[0];

    const marked = markNotificationRead(firstNotif.id, notifUser.id);
    expect(marked).toBe(true);

    const unread = getUserNotifications(notifUser.id, { unreadOnly: true });
    expect(unread.data.some(n => n.id === firstNotif.id)).toBe(false);
  });

  it('step 4: filters notifications by type', () => {
    const notifications = getUserNotifications(notifUser.id);
    const alertNotifs = notifications.data.filter(n => n.type === 'alert');
    
    expect(alertNotifs.length).toBeGreaterThanOrEqual(1);
    expect(alertNotifs[0].title).toContain('Permit');
  });
});

describe('User Journey: Task Management', () => {
  const taskUser = {
    id: randomUUID(),
    email: `task-test-${Date.now()}@atlas.dev`
  };
  const orgId = randomUUID();
  let taskId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');
    run(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      taskUser.id, taskUser.email, passwordHash, 'Task Test User'
    );
  });

  it('step 1: creates a task with full metadata', () => {
    const task = createTask({
      orgId,
      title: 'Review financial model',
      description: 'Validate assumptions in the base case model',
      priority: 'high',
      createdBy: taskUser.id,
      assignedTo: taskUser.id,
      dueDate: '2026-04-15'
    });

    taskId = task.id;

    expect(task.id).toBeTruthy();
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('high');
    expect(task.title).toBe('Review financial model');
  });

  it('step 2: updates task status to in_progress', () => {
    const updated = updateTask(taskId, { status: 'in_progress' });

    expect(updated?.status).toBe('in_progress');
    expect(updated?.completed_at).toBeNull();
  });

  it('step 3: updates task status to completed', () => {
    const updated = updateTask(taskId, { status: 'completed' });

    expect(updated?.status).toBe('completed');
    expect(updated?.completed_at).toBeTruthy();
  });

  it('step 4: queries tasks by organization', () => {
    // Create additional tasks
    createTask({ orgId, title: 'Task 2', priority: 'low', createdBy: taskUser.id });
    createTask({ orgId, title: 'Task 3', priority: 'urgent', createdBy: taskUser.id });

    const result = queryTasks({ orgId });

    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.data.every(t => t.org_id === orgId)).toBe(true);
  });

  it('step 5: queries tasks by status', () => {
    const completedTasks = queryTasks({ orgId, status: 'completed' });
    const pendingTasks = queryTasks({ orgId, status: 'pending' });

    expect(completedTasks.data.every(t => t.status === 'completed')).toBe(true);
    expect(pendingTasks.data.every(t => t.status === 'pending')).toBe(true);
  });

  it('step 6: queries tasks by assignee', () => {
    const myTasks = queryTasks({ assignedTo: taskUser.id });

    expect(myTasks.data.every(t => t.assigned_to === taskUser.id)).toBe(true);
  });

  it('step 7: retrieves a single task by ID', () => {
    const task = getTask(taskId);

    expect(task?.id).toBe(taskId);
    expect(task?.title).toBe('Review financial model');
    expect(task?.status).toBe('completed');
  });
});

describe('User Journey: Session Management', () => {
  const sessionUser = {
    id: randomUUID(),
    email: `session-test-${Date.now()}@atlas.dev`
  };
  const sessionIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');
    run(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      sessionUser.id, sessionUser.email, passwordHash, 'Session Test User'
    );
  });

  it('step 1: creates multiple sessions from different devices', async () => {
    const devices = [
      { ip: '192.168.1.1', ua: 'Chrome on Windows' },
      { ip: '10.0.0.1', ua: 'Safari on macOS' },
      { ip: '172.16.0.1', ua: 'Mobile App on iOS' }
    ];

    for (const device of devices) {
      const tokens = await generateTokens({
        userId: sessionUser.id,
        email: sessionUser.email,
        sessionId: randomUUID()
      });

      const session = createSession(
        sessionUser.id,
        tokens.accessToken,
        tokens.refreshToken,
        device.ip,
        device.ua
      );

      sessionIds.push(session.id);
    }

    expect(sessionIds.length).toBe(3);
  });

  it('step 2: lists all active sessions', () => {
    const sessions = getUserSessions(sessionUser.id);

    expect(sessions.length).toBe(3);
    expect(sessions.some(s => s.ip_address === '192.168.1.1')).toBe(true);
    expect(sessions.some(s => s.user_agent?.includes('Safari'))).toBe(true);
  });

  it('step 3: revokes a specific session', () => {
    revokeSession(sessionIds[0], sessionUser.id);

    const sessions = getUserSessions(sessionUser.id);
    expect(sessions.length).toBe(2);
    expect(sessions.some(s => s.id === sessionIds[0])).toBe(false);
  });

  it('step 4: prevents revoking another user session', () => {
    // Revoke with wrong user - should not affect the session
    revokeSession(sessionIds[1], 'different-user-id');

    const sessions = getUserSessions(sessionUser.id);
    // Session should still exist since wrong user tried to revoke
    expect(sessions.some(s => s.id === sessionIds[1])).toBe(true);
  });

  it('step 5: logs session revocation audit', () => {
    const entry = writeAuditLog({
      userId: sessionUser.id,
      action: 'session.revoke',
      resourceType: 'session',
      resourceId: sessionIds[0],
      ip: '127.0.0.1'
    });

    expect(entry.action).toBe('session.revoke');
  });
});
