import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, run, closeDb } from '@/lib/db';
import {
  createSession,
  getSession,
  getUserSessions,
  revokeSession,
  revokeAllSessions,
  refreshSession,
  hashToken,
} from '@/lib/auth/session';
import { evaluateAbacPolicies, type EvalContext } from '@/lib/auth/abac';

beforeAll(() => {
  initDb();
  // Insert a test user to satisfy FK constraints
  run(
    `INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
    'test-user-1', 'test@session.dev', 'hash', 'Test User'
  );
});

afterAll(() => {
  closeDb();
});

describe('Session management', () => {
  it('creates a session', () => {
    const session = createSession('test-user-1', 'token-abc', 'refresh-xyz', '10.0.0.1', 'TestAgent');
    expect(session.id).toBeTruthy();
    expect(session.user_id).toBe('test-user-1');
    expect(session.ip_address).toBe('10.0.0.1');
  });

  it('retrieves a session by token hash', () => {
    const session = createSession('test-user-1', 'token-lookup', 'refresh-lookup');
    const found = getSession(hashToken('token-lookup'));
    expect(found).not.toBeNull();
    expect(found?.id).toBe(session.id);
  });

  it('returns null for revoked session', () => {
    const session = createSession('test-user-1', 'token-revoke-test', 'refresh-revoke-test');
    revokeSession(session.id, 'test-user-1');
    const found = getSession(hashToken('token-revoke-test'));
    expect(found).toBeNull();
  });

  it('lists user sessions', () => {
    const sessions = getUserSessions('test-user-1');
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('revokes all sessions except current', () => {
    createSession('test-user-1', 'tok-a1', 'ref-a1');
    const s2 = createSession('test-user-1', 'tok-a2', 'ref-a2');
    revokeAllSessions('test-user-1', s2.id);
    const found1 = getSession(hashToken('tok-a1'));
    const found2 = getSession(hashToken('tok-a2'));
    expect(found1).toBeNull();
    expect(found2).not.toBeNull();
  });

  it('refreshes a session with new tokens', () => {
    const original = createSession('test-user-1', 'tok-ref-old', 'ref-ref-old');
    const updated = refreshSession(
      hashToken('ref-ref-old'),
      'tok-ref-new',
      'ref-ref-new'
    );
    expect(updated).not.toBeNull();
    expect(updated?.id).toBe(original.id);
    const found = getSession(hashToken('tok-ref-new'));
    expect(found).not.toBeNull();
  });
});

describe('ABAC evaluation', () => {
  beforeAll(() => {
    run(
      `INSERT INTO abac_policies (id, org_id, name, resource_type, conditions, actions, effect, priority, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'policy-deny-suspended', 'org-abac-test', 'Deny suspended users', null,
      JSON.stringify({ 'user.status': 'suspended' }),
      JSON.stringify([]),
      'deny', 100, 1
    );
    run(
      `INSERT INTO abac_policies (id, org_id, name, resource_type, conditions, actions, effect, priority, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'policy-allow-member', 'org-abac-test', 'Allow members to read', 'workspace',
      JSON.stringify({ 'user.orgRole': 'member' }),
      JSON.stringify(['read']),
      'allow', 50, 1
    );
  });

  it('denies a suspended user', () => {
    const ctx: EvalContext = {
      user: { id: 'u1', email: 'x@y.com', status: 'suspended' },
      resource: { type: 'workspace' },
      action: 'read',
      environment: {},
    };
    const result = evaluateAbacPolicies('org-abac-test', ctx);
    expect(result.allowed).toBe(false);
    expect(result.matchedPolicy).toBe('policy-deny-suspended');
  });

  it('allows a member to read workspace', () => {
    const ctx: EvalContext = {
      user: { id: 'u2', email: 'y@z.com', orgRole: 'member' },
      resource: { type: 'workspace' },
      action: 'read',
      environment: {},
    };
    const result = evaluateAbacPolicies('org-abac-test', ctx);
    expect(result.allowed).toBe(true);
    expect(result.matchedPolicy).toBe('policy-allow-member');
  });

  it('denies by default when no policy matches', () => {
    const ctx: EvalContext = {
      user: { id: 'u3', email: 'z@w.com', orgRole: 'viewer' },
      resource: { type: 'portfolio' },
      action: 'delete',
      environment: {},
    };
    const result = evaluateAbacPolicies('org-abac-test', ctx);
    expect(result.allowed).toBe(false);
  });
});
