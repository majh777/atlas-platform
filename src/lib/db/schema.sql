-- Atlas Platform Foundations - Database Schema
-- SQLite with WAL mode and foreign keys

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  mfa_secret TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  mfa_recovery_codes TEXT, -- JSON array of recovery codes
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'professional', 'enterprise')),
  settings TEXT, -- JSON object
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Workspaces
-- ============================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT,
  settings TEXT, -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, slug)
);

-- ============================================================
-- Portfolios
-- ============================================================
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  description TEXT,
  settings TEXT, -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, slug)
);

-- ============================================================
-- Organization Members
-- ============================================================
CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'billing')),
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, user_id)
);

-- ============================================================
-- Workspace Members
-- ============================================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  UNIQUE(workspace_id, user_id)
);

-- ============================================================
-- Sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

-- ============================================================
-- SSO Providers
-- ============================================================
CREATE TABLE IF NOT EXISTS sso_providers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('saml', 'oidc')),
  client_id TEXT,
  client_secret_enc TEXT,
  metadata_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  config TEXT, -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Audit Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT, -- JSON object
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON audit_logs(org_id, created_at);

-- ============================================================
-- Notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT,
  type TEXT,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, read_at);

-- ============================================================
-- Tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  workspace_id TEXT,
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned
  ON tasks(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_tasks_org_workspace
  ON tasks(org_id, workspace_id);

-- ============================================================
-- ABAC Policies
-- ============================================================
CREATE TABLE IF NOT EXISTS abac_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  resource_type TEXT,
  conditions TEXT, -- JSON object
  actions TEXT,    -- JSON array
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Module 6: Data Room, Diligence Workflow, Committee Ops
-- ============================================================
CREATE TABLE IF NOT EXISTS data_rooms (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workspace_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'confidential' CHECK (classification IN ('internal', 'confidential', 'restricted', 'external')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  description TEXT,
  watermark_template TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, slug)
);

CREATE TABLE IF NOT EXISTS data_room_documents (
  id TEXT PRIMARY KEY,
  data_room_id TEXT NOT NULL REFERENCES data_rooms(id) ON DELETE CASCADE,
  document_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  source_url TEXT,
  evidence_links TEXT, -- JSON array
  tags TEXT, -- JSON array
  checksum TEXT,
  version_label TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS data_room_access_grants (
  id TEXT PRIMARY KEY,
  data_room_id TEXT NOT NULL REFERENCES data_rooms(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'external_party')),
  subject_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'owner', 'question_only')),
  scope_collections TEXT NOT NULL, -- JSON array
  allow_download INTEGER NOT NULL DEFAULT 0,
  allow_upload INTEGER NOT NULL DEFAULT 0,
  require_watermark INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(data_room_id, subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS diligence_questions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  data_room_id TEXT REFERENCES data_rooms(id) ON DELETE SET NULL,
  document_id TEXT,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed', 'overdue')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  asked_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  due_at TEXT,
  answered_at TEXT,
  answer_text TEXT,
  evidence_links TEXT, -- JSON array
  audit_ledger TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approval_workflows (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  data_room_id TEXT REFERENCES data_rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  workflow_type TEXT NOT NULL CHECK (workflow_type IN ('investment_memo', 'board_pack', 'committee_approval', 'signoff')),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'cancelled')),
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TEXT,
  decided_at TEXT,
  decision_summary TEXT,
  metadata TEXT, -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  approver_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  decided_at TEXT,
  notes TEXT,
  signature_metadata TEXT, -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workflow_id, step_order)
);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  step_id TEXT REFERENCES approval_steps(id) ON DELETE SET NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('submit', 'approve', 'reject', 'comment')),
  notes TEXT,
  signature_metadata TEXT, -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS committee_meetings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  data_room_id TEXT REFERENCES data_rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  committee_name TEXT NOT NULL,
  scheduled_for TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  location TEXT,
  agenda_summary TEXT,
  board_pack_workflow_id TEXT REFERENCES approval_workflows(id) ON DELETE SET NULL,
  investment_memo_workflow_id TEXT REFERENCES approval_workflows(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS committee_agenda_items (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES committee_meetings(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  presenter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  related_workflow_id TEXT REFERENCES approval_workflows(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'presented', 'deferred', 'approved', 'rejected')),
  notes TEXT,
  decision_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(meeting_id, item_order)
);

CREATE TABLE IF NOT EXISTS committee_signoffs (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES committee_meetings(id) ON DELETE CASCADE,
  workflow_id TEXT REFERENCES approval_workflows(id) ON DELETE SET NULL,
  signer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'abstain')),
  notes TEXT,
  signature_metadata TEXT NOT NULL, -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_actions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workflow_id TEXT REFERENCES approval_workflows(id) ON DELETE SET NULL,
  meeting_id TEXT REFERENCES committee_meetings(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'done')),
  due_at TEXT,
  dependency_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
  log_entries TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_data_rooms_org_status
  ON data_rooms(org_id, status);

CREATE INDEX IF NOT EXISTS idx_data_room_docs_room_collection
  ON data_room_documents(data_room_id, collection_name);

CREATE INDEX IF NOT EXISTS idx_data_room_access_subject
  ON data_room_access_grants(subject_type, subject_id, data_room_id);

CREATE INDEX IF NOT EXISTS idx_diligence_questions_owner_status
  ON diligence_questions(owner_user_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_org_status
  ON approval_workflows(org_id, status, workflow_type);

CREATE INDEX IF NOT EXISTS idx_committee_meetings_org_schedule
  ON committee_meetings(org_id, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_workflow_actions_owner_status
  ON workflow_actions(owner_user_id, status, due_at);

-- ============================================================
-- Module 9: ESG, Permitting, Community and Regulatory Controls
-- ============================================================
CREATE TABLE IF NOT EXISTS permits (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workspace_id TEXT,
  portfolio_id TEXT,
  title TEXT NOT NULL,
  permit_number TEXT NOT NULL,
  permit_type TEXT NOT NULL,
  authority TEXT NOT NULL,
  jurisdiction TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expiring', 'expired', 'renewal_in_progress', 'suspended', 'closed')),
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  issue_date TEXT,
  expiry_date TEXT,
  review_date TEXT,
  alert_days INTEGER NOT NULL DEFAULT 90,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  evidence_links TEXT NOT NULL DEFAULT '[]', -- JSON array
  metadata TEXT NOT NULL DEFAULT '{}', -- JSON object
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS obligations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workspace_id TEXT,
  portfolio_id TEXT,
  permit_id TEXT REFERENCES permits(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  obligation_type TEXT NOT NULL CHECK (obligation_type IN ('permit', 'regulatory', 'community', 'local_content', 'stakeholder', 'commitment', 'esg')),
  source_reference TEXT,
  commitment_party TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'overdue', 'waived', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  due_date TEXT,
  completed_at TEXT,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  evidence_links TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_cases (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workspace_id TEXT,
  portfolio_id TEXT,
  case_type TEXT NOT NULL CHECK (case_type IN ('issue', 'grievance', 'engagement')),
  sensitivity TEXT NOT NULL DEFAULT 'standard' CHECK (sensitivity IN ('standard', 'sensitive', 'restricted')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'action_required', 'resolved', 'closed', 'escalated')),
  stakeholder_name TEXT NOT NULL,
  stakeholder_group TEXT,
  location TEXT,
  channel TEXT,
  summary TEXT NOT NULL,
  details TEXT,
  received_at TEXT,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  escalation_level TEXT NOT NULL DEFAULT 'none' CHECK (escalation_level IN ('none', 'internal', 'executive', 'regulatory')),
  confidential_notes TEXT,
  evidence_links TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS esg_incidents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workspace_id TEXT,
  portfolio_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('environmental', 'social', 'governance', 'safety', 'security')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'closed', 'escalated')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  occurred_at TEXT,
  reported_at TEXT NOT NULL,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  escalation_level TEXT NOT NULL DEFAULT 'internal' CHECK (escalation_level IN ('internal', 'executive', 'regulatory')),
  regulator_notified INTEGER NOT NULL DEFAULT 0,
  immediate_actions TEXT,
  evidence_links TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS case_actions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workspace_id TEXT,
  portfolio_id TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('obligation', 'community_case', 'incident', 'report_pack', 'permit')),
  target_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'overdue', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  due_at TEXT,
  completed_at TEXT,
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_sensitive INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_packs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workspace_id TEXT,
  portfolio_id TEXT,
  pack_type TEXT NOT NULL CHECK (pack_type IN ('regulatory_report', 'evidence_bundle', 'permit_register', 'community_report', 'incident_pack', 'local_content_report', 'stakeholder_engagement_report')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'submitted', 'archived')),
  period_start TEXT,
  period_end TEXT,
  submitted_at TEXT,
  generated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  template_sections TEXT NOT NULL DEFAULT '[]', -- JSON array
  package_summary TEXT NOT NULL DEFAULT '{}', -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_evidence_items (
  id TEXT PRIMARY KEY,
  report_pack_id TEXT NOT NULL REFERENCES report_packs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('permit', 'obligation', 'community_case', 'incident', 'document', 'external')),
  source_id TEXT,
  title TEXT NOT NULL,
  evidence_url TEXT,
  citation TEXT,
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stakeholder_metrics (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  workspace_id TEXT,
  portfolio_id TEXT,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('local_content', 'stakeholder_engagement')),
  metric_key TEXT NOT NULL,
  metric_value REAL NOT NULL,
  unit TEXT,
  period_start TEXT,
  period_end TEXT,
  notes TEXT,
  recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_permits_org_expiry
  ON permits(org_id, status, expiry_date);

CREATE INDEX IF NOT EXISTS idx_obligations_org_due
  ON obligations(org_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_community_cases_org_status
  ON community_cases(org_id, status, sensitivity);

CREATE INDEX IF NOT EXISTS idx_esg_incidents_org_status
  ON esg_incidents(org_id, status, severity, reported_at);

CREATE INDEX IF NOT EXISTS idx_case_actions_org_due
  ON case_actions(org_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_report_packs_org_type
  ON report_packs(org_id, pack_type, status);

CREATE INDEX IF NOT EXISTS idx_stakeholder_metrics_scope
  ON stakeholder_metrics(org_id, metric_type, period_end);
