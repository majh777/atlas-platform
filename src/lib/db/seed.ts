import { randomUUID } from 'node:crypto';
import { initDb, run, get } from './index';
import { hashPassword } from '../auth/password';

export async function seed(): Promise<void> {
  initDb();

  const existingUser = get<{ id: string }>('SELECT id FROM users WHERE email = ?', 'admin@atlas.dev');
  if (existingUser) return;

  // Users
  const adminId = randomUUID();
  const analystId = randomUUID();
  const viewerId = randomUUID();

  const hash = await hashPassword('Atlas2026!');

  run(`INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
    adminId, 'admin@atlas.dev', hash, 'Alice Admin');
  run(`INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
    analystId, 'analyst@atlas.dev', hash, 'Bob Analyst');
  run(`INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
    viewerId, 'viewer@atlas.dev', hash, 'Carol Viewer');

  // Organization
  const orgId = randomUUID();
  run(`INSERT INTO organizations (id, name, slug, plan, owner_id) VALUES (?, ?, ?, ?, ?)`,
    orgId, 'Atlas Capital Partners', 'atlas-capital', 'professional', adminId);

  // Org Members
  run(`INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`,
    randomUUID(), orgId, adminId);
  run(`INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, 'member')`,
    randomUUID(), orgId, analystId);
  run(`INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, 'viewer')`,
    randomUUID(), orgId, viewerId);

  // Workspaces
  const ws1Id = randomUUID();
  const ws2Id = randomUUID();
  run(`INSERT INTO workspaces (id, name, slug, org_id, description) VALUES (?, ?, ?, ?, ?)`,
    ws1Id, 'Africa Mining', 'africa-mining', orgId, 'Mining projects across Sub-Saharan Africa');
  run(`INSERT INTO workspaces (id, name, slug, org_id, description) VALUES (?, ?, ?, ?, ?)`,
    ws2Id, 'Infrastructure', 'infrastructure', orgId, 'Large-scale infrastructure investments');

  // Workspace Members
  run(`INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'admin')`,
    randomUUID(), ws1Id, adminId);
  run(`INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'editor')`,
    randomUUID(), ws1Id, analystId);
  run(`INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'viewer')`,
    randomUUID(), ws1Id, viewerId);
  run(`INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'admin')`,
    randomUUID(), ws2Id, adminId);

  // Portfolios
  const p1Id = randomUUID();
  const p2Id = randomUUID();
  run(`INSERT INTO portfolios (id, name, slug, workspace_id, description) VALUES (?, ?, ?, ?, ?)`,
    p1Id, 'Cameroon Bauxite', 'cameroon-bauxite', ws1Id, 'Cameroon bauxite corridor project');
  run(`INSERT INTO portfolios (id, name, slug, workspace_id, description) VALUES (?, ?, ?, ?, ?)`,
    p2Id, 'Gabon Manganese', 'gabon-manganese', ws1Id, 'Gabon manganese upgrade');

  // SSO Provider stub
  run(`INSERT INTO sso_providers (id, org_id, provider_type, client_id, metadata_url, config) VALUES (?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, 'oidc', 'atlas-oidc-client',
    'https://idp.example.com/.well-known/openid-configuration',
    JSON.stringify({ scopes: ['openid', 'profile', 'email'] }));

  // ABAC Policy
  run(`INSERT INTO abac_policies (id, org_id, name, description, resource_type, conditions, actions, effect, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, 'Viewer read-only',
    'Viewers can only read resources',
    null,
    JSON.stringify({ 'user.orgRole': 'viewer' }),
    JSON.stringify(['read']),
    'allow', 10);

  // Audit logs
  run(`INSERT INTO audit_logs (id, org_id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, adminId, 'org.create', 'organization', orgId,
    JSON.stringify({ name: 'Atlas Capital Partners' }));
  run(`INSERT INTO audit_logs (id, org_id, user_id, action, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, adminId, 'workspace.create', 'workspace', ws1Id,
    JSON.stringify({ name: 'Africa Mining' }));

  // Notifications
  run(`INSERT INTO notifications (id, user_id, org_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), adminId, orgId, 'system', 'Welcome to Atlas',
    'Your organization has been set up with demo data.', '/admin');
  run(`INSERT INTO notifications (id, user_id, org_id, type, title, body) VALUES (?, ?, ?, ?, ?, ?)`,
    randomUUID(), analystId, orgId, 'org_invite', 'You joined Atlas Capital Partners',
    'You have the "member" role.');

  // Tasks
  run(`INSERT INTO tasks (id, org_id, workspace_id, assigned_to, created_by, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, ws1Id, analystId, adminId,
    'Complete due diligence on Cameroon Bauxite', 'Review all uploaded documents and evidence cards.',
    'in_progress', 'high', '2026-04-01');
  run(`INSERT INTO tasks (id, org_id, workspace_id, assigned_to, created_by, title, description, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, ws1Id, adminId, adminId,
    'Configure SSO for Atlas Capital', 'Set up OIDC provider for team SSO.',
    'pending', 'medium');
  run(`INSERT INTO tasks (id, org_id, workspace_id, assigned_to, created_by, title, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, ws2Id, viewerId, adminId,
    'Review infrastructure portfolio summary', 'pending', 'low');
}
