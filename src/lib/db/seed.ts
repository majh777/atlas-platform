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

  // Module 9 - ESG / permitting demo data
  const permitId = randomUUID();
  const obligationId = randomUUID();
  const communityCaseId = randomUUID();
  const incidentId = randomUUID();
  const reportPackId = randomUUID();

  run(`INSERT INTO permits (id, org_id, workspace_id, portfolio_id, title, permit_number, permit_type, authority, jurisdiction, status, risk_level, issue_date, expiry_date, review_date, alert_days, owner_user_id, notes, evidence_links, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    permitId, orgId, ws1Id, p1Id,
    'Mining exploitation licence', 'ML-CM-2026-014', 'mining_licence', 'Cameroon Ministry of Mines', 'Cameroon',
    'expiring', 'high', '2025-01-10', '2026-04-20', '2026-03-30', 120, analystId,
    'Renewal dossier requires updated social commitments annex.', JSON.stringify(['/evidence/permit-ml-cm-2026-014']), JSON.stringify({ corridor: 'Kribi' }), adminId);

  run(`INSERT INTO obligations (id, org_id, workspace_id, portfolio_id, permit_id, title, obligation_type, source_reference, commitment_party, status, priority, due_date, owner_user_id, notes, evidence_links, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    obligationId, orgId, ws1Id, p1Id, permitId,
    'Submit quarterly environmental monitoring report', 'regulatory', 'Permit condition 7.2', 'Regional Mines Directorate', 'open', 'high', '2026-03-25', analystId,
    'Bundle water sampling results and signed site inspection record.', JSON.stringify(['/evidence/water-sampling-q1']), adminId);

  run(`INSERT INTO community_cases (id, org_id, workspace_id, portfolio_id, case_type, sensitivity, status, stakeholder_name, stakeholder_group, location, channel, summary, details, received_at, owner_user_id, escalation_level, confidential_notes, evidence_links, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    communityCaseId, orgId, ws1Id, p1Id,
    'grievance', 'sensitive', 'escalated', 'Mbalam community committee', 'host_community', 'Mbalam North', 'in_person',
    'Employment allocation grievance raised by village committee', 'Committee requested transparent publication of local hiring shortlist and interview records.', '2026-03-05T09:30:00.000Z', analystId, 'executive',
    'Handle via restricted circulation due to local political sponsorship.', JSON.stringify(['/evidence/community-grievance-2026-03']), adminId);

  run(`INSERT INTO esg_incidents (id, org_id, workspace_id, portfolio_id, category, severity, status, title, description, occurred_at, reported_at, owner_user_id, escalation_level, regulator_notified, immediate_actions, evidence_links, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    incidentId, orgId, ws1Id, p1Id,
    'environmental', 'high', 'escalated', 'Sediment overflow at haul-road drainage point', 'Heavy rainfall caused temporary overflow into downstream drainage channel.', '2026-03-07T12:20:00.000Z', '2026-03-07T13:10:00.000Z', analystId, 'executive', 0,
    'Deploy containment berm, sample water, brief regulator if exceedances confirmed.', JSON.stringify(['/evidence/incident-sediment-overflow']), adminId);

  run(`INSERT INTO case_actions (id, org_id, workspace_id, portfolio_id, target_type, target_id, title, description, status, priority, due_at, assigned_to, is_sensitive, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, ws1Id, p1Id,
    'incident', incidentId, 'Close out sediment overflow CAPA', 'Submit root-cause analysis and photographic closure evidence.', 'open', 'high', '2026-03-14T12:00:00.000Z', analystId, 0, adminId);

  run(`INSERT INTO report_packs (id, org_id, workspace_id, portfolio_id, pack_type, title, status, period_start, period_end, generated_by, template_sections, package_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    reportPackId, orgId, ws1Id, p1Id,
    'regulatory_report', 'Q1 2026 environmental and community filing pack', 'ready', '2026-01-01', '2026-03-31', adminId,
    JSON.stringify(['executive-summary', 'regulatory-filings', 'permit-status', 'open-obligations', 'evidence-index']),
    JSON.stringify({ evidenceCount: 3, packaging: 'board-ready' }));

  run(`INSERT INTO report_evidence_items (id, report_pack_id, source_type, source_id, title, evidence_url, citation, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), reportPackId, 'permit', permitId, 'Permit renewal tracker', '/evidence/permit-ml-cm-2026-014', 'Permit renewal dossier v2', JSON.stringify(['permit', 'renewal']));
  run(`INSERT INTO report_evidence_items (id, report_pack_id, source_type, source_id, title, evidence_url, citation, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), reportPackId, 'incident', incidentId, 'Overflow incident log', '/evidence/incident-sediment-overflow', 'Incident register item #17', JSON.stringify(['incident', 'environmental']));

  run(`INSERT INTO stakeholder_metrics (id, org_id, workspace_id, portfolio_id, metric_type, metric_key, metric_value, unit, period_start, period_end, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, ws1Id, p1Id, 'local_content', 'local_procurement_share', 42, '%', '2026-01-01', '2026-03-31', 'Local supplier spend increased after corridor subcontracting.', adminId);
  run(`INSERT INTO stakeholder_metrics (id, org_id, workspace_id, portfolio_id, metric_type, metric_key, metric_value, unit, period_start, period_end, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), orgId, ws1Id, p1Id, 'stakeholder_engagement', 'engagement_sessions', 11, 'sessions', '2026-01-01', '2026-03-31', 'Village meetings, regulator briefings, and supplier workshops.', adminId);
}
