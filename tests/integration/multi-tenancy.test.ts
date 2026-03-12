/**
 * Integration Tests: Multi-Tenancy and Organization Hierarchy
 * 
 * Tests the Organization → Workspace → Portfolio hierarchy
 * and RBAC/ABAC permission enforcement.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, initDb, run, get, all } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { getUserOrgRole, hasPermission, hasWorkspacePermission } from '@/lib/auth/rbac';
import { evaluateAbacPolicies } from '@/lib/auth/abac';
import { writeAuditLog, queryAuditLogs } from '@/lib/services/audit';
import { randomUUID } from 'node:crypto';

beforeAll(() => {
  initDb();
});

afterAll(() => {
  closeDb();
});

describe('Organization Management Journey', () => {
  const users = {
    owner: { id: randomUUID(), email: `owner-${Date.now()}@atlas.dev` },
    admin: { id: randomUUID(), email: `admin-${Date.now()}@atlas.dev` },
    member: { id: randomUUID(), email: `member-${Date.now()}@atlas.dev` },
    viewer: { id: randomUUID(), email: `viewer-${Date.now()}@atlas.dev` }
  };
  let orgId: string;

  beforeAll(async () => {
    const hash = await hashPassword('Password123!');
    for (const [role, user] of Object.entries(users)) {
      run(
        `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
        user.id, user.email, hash, `${role} User`
      );
    }
  });

  it('step 1: creates an organization with owner', () => {
    orgId = randomUUID();
    const slug = `test-org-${Date.now()}`;

    run(
      `INSERT INTO organizations (id, name, slug, plan, owner_id) VALUES (?, ?, ?, ?, ?)`,
      orgId, 'Test Organization', slug, 'professional', users.owner.id
    );

    // Add owner as org member
    run(
      `INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`,
      randomUUID(), orgId, users.owner.id
    );

    const org = get<{ id: string; name: string; plan: string }>(
      'SELECT id, name, plan FROM organizations WHERE id = ?',
      orgId
    );

    expect(org?.name).toBe('Test Organization');
    expect(org?.plan).toBe('professional');
  });

  it('step 2: adds members with different roles', () => {
    const roles = [
      { userId: users.admin.id, role: 'admin' },
      { userId: users.member.id, role: 'member' },
      { userId: users.viewer.id, role: 'viewer' }
    ];

    for (const { userId, role } of roles) {
      run(
        `INSERT INTO org_members (id, org_id, user_id, role, invited_by) VALUES (?, ?, ?, ?, ?)`,
        randomUUID(), orgId, userId, role, users.owner.id
      );
    }

    const members = all<{ user_id: string; role: string }>(
      'SELECT user_id, role FROM org_members WHERE org_id = ?',
      orgId
    );

    expect(members.length).toBe(4);
    expect(members.some(m => m.role === 'owner')).toBe(true);
    expect(members.some(m => m.role === 'admin')).toBe(true);
  });

  it('step 3: retrieves user org role correctly', () => {
    expect(getUserOrgRole(users.owner.id, orgId)).toBe('owner');
    expect(getUserOrgRole(users.admin.id, orgId)).toBe('admin');
    expect(getUserOrgRole(users.member.id, orgId)).toBe('member');
    expect(getUserOrgRole(users.viewer.id, orgId)).toBe('viewer');
    expect(getUserOrgRole('non-existent-user', orgId)).toBeNull();
  });

  it('step 4: enforces RBAC permissions correctly', () => {
    // Owner has all permissions
    expect(hasPermission('owner', 'org:delete')).toBe(true);
    expect(hasPermission('owner', 'org:manage_members')).toBe(true);
    expect(hasPermission('owner', 'ws:create')).toBe(true);
    expect(hasPermission('owner', 'audit:export')).toBe(true);

    // Admin can manage but not delete org
    expect(hasPermission('admin', 'org:update')).toBe(true);
    expect(hasPermission('admin', 'org:delete')).toBe(false);
    expect(hasPermission('admin', 'org:manage_members')).toBe(true);

    // Member has limited workspace permissions
    expect(hasPermission('member', 'ws:create')).toBe(true);
    expect(hasPermission('member', 'ws:update')).toBe(true);
    expect(hasPermission('member', 'org:manage_members')).toBe(false);

    // Viewer is read-only
    expect(hasPermission('viewer', 'org:read')).toBe(true);
    expect(hasPermission('viewer', 'ws:create')).toBe(false);
    expect(hasPermission('viewer', 'portfolio:create')).toBe(false);
  });

  it('step 5: logs member addition in audit log', () => {
    writeAuditLog({
      orgId,
      userId: users.owner.id,
      action: 'org.member_added',
      resourceType: 'org_member',
      details: { invitedUser: users.admin.email, role: 'admin' },
      ip: '127.0.0.1'
    });

    const logs = queryAuditLogs({ orgId, action: 'org.member_added' });
    expect(logs.total).toBeGreaterThanOrEqual(1);
  });

  it('step 6: updates organization settings', () => {
    const newSettings = JSON.stringify({ theme: 'dark', timezone: 'UTC' });
    run('UPDATE organizations SET settings = ? WHERE id = ?', newSettings, orgId);

    const org = get<{ settings: string }>('SELECT settings FROM organizations WHERE id = ?', orgId);
    const parsed = JSON.parse(org?.settings || '{}');

    expect(parsed.theme).toBe('dark');
    expect(parsed.timezone).toBe('UTC');
  });
});

describe('Workspace Hierarchy Journey', () => {
  const wsUser = { id: randomUUID(), email: `ws-user-${Date.now()}@atlas.dev` };
  let orgId: string;
  let wsId: string;

  beforeAll(async () => {
    const hash = await hashPassword('Password123!');
    run(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      wsUser.id, wsUser.email, hash, 'Workspace User'
    );

    orgId = randomUUID();
    run(
      `INSERT INTO organizations (id, name, slug, plan, owner_id) VALUES (?, ?, ?, ?, ?)`,
      orgId, 'WS Test Org', `ws-org-${Date.now()}`, 'enterprise', wsUser.id
    );
    run(
      `INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`,
      randomUUID(), orgId, wsUser.id
    );
  });

  it('step 1: creates a workspace within organization', () => {
    wsId = randomUUID();
    const slug = `project-alpha-${Date.now()}`;

    run(
      `INSERT INTO workspaces (id, name, slug, org_id, description) VALUES (?, ?, ?, ?, ?)`,
      wsId, 'Project Alpha', slug, orgId, 'Main renewable energy project'
    );

    const ws = get<{ id: string; name: string; org_id: string }>(
      'SELECT id, name, org_id FROM workspaces WHERE id = ?',
      wsId
    );

    expect(ws?.name).toBe('Project Alpha');
    expect(ws?.org_id).toBe(orgId);
  });

  it('step 2: adds workspace member with editor role', () => {
    const editorId = randomUUID();
    const editorUser = { id: randomUUID(), email: `editor-${Date.now()}@atlas.dev` };

    run(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, 'hash', ?)`,
      editorUser.id, editorUser.email, 'Editor User'
    );

    run(
      `INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, 'member')`,
      randomUUID(), orgId, editorUser.id
    );

    run(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'editor')`,
      editorId, wsId, editorUser.id
    );

    const member = get<{ role: string }>(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      wsId, editorUser.id
    );

    expect(member?.role).toBe('editor');
  });

  it('step 3: enforces workspace-level permissions', () => {
    expect(hasWorkspacePermission('admin', 'ws:update')).toBe(true);
    expect(hasWorkspacePermission('admin', 'ws:delete')).toBe(true);
    expect(hasWorkspacePermission('admin', 'portfolio:create')).toBe(true);

    expect(hasWorkspacePermission('editor', 'ws:update')).toBe(true);
    expect(hasWorkspacePermission('editor', 'ws:delete')).toBe(false);
    expect(hasWorkspacePermission('editor', 'portfolio:create')).toBe(true);

    expect(hasWorkspacePermission('viewer', 'ws:read')).toBe(true);
    expect(hasWorkspacePermission('viewer', 'ws:update')).toBe(false);
    expect(hasWorkspacePermission('viewer', 'portfolio:create')).toBe(false);
  });

  it('step 4: lists all workspaces in organization', () => {
    // Add another workspace
    run(
      `INSERT INTO workspaces (id, name, slug, org_id) VALUES (?, ?, ?, ?)`,
      randomUUID(), 'Project Beta', `beta-${Date.now()}`, orgId
    );

    const workspaces = all<{ name: string }>(
      'SELECT name FROM workspaces WHERE org_id = ? ORDER BY name',
      orgId
    );

    expect(workspaces.length).toBe(2);
    expect(workspaces.some(w => w.name === 'Project Alpha')).toBe(true);
    expect(workspaces.some(w => w.name === 'Project Beta')).toBe(true);
  });

  it('step 5: workspace slug is unique within org', () => {
    const duplicateSlug = `project-alpha-${Date.now()}`;
    run(
      `INSERT INTO workspaces (id, name, slug, org_id) VALUES (?, ?, ?, ?)`,
      randomUUID(), 'Duplicate Alpha', duplicateSlug, orgId
    );

    // Try to insert same slug - should fail
    expect(() => {
      run(
        `INSERT INTO workspaces (id, name, slug, org_id) VALUES (?, ?, ?, ?)`,
        randomUUID(), 'Another Alpha', duplicateSlug, orgId
      );
    }).toThrow();
  });
});

describe('Portfolio Management Journey', () => {
  const portfolioUser = { id: randomUUID(), email: `portfolio-${Date.now()}@atlas.dev` };
  let orgId: string;
  let wsId: string;
  let portfolioId: string;

  beforeAll(async () => {
    const hash = await hashPassword('Password123!');
    run(
      `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      portfolioUser.id, portfolioUser.email, hash, 'Portfolio User'
    );

    orgId = randomUUID();
    wsId = randomUUID();

    run(
      `INSERT INTO organizations (id, name, slug, plan, owner_id) VALUES (?, ?, ?, ?, ?)`,
      orgId, 'Portfolio Org', `portfolio-org-${Date.now()}`, 'enterprise', portfolioUser.id
    );
    run(
      `INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`,
      randomUUID(), orgId, portfolioUser.id
    );
    run(
      `INSERT INTO workspaces (id, name, slug, org_id) VALUES (?, ?, ?, ?)`,
      wsId, 'Energy Projects', `energy-${Date.now()}`, orgId
    );
  });

  it('step 1: creates a portfolio within workspace', () => {
    portfolioId = randomUUID();

    run(
      `INSERT INTO portfolios (id, name, slug, workspace_id, description) VALUES (?, ?, ?, ?, ?)`,
      portfolioId, 'Wind Farm Alpha', `wind-alpha-${Date.now()}`, wsId, '100MW onshore wind project'
    );

    const portfolio = get<{ name: string; workspace_id: string }>(
      'SELECT name, workspace_id FROM portfolios WHERE id = ?',
      portfolioId
    );

    expect(portfolio?.name).toBe('Wind Farm Alpha');
    expect(portfolio?.workspace_id).toBe(wsId);
  });

  it('step 2: creates multiple portfolios in workspace', () => {
    const portfolios = [
      { name: 'Solar Park Beta', slug: `solar-beta-${Date.now()}`, description: '50MW solar farm' },
      { name: 'Battery Storage Gamma', slug: `battery-gamma-${Date.now()}`, description: '20MWh BESS' },
      { name: 'Hydro Project Delta', slug: `hydro-delta-${Date.now()}`, description: '25MW run-of-river' }
    ];

    for (const p of portfolios) {
      run(
        `INSERT INTO portfolios (id, name, slug, workspace_id, description) VALUES (?, ?, ?, ?, ?)`,
        randomUUID(), p.name, p.slug, wsId, p.description
      );
    }

    const allPortfolios = all<{ name: string }>(
      'SELECT name FROM portfolios WHERE workspace_id = ?',
      wsId
    );

    expect(allPortfolios.length).toBe(4);
  });

  it('step 3: updates portfolio settings', () => {
    const settings = JSON.stringify({
      currency: 'USD',
      targetIRR: 0.15,
      riskTolerance: 'moderate'
    });

    run('UPDATE portfolios SET settings = ? WHERE id = ?', settings, portfolioId);

    const portfolio = get<{ settings: string }>(
      'SELECT settings FROM portfolios WHERE id = ?',
      portfolioId
    );

    const parsed = JSON.parse(portfolio?.settings || '{}');
    expect(parsed.currency).toBe('USD');
    expect(parsed.targetIRR).toBe(0.15);
  });

  it('step 4: queries portfolios with filters', () => {
    const portfolios = all<{ name: string; description: string }>(
      `SELECT name, description FROM portfolios WHERE workspace_id = ? AND description LIKE ?`,
      wsId, '%MW%'
    );

    expect(portfolios.length).toBeGreaterThanOrEqual(3);
  });

  it('step 5: logs portfolio creation audit', () => {
    writeAuditLog({
      orgId,
      userId: portfolioUser.id,
      action: 'portfolio.create',
      resourceType: 'portfolio',
      resourceId: portfolioId,
      details: { name: 'Wind Farm Alpha', workspace: wsId },
      ip: '127.0.0.1'
    });

    const logs = queryAuditLogs({ orgId, action: 'portfolio.create' });
    expect(logs.total).toBeGreaterThanOrEqual(1);
  });

  it('step 6: deletes portfolio and cascades', () => {
    const tempPortfolioId = randomUUID();
    run(
      `INSERT INTO portfolios (id, name, slug, workspace_id) VALUES (?, ?, ?, ?)`,
      tempPortfolioId, 'Temp Portfolio', `temp-${Date.now()}`, wsId
    );

    run('DELETE FROM portfolios WHERE id = ?', tempPortfolioId);

    const deleted = get('SELECT id FROM portfolios WHERE id = ?', tempPortfolioId);
    expect(deleted).toBeUndefined();
  });
});

describe('ABAC Policy Evaluation Journey', () => {
  let orgId: string;

  beforeAll(() => {
    orgId = randomUUID();
    run(
      `INSERT INTO organizations (id, name, slug, plan, owner_id) VALUES (?, ?, ?, ?, ?)`,
      orgId, 'ABAC Test Org', `abac-${Date.now()}`, 'enterprise', randomUUID()
    );
  });

  it('step 1: creates an ABAC deny policy', () => {
    const policyId = randomUUID();

    run(
      `INSERT INTO abac_policies (id, org_id, name, description, resource_type, conditions, actions, effect, priority) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      policyId,
      orgId,
      'Deny viewer exports',
      'Prevent viewers from exporting data',
      'report',
      JSON.stringify({ 'user.orgRole': { equals: 'viewer' } }),
      JSON.stringify(['export', 'download']),
      'deny',
      100
    );

    const policy = get<{ name: string; effect: string }>(
      'SELECT name, effect FROM abac_policies WHERE id = ?',
      policyId
    );

    expect(policy?.name).toBe('Deny viewer exports');
    expect(policy?.effect).toBe('deny');
  });

  it('step 2: creates an ABAC allow policy', () => {
    const policyId = randomUUID();

    run(
      `INSERT INTO abac_policies (id, org_id, name, resource_type, conditions, actions, effect, priority) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      policyId,
      orgId,
      'Allow admin full access',
      '*',
      JSON.stringify({ 'user.orgRole': { in: ['owner', 'admin'] } }),
      JSON.stringify(['*']),
      'allow',
      50
    );

    const policy = get<{ effect: string }>(
      'SELECT effect FROM abac_policies WHERE id = ?',
      policyId
    );

    expect(policy?.effect).toBe('allow');
  });

  it('step 3: lists policies for organization', () => {
    const policies = all<{ name: string; priority: number }>(
      'SELECT name, priority FROM abac_policies WHERE org_id = ? ORDER BY priority DESC',
      orgId
    );

    expect(policies.length).toBe(2);
    expect(policies[0].priority).toBeGreaterThan(policies[1].priority);
  });

  it('step 4: evaluates ABAC policies correctly', () => {
    // Test deny-first evaluation
    const viewerContext = {
      user: { id: 'viewer-1', orgRole: 'viewer' },
      resource: { type: 'report' },
      action: 'export'
    };

    const adminContext = {
      user: { id: 'admin-1', orgRole: 'admin' },
      resource: { type: 'report' },
      action: 'export'
    };

    const result1 = evaluateAbacPolicies(orgId, viewerContext);
    const result2 = evaluateAbacPolicies(orgId, adminContext);

    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
  });

  it('step 5: disables a policy', () => {
    const policies = all<{ id: string }>(
      'SELECT id FROM abac_policies WHERE org_id = ?',
      orgId
    );

    run('UPDATE abac_policies SET enabled = 0 WHERE id = ?', policies[0].id);

    const updated = get<{ enabled: number }>(
      'SELECT enabled FROM abac_policies WHERE id = ?',
      policies[0].id
    );

    expect(updated?.enabled).toBe(0);
  });
});

describe('SSO Provider Configuration Journey', () => {
  let orgId: string;

  beforeAll(() => {
    orgId = randomUUID();
    run(
      `INSERT INTO organizations (id, name, slug, plan, owner_id) VALUES (?, ?, ?, ?, ?)`,
      orgId, 'SSO Test Org', `sso-${Date.now()}`, 'enterprise', randomUUID()
    );
  });

  it('step 1: creates a SAML SSO provider', () => {
    const providerId = randomUUID();

    run(
      `INSERT INTO sso_providers (id, org_id, provider_type, metadata_url, config) VALUES (?, ?, ?, ?, ?)`,
      providerId,
      orgId,
      'saml',
      'https://idp.example.com/metadata.xml',
      JSON.stringify({
        entityId: 'atlas-enterprise',
        acsUrl: 'https://atlas.dev/auth/saml/callback',
        nameIdFormat: 'email'
      })
    );

    const provider = get<{ provider_type: string; metadata_url: string }>(
      'SELECT provider_type, metadata_url FROM sso_providers WHERE id = ?',
      providerId
    );

    expect(provider?.provider_type).toBe('saml');
    expect(provider?.metadata_url).toContain('idp.example.com');
  });

  it('step 2: creates an OIDC SSO provider', () => {
    const providerId = randomUUID();

    run(
      `INSERT INTO sso_providers (id, org_id, provider_type, client_id, client_secret_enc, config) VALUES (?, ?, ?, ?, ?, ?)`,
      providerId,
      orgId,
      'oidc',
      'atlas-client-id',
      'encrypted-secret',
      JSON.stringify({
        issuer: 'https://auth.example.com',
        scopes: ['openid', 'profile', 'email'],
        redirectUri: 'https://atlas.dev/auth/oidc/callback'
      })
    );

    const provider = get<{ provider_type: string; client_id: string }>(
      'SELECT provider_type, client_id FROM sso_providers WHERE id = ?',
      providerId
    );

    expect(provider?.provider_type).toBe('oidc');
    expect(provider?.client_id).toBe('atlas-client-id');
  });

  it('step 3: enables SSO provider', () => {
    const providers = all<{ id: string }>(
      'SELECT id FROM sso_providers WHERE org_id = ?',
      orgId
    );

    run('UPDATE sso_providers SET enabled = 1 WHERE id = ?', providers[0].id);

    const provider = get<{ enabled: number }>(
      'SELECT enabled FROM sso_providers WHERE id = ?',
      providers[0].id
    );

    expect(provider?.enabled).toBe(1);
  });

  it('step 4: logs SSO configuration audit', () => {
    writeAuditLog({
      orgId,
      userId: 'admin-user',
      action: 'sso.configured',
      resourceType: 'sso_provider',
      details: { provider: 'saml', enabled: true },
      ip: '127.0.0.1'
    });

    const logs = queryAuditLogs({ orgId, action: 'sso.configured' });
    expect(logs.total).toBeGreaterThanOrEqual(1);
  });
});
