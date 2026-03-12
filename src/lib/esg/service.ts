import { randomUUID } from 'node:crypto';
import { all, get, run } from '@/lib/db';
import { createNotification } from '@/lib/services/notifications';
import { emitEvent } from '@/lib/services/events';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ActionPriority = 'low' | 'medium' | 'high' | 'critical';
export type PermitStatus = 'draft' | 'active' | 'expiring' | 'expired' | 'renewal_in_progress' | 'suspended' | 'closed';
export type ObligationStatus = 'open' | 'in_progress' | 'completed' | 'overdue' | 'waived' | 'cancelled';
export type ObligationType = 'permit' | 'regulatory' | 'community' | 'local_content' | 'stakeholder' | 'commitment' | 'esg';
export type CommunityCaseType = 'issue' | 'grievance' | 'engagement';
export type CommunityCaseStatus = 'open' | 'in_review' | 'action_required' | 'resolved' | 'closed' | 'escalated';
export type Sensitivity = 'standard' | 'sensitive' | 'restricted';
export type EscalationLevel = 'none' | 'internal' | 'executive' | 'regulatory';
export type IncidentCategory = 'environmental' | 'social' | 'governance' | 'safety' | 'security';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'contained' | 'closed' | 'escalated';
export type ActionStatus = 'open' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
export type ActionTargetType = 'obligation' | 'community_case' | 'incident' | 'report_pack' | 'permit';
export type ReportPackType = 'regulatory_report' | 'evidence_bundle' | 'permit_register' | 'community_report' | 'incident_pack' | 'local_content_report' | 'stakeholder_engagement_report';
export type ReportPackStatus = 'draft' | 'ready' | 'submitted' | 'archived';
export type MetricType = 'local_content' | 'stakeholder_engagement';

export interface Permit {
  id: string;
  org_id: string;
  workspace_id: string | null;
  portfolio_id: string | null;
  title: string;
  permit_number: string;
  permit_type: string;
  authority: string;
  jurisdiction: string | null;
  status: PermitStatus;
  risk_level: RiskLevel;
  issue_date: string | null;
  expiry_date: string | null;
  review_date: string | null;
  alert_days: number;
  owner_user_id: string | null;
  notes: string | null;
  evidence_links: string[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Obligation {
  id: string;
  org_id: string;
  workspace_id: string | null;
  portfolio_id: string | null;
  permit_id: string | null;
  title: string;
  obligation_type: ObligationType;
  source_reference: string | null;
  commitment_party: string | null;
  status: ObligationStatus;
  priority: ActionPriority;
  due_date: string | null;
  completed_at: string | null;
  owner_user_id: string | null;
  notes: string | null;
  evidence_links: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityCase {
  id: string;
  org_id: string;
  workspace_id: string | null;
  portfolio_id: string | null;
  case_type: CommunityCaseType;
  sensitivity: Sensitivity;
  status: CommunityCaseStatus;
  stakeholder_name: string;
  stakeholder_group: string | null;
  location: string | null;
  channel: string | null;
  summary: string;
  details: string | null;
  received_at: string | null;
  owner_user_id: string | null;
  escalation_level: EscalationLevel;
  confidential_notes: string | null;
  evidence_links: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ESGIncident {
  id: string;
  org_id: string;
  workspace_id: string | null;
  portfolio_id: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  occurred_at: string | null;
  reported_at: string;
  owner_user_id: string | null;
  escalation_level: Exclude<EscalationLevel, 'none'>;
  regulator_notified: number;
  immediate_actions: string | null;
  evidence_links: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseAction {
  id: string;
  org_id: string;
  workspace_id: string | null;
  portfolio_id: string | null;
  target_type: ActionTargetType;
  target_id: string;
  title: string;
  description: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  due_at: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  is_sensitive: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportPack {
  id: string;
  org_id: string;
  workspace_id: string | null;
  portfolio_id: string | null;
  pack_type: ReportPackType;
  title: string;
  status: ReportPackStatus;
  period_start: string | null;
  period_end: string | null;
  submitted_at: string | null;
  generated_by: string | null;
  template_sections: string[];
  package_summary: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReportEvidenceItem {
  id: string;
  report_pack_id: string;
  source_type: 'permit' | 'obligation' | 'community_case' | 'incident' | 'document' | 'external';
  source_id: string | null;
  title: string;
  evidence_url: string | null;
  citation: string | null;
  tags: string[];
  created_at: string;
}

export interface StakeholderMetric {
  id: string;
  org_id: string;
  workspace_id: string | null;
  portfolio_id: string | null;
  metric_type: MetricType;
  metric_key: string;
  metric_value: number;
  unit: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapPermit(row: Record<string, unknown>): Permit {
  return {
    ...row,
    evidence_links: parseJson<string[]>(row.evidence_links, []),
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
  } as Permit;
}

function mapObligation(row: Record<string, unknown>): Obligation {
  return {
    ...row,
    evidence_links: parseJson<string[]>(row.evidence_links, []),
  } as Obligation;
}

function mapCommunityCase(row: Record<string, unknown>): CommunityCase {
  return {
    ...row,
    evidence_links: parseJson<string[]>(row.evidence_links, []),
  } as CommunityCase;
}

function mapIncident(row: Record<string, unknown>): ESGIncident {
  return {
    ...row,
    evidence_links: parseJson<string[]>(row.evidence_links, []),
  } as ESGIncident;
}

function mapAction(row: Record<string, unknown>): CaseAction {
  return row as unknown as CaseAction;
}

function mapReportPack(row: Record<string, unknown>): ReportPack {
  return {
    ...row,
    template_sections: parseJson<string[]>(row.template_sections, []),
    package_summary: parseJson<Record<string, unknown>>(row.package_summary, {}),
  } as ReportPack;
}

function mapEvidenceItem(row: Record<string, unknown>): ReportEvidenceItem {
  return {
    ...row,
    tags: parseJson<string[]>(row.tags, []),
  } as ReportEvidenceItem;
}

function mapMetric(row: Record<string, unknown>): StakeholderMetric {
  return row as unknown as StakeholderMetric;
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function computePermitStatus(permit: Pick<Permit, 'status' | 'expiry_date' | 'alert_days'>): PermitStatus {
  if (permit.status === 'closed' || permit.status === 'suspended' || permit.status === 'renewal_in_progress' || permit.status === 'draft') {
    return permit.status;
  }
  const remaining = daysUntil(permit.expiry_date);
  if (remaining == null) return 'active';
  if (remaining < 0) return 'expired';
  if (remaining <= permit.alert_days) return 'expiring';
  return 'active';
}

function computeObligationStatus<T extends { status: ObligationStatus | ActionStatus; due_date?: string | null; due_at?: string | null; completed_at?: string | null }>(item: T) {
  if (item.status === 'completed' || item.status === 'cancelled' || item.status === 'waived') return item.status;
  const due = item.due_date ?? item.due_at;
  if (!due) return item.status;
  return new Date(due).getTime() < Date.now() ? 'overdue' : item.status;
}

function createTemplateSections(packType: ReportPackType) {
  const common = ['executive-summary', 'material-findings', 'evidence-index'];
  const specific: Record<ReportPackType, string[]> = {
    regulatory_report: ['regulatory-filings', 'permit-status', 'open-obligations'],
    evidence_bundle: ['bundle-cover', 'chain-of-custody', 'supporting-artifacts'],
    permit_register: ['permit-register', 'expiry-watchlist', 'renewal-actions'],
    community_report: ['grievance-log', 'community-actions', 'sensitive-case-review'],
    incident_pack: ['incident-timeline', 'root-cause', 'corrective-actions'],
    local_content_report: ['local-spend', 'workforce-breakdown', 'supplier-development'],
    stakeholder_engagement_report: ['engagement-log', 'sentiment-summary', 'follow-ups'],
  };
  return [...common, ...specific[packType]];
}

function createAlertNotification(userId: string | null | undefined, orgId: string, type: string, title: string, body: string, link: string) {
  if (!userId) return;
  createNotification({ userId, orgId, type, title, body, link });
}

export interface CreatePermitInput {
  orgId: string;
  workspaceId?: string;
  portfolioId?: string;
  title: string;
  permitNumber: string;
  permitType: string;
  authority: string;
  jurisdiction?: string;
  issueDate?: string;
  expiryDate?: string;
  reviewDate?: string;
  status?: PermitStatus;
  riskLevel?: RiskLevel;
  alertDays?: number;
  ownerUserId?: string;
  notes?: string;
  evidenceLinks?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export function createPermit(input: CreatePermitInput): Permit {
  const id = randomUUID();
  const now = new Date().toISOString();
  const status = computePermitStatus({
    status: input.status ?? 'active',
    expiry_date: input.expiryDate ?? null,
    alert_days: input.alertDays ?? 90,
  });

  run(
    `INSERT INTO permits (id, org_id, workspace_id, portfolio_id, title, permit_number, permit_type, authority, jurisdiction, status, risk_level, issue_date, expiry_date, review_date, alert_days, owner_user_id, notes, evidence_links, metadata, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.workspaceId ?? null,
    input.portfolioId ?? null,
    input.title,
    input.permitNumber,
    input.permitType,
    input.authority,
    input.jurisdiction ?? null,
    status,
    input.riskLevel ?? 'medium',
    input.issueDate ?? null,
    input.expiryDate ?? null,
    input.reviewDate ?? null,
    input.alertDays ?? 90,
    input.ownerUserId ?? null,
    input.notes ?? null,
    JSON.stringify(input.evidenceLinks ?? []),
    JSON.stringify(input.metadata ?? {}),
    input.createdBy ?? null,
    now,
    now,
  );

  const permit = getPermit(id)!;
  if (permit.status === 'expiring' || permit.status === 'expired') {
    createAlertNotification(
      permit.owner_user_id,
      permit.org_id,
      'permit_expiry',
      `Permit ${permit.permit_number} requires attention`,
      permit.status === 'expired' ? 'Permit has expired.' : `Permit expires within ${permit.alert_days} days.`,
      `/api/permits?id=${permit.id}`,
    );
  }
  emitEvent('permit.created', permit);
  return permit;
}

export function getPermit(id: string): Permit | null {
  const row = get<Record<string, unknown>>('SELECT * FROM permits WHERE id = ?', id);
  return row ? mapPermit(row) : null;
}

export function updatePermit(id: string, updates: Partial<CreatePermitInput & { status: PermitStatus }>): Permit | null {
  const existing = getPermit(id);
  if (!existing) return null;
  const nextStatus = computePermitStatus({
    status: updates.status ?? existing.status,
    expiry_date: updates.expiryDate ?? existing.expiry_date,
    alert_days: updates.alertDays ?? existing.alert_days,
  });

  run(
    `UPDATE permits SET title = ?, permit_number = ?, permit_type = ?, authority = ?, jurisdiction = ?, status = ?, risk_level = ?, issue_date = ?, expiry_date = ?, review_date = ?, alert_days = ?, owner_user_id = ?, notes = ?, evidence_links = ?, metadata = ?, updated_at = ? WHERE id = ?`,
    updates.title ?? existing.title,
    updates.permitNumber ?? existing.permit_number,
    updates.permitType ?? existing.permit_type,
    updates.authority ?? existing.authority,
    updates.jurisdiction ?? existing.jurisdiction,
    nextStatus,
    updates.riskLevel ?? existing.risk_level,
    updates.issueDate ?? existing.issue_date,
    updates.expiryDate ?? existing.expiry_date,
    updates.reviewDate ?? existing.review_date,
    updates.alertDays ?? existing.alert_days,
    updates.ownerUserId ?? existing.owner_user_id,
    updates.notes ?? existing.notes,
    JSON.stringify(updates.evidenceLinks ?? existing.evidence_links),
    JSON.stringify(updates.metadata ?? existing.metadata),
    new Date().toISOString(),
    id,
  );

  const permit = getPermit(id)!;
  emitEvent('permit.updated', permit);
  return permit;
}

export interface PermitFilter {
  orgId?: string;
  workspaceId?: string;
  portfolioId?: string;
  status?: PermitStatus;
  ownerUserId?: string;
  riskLevel?: RiskLevel;
  limit?: number;
  offset?: number;
}

export function queryPermits(filter: PermitFilter = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) { conditions.push('org_id = ?'); params.push(filter.orgId); }
  if (filter.workspaceId) { conditions.push('workspace_id = ?'); params.push(filter.workspaceId); }
  if (filter.portfolioId) { conditions.push('portfolio_id = ?'); params.push(filter.portfolioId); }
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
  if (filter.ownerUserId) { conditions.push('owner_user_id = ?'); params.push(filter.ownerUserId); }
  if (filter.riskLevel) { conditions.push('risk_level = ?'); params.push(filter.riskLevel); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM permits ${where}`, ...params)?.cnt ?? 0;
  const permits = all<Record<string, unknown>>(
    `SELECT * FROM permits ${where} ORDER BY COALESCE(expiry_date, '9999-12-31') ASC, created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    filter.limit ?? 50,
    filter.offset ?? 0,
  ).map(mapPermit);

  const data = permits.map((permit) => {
    const computedStatus = computePermitStatus(permit);
    if (computedStatus !== permit.status) {
      run(`UPDATE permits SET status = ?, updated_at = ? WHERE id = ?`, computedStatus, new Date().toISOString(), permit.id);
      return { ...permit, status: computedStatus };
    }
    return permit;
  });

  return {
    data,
    total,
    summary: {
      expiring: data.filter((permit) => permit.status === 'expiring').length,
      expired: data.filter((permit) => permit.status === 'expired').length,
      highRisk: data.filter((permit) => permit.risk_level === 'high' || permit.risk_level === 'critical').length,
    },
  };
}

export interface CreateObligationInput {
  orgId: string;
  workspaceId?: string;
  portfolioId?: string;
  permitId?: string;
  title: string;
  obligationType: ObligationType;
  sourceReference?: string;
  commitmentParty?: string;
  status?: ObligationStatus;
  priority?: ActionPriority;
  dueDate?: string;
  ownerUserId?: string;
  notes?: string;
  evidenceLinks?: string[];
  createdBy?: string;
}

export function createObligation(input: CreateObligationInput): Obligation {
  const id = randomUUID();
  const now = new Date().toISOString();
  const status = computeObligationStatus({ status: input.status ?? 'open', due_date: input.dueDate ?? null }) as ObligationStatus;

  run(
    `INSERT INTO obligations (id, org_id, workspace_id, portfolio_id, permit_id, title, obligation_type, source_reference, commitment_party, status, priority, due_date, owner_user_id, notes, evidence_links, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.workspaceId ?? null,
    input.portfolioId ?? null,
    input.permitId ?? null,
    input.title,
    input.obligationType,
    input.sourceReference ?? null,
    input.commitmentParty ?? null,
    status,
    input.priority ?? 'medium',
    input.dueDate ?? null,
    input.ownerUserId ?? null,
    input.notes ?? null,
    JSON.stringify(input.evidenceLinks ?? []),
    input.createdBy ?? null,
    now,
    now,
  );

  const obligation = getObligation(id)!;
  if (obligation.status === 'overdue') {
    createAlertNotification(obligation.owner_user_id, obligation.org_id, 'obligation_overdue', 'Obligation overdue', obligation.title, `/api/esg?obligationId=${obligation.id}`);
  }
  emitEvent('obligation.created', obligation);
  return obligation;
}

export function getObligation(id: string): Obligation | null {
  const row = get<Record<string, unknown>>('SELECT * FROM obligations WHERE id = ?', id);
  return row ? mapObligation(row) : null;
}

export function updateObligation(id: string, updates: Partial<CreateObligationInput & { status: ObligationStatus; completedAt?: string }>): Obligation | null {
  const existing = getObligation(id);
  if (!existing) return null;
  const status = computeObligationStatus({ status: updates.status ?? existing.status, due_date: updates.dueDate ?? existing.due_date }) as ObligationStatus;
  const completedAt = status === 'completed' ? updates.completedAt ?? new Date().toISOString() : null;

  run(
    `UPDATE obligations SET title = ?, obligation_type = ?, source_reference = ?, commitment_party = ?, status = ?, priority = ?, due_date = ?, completed_at = ?, owner_user_id = ?, notes = ?, evidence_links = ?, updated_at = ? WHERE id = ?`,
    updates.title ?? existing.title,
    updates.obligationType ?? existing.obligation_type,
    updates.sourceReference ?? existing.source_reference,
    updates.commitmentParty ?? existing.commitment_party,
    status,
    updates.priority ?? existing.priority,
    updates.dueDate ?? existing.due_date,
    completedAt,
    updates.ownerUserId ?? existing.owner_user_id,
    updates.notes ?? existing.notes,
    JSON.stringify(updates.evidenceLinks ?? existing.evidence_links),
    new Date().toISOString(),
    id,
  );

  const obligation = getObligation(id)!;
  emitEvent('obligation.updated', obligation);
  return obligation;
}

export interface ObligationFilter {
  orgId?: string;
  workspaceId?: string;
  portfolioId?: string;
  permitId?: string;
  status?: ObligationStatus;
  obligationType?: ObligationType;
  ownerUserId?: string;
  limit?: number;
  offset?: number;
}

export function queryObligations(filter: ObligationFilter = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) { conditions.push('org_id = ?'); params.push(filter.orgId); }
  if (filter.workspaceId) { conditions.push('workspace_id = ?'); params.push(filter.workspaceId); }
  if (filter.portfolioId) { conditions.push('portfolio_id = ?'); params.push(filter.portfolioId); }
  if (filter.permitId) { conditions.push('permit_id = ?'); params.push(filter.permitId); }
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
  if (filter.obligationType) { conditions.push('obligation_type = ?'); params.push(filter.obligationType); }
  if (filter.ownerUserId) { conditions.push('owner_user_id = ?'); params.push(filter.ownerUserId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM obligations ${where}`, ...params)?.cnt ?? 0;
  const raw = all<Record<string, unknown>>(
    `SELECT * FROM obligations ${where} ORDER BY COALESCE(due_date, '9999-12-31') ASC, created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    filter.limit ?? 50,
    filter.offset ?? 0,
  ).map(mapObligation);

  const data = raw.map((item) => {
    const nextStatus = computeObligationStatus(item) as ObligationStatus;
    if (nextStatus !== item.status) {
      run(`UPDATE obligations SET status = ?, updated_at = ? WHERE id = ?`, nextStatus, new Date().toISOString(), item.id);
      return { ...item, status: nextStatus };
    }
    return item;
  });

  return {
    data,
    total,
    summary: {
      overdue: data.filter((item) => item.status === 'overdue').length,
      open: data.filter((item) => item.status === 'open' || item.status === 'in_progress').length,
      completed: data.filter((item) => item.status === 'completed').length,
    },
  };
}

export interface CreateCaseActionInput {
  orgId: string;
  workspaceId?: string;
  portfolioId?: string;
  targetType: ActionTargetType;
  targetId: string;
  title: string;
  description?: string;
  status?: ActionStatus;
  priority?: ActionPriority;
  dueAt?: string;
  assignedTo?: string;
  isSensitive?: boolean;
  createdBy?: string;
}

export function createCaseAction(input: CreateCaseActionInput): CaseAction {
  const id = randomUUID();
  const now = new Date().toISOString();
  const status = computeObligationStatus({ status: input.status ?? 'open', due_at: input.dueAt ?? null }) as ActionStatus;
  run(
    `INSERT INTO case_actions (id, org_id, workspace_id, portfolio_id, target_type, target_id, title, description, status, priority, due_at, assigned_to, is_sensitive, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.workspaceId ?? null,
    input.portfolioId ?? null,
    input.targetType,
    input.targetId,
    input.title,
    input.description ?? null,
    status,
    input.priority ?? 'medium',
    input.dueAt ?? null,
    input.assignedTo ?? null,
    input.isSensitive ? 1 : 0,
    input.createdBy ?? null,
    now,
    now,
  );
  const action = getCaseAction(id)!;
  if (action.status === 'overdue') {
    createAlertNotification(action.assigned_to, action.org_id, 'case_action_overdue', 'Overdue ESG action', action.title, `/api/esg?actionId=${action.id}`);
  }
  emitEvent('case_action.created', action);
  return action;
}

export function getCaseAction(id: string): CaseAction | null {
  const row = get<Record<string, unknown>>('SELECT * FROM case_actions WHERE id = ?', id);
  return row ? mapAction(row) : null;
}

export function updateCaseAction(id: string, updates: Partial<CreateCaseActionInput & { status: ActionStatus; completedAt?: string }>): CaseAction | null {
  const existing = getCaseAction(id);
  if (!existing) return null;
  const status = computeObligationStatus({ status: updates.status ?? existing.status, due_at: updates.dueAt ?? existing.due_at }) as ActionStatus;
  const completedAt = status === 'completed' ? updates.completedAt ?? new Date().toISOString() : null;
  run(
    `UPDATE case_actions SET title = ?, description = ?, status = ?, priority = ?, due_at = ?, completed_at = ?, assigned_to = ?, is_sensitive = ?, updated_at = ? WHERE id = ?`,
    updates.title ?? existing.title,
    updates.description ?? existing.description,
    status,
    updates.priority ?? existing.priority,
    updates.dueAt ?? existing.due_at,
    completedAt,
    updates.assignedTo ?? existing.assigned_to,
    updates.isSensitive == null ? existing.is_sensitive : updates.isSensitive ? 1 : 0,
    new Date().toISOString(),
    id,
  );
  const action = getCaseAction(id)!;
  emitEvent('case_action.updated', action);
  return action;
}

export function queryCaseActions(filter: { orgId?: string; targetType?: ActionTargetType; targetId?: string; status?: ActionStatus; assignedTo?: string; limit?: number; offset?: number } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) { conditions.push('org_id = ?'); params.push(filter.orgId); }
  if (filter.targetType) { conditions.push('target_type = ?'); params.push(filter.targetType); }
  if (filter.targetId) { conditions.push('target_id = ?'); params.push(filter.targetId); }
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
  if (filter.assignedTo) { conditions.push('assigned_to = ?'); params.push(filter.assignedTo); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM case_actions ${where}`, ...params)?.cnt ?? 0;
  const raw = all<Record<string, unknown>>(`SELECT * FROM case_actions ${where} ORDER BY COALESCE(due_at, '9999-12-31') ASC, created_at DESC LIMIT ? OFFSET ?`, ...params, filter.limit ?? 100, filter.offset ?? 0).map(mapAction);
  const data = raw.map((item) => {
    const nextStatus = computeObligationStatus(item) as ActionStatus;
    if (nextStatus !== item.status) {
      run(`UPDATE case_actions SET status = ?, updated_at = ? WHERE id = ?`, nextStatus, new Date().toISOString(), item.id);
      return { ...item, status: nextStatus };
    }
    return item;
  });
  return {
    data,
    total,
    summary: {
      overdue: data.filter((item) => item.status === 'overdue').length,
      sensitive: data.filter((item) => item.is_sensitive === 1).length,
    },
  };
}

export interface CreateCommunityCaseInput {
  orgId: string;
  workspaceId?: string;
  portfolioId?: string;
  caseType: CommunityCaseType;
  sensitivity?: Sensitivity;
  status?: CommunityCaseStatus;
  stakeholderName: string;
  stakeholderGroup?: string;
  location?: string;
  channel?: string;
  summary: string;
  details?: string;
  receivedAt?: string;
  ownerUserId?: string;
  escalationLevel?: EscalationLevel;
  confidentialNotes?: string;
  evidenceLinks?: string[];
  createdBy?: string;
}

export function createCommunityCase(input: CreateCommunityCaseInput): CommunityCase {
  const id = randomUUID();
  const now = new Date().toISOString();
  const escalationLevel = input.escalationLevel ?? (input.sensitivity === 'restricted' ? 'executive' : 'internal');
  const status = escalationLevel === 'executive' || escalationLevel === 'regulatory' ? 'escalated' : input.status ?? 'open';
  run(
    `INSERT INTO community_cases (id, org_id, workspace_id, portfolio_id, case_type, sensitivity, status, stakeholder_name, stakeholder_group, location, channel, summary, details, received_at, owner_user_id, escalation_level, confidential_notes, evidence_links, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.workspaceId ?? null,
    input.portfolioId ?? null,
    input.caseType,
    input.sensitivity ?? 'standard',
    status,
    input.stakeholderName,
    input.stakeholderGroup ?? null,
    input.location ?? null,
    input.channel ?? null,
    input.summary,
    input.details ?? null,
    input.receivedAt ?? now,
    input.ownerUserId ?? null,
    escalationLevel,
    input.confidentialNotes ?? null,
    JSON.stringify(input.evidenceLinks ?? []),
    input.createdBy ?? null,
    now,
    now,
  );
  const communityCase = getCommunityCase(id)!;
  if (communityCase.sensitivity !== 'standard') {
    createAlertNotification(communityCase.owner_user_id, communityCase.org_id, 'community_sensitive_case', 'Sensitive community case opened', communityCase.summary, `/api/esg?caseId=${communityCase.id}`);
  }
  emitEvent('community_case.created', communityCase);
  return communityCase;
}

export function getCommunityCase(id: string): CommunityCase | null {
  const row = get<Record<string, unknown>>('SELECT * FROM community_cases WHERE id = ?', id);
  return row ? mapCommunityCase(row) : null;
}

export function updateCommunityCase(id: string, updates: Partial<CreateCommunityCaseInput & { status: CommunityCaseStatus }>): CommunityCase | null {
  const existing = getCommunityCase(id);
  if (!existing) return null;
  run(
    `UPDATE community_cases SET case_type = ?, sensitivity = ?, status = ?, stakeholder_name = ?, stakeholder_group = ?, location = ?, channel = ?, summary = ?, details = ?, received_at = ?, owner_user_id = ?, escalation_level = ?, confidential_notes = ?, evidence_links = ?, updated_at = ? WHERE id = ?`,
    updates.caseType ?? existing.case_type,
    updates.sensitivity ?? existing.sensitivity,
    updates.status ?? existing.status,
    updates.stakeholderName ?? existing.stakeholder_name,
    updates.stakeholderGroup ?? existing.stakeholder_group,
    updates.location ?? existing.location,
    updates.channel ?? existing.channel,
    updates.summary ?? existing.summary,
    updates.details ?? existing.details,
    updates.receivedAt ?? existing.received_at,
    updates.ownerUserId ?? existing.owner_user_id,
    updates.escalationLevel ?? existing.escalation_level,
    updates.confidentialNotes ?? existing.confidential_notes,
    JSON.stringify(updates.evidenceLinks ?? existing.evidence_links),
    new Date().toISOString(),
    id,
  );
  const communityCase = getCommunityCase(id)!;
  emitEvent('community_case.updated', communityCase);
  return communityCase;
}

export function queryCommunityCases(filter: { orgId?: string; workspaceId?: string; portfolioId?: string; caseType?: CommunityCaseType; status?: CommunityCaseStatus; sensitivity?: Sensitivity; ownerUserId?: string; limit?: number; offset?: number } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) { conditions.push('org_id = ?'); params.push(filter.orgId); }
  if (filter.workspaceId) { conditions.push('workspace_id = ?'); params.push(filter.workspaceId); }
  if (filter.portfolioId) { conditions.push('portfolio_id = ?'); params.push(filter.portfolioId); }
  if (filter.caseType) { conditions.push('case_type = ?'); params.push(filter.caseType); }
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
  if (filter.sensitivity) { conditions.push('sensitivity = ?'); params.push(filter.sensitivity); }
  if (filter.ownerUserId) { conditions.push('owner_user_id = ?'); params.push(filter.ownerUserId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM community_cases ${where}`, ...params)?.cnt ?? 0;
  const data = all<Record<string, unknown>>(`SELECT * FROM community_cases ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params, filter.limit ?? 50, filter.offset ?? 0).map(mapCommunityCase);
  return {
    data,
    total,
    summary: {
      open: data.filter((item) => ['open', 'in_review', 'action_required', 'escalated'].includes(item.status)).length,
      sensitive: data.filter((item) => item.sensitivity !== 'standard').length,
      escalated: data.filter((item) => item.status === 'escalated').length,
    },
  };
}

export interface CreateIncidentInput {
  orgId: string;
  workspaceId?: string;
  portfolioId?: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status?: IncidentStatus;
  title: string;
  description: string;
  occurredAt?: string;
  reportedAt?: string;
  ownerUserId?: string;
  escalationLevel?: Exclude<EscalationLevel, 'none'>;
  regulatorNotified?: boolean;
  immediateActions?: string;
  evidenceLinks?: string[];
  createdBy?: string;
}

export function createIncident(input: CreateIncidentInput): ESGIncident {
  const id = randomUUID();
  const now = new Date().toISOString();
  const escalationLevel = input.escalationLevel ?? (input.severity === 'critical' ? 'regulatory' : input.severity === 'high' ? 'executive' : 'internal');
  const status = escalationLevel === 'regulatory' || escalationLevel === 'executive' ? 'escalated' : input.status ?? 'open';

  run(
    `INSERT INTO esg_incidents (id, org_id, workspace_id, portfolio_id, category, severity, status, title, description, occurred_at, reported_at, owner_user_id, escalation_level, regulator_notified, immediate_actions, evidence_links, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.workspaceId ?? null,
    input.portfolioId ?? null,
    input.category,
    input.severity,
    status,
    input.title,
    input.description,
    input.occurredAt ?? null,
    input.reportedAt ?? now,
    input.ownerUserId ?? null,
    escalationLevel,
    input.regulatorNotified ? 1 : 0,
    input.immediateActions ?? null,
    JSON.stringify(input.evidenceLinks ?? []),
    input.createdBy ?? null,
    now,
    now,
  );

  const incident = getIncident(id)!;
  if (incident.severity === 'critical' || incident.severity === 'high') {
    createCaseAction({
      orgId: incident.org_id,
      workspaceId: incident.workspace_id ?? undefined,
      portfolioId: incident.portfolio_id ?? undefined,
      targetType: 'incident',
      targetId: incident.id,
      title: `Corrective action: ${incident.title}`,
      description: incident.immediate_actions ?? 'Immediate incident response and closure evidence required.',
      priority: incident.severity === 'critical' ? 'critical' : 'high',
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      assignedTo: incident.owner_user_id ?? undefined,
      createdBy: incident.created_by ?? undefined,
    });
    createAlertNotification(incident.owner_user_id, incident.org_id, 'incident_escalation', 'ESG incident escalation', incident.title, `/api/incidents?id=${incident.id}`);
  }
  emitEvent('incident.created', incident);
  return incident;
}

export function getIncident(id: string): ESGIncident | null {
  const row = get<Record<string, unknown>>('SELECT * FROM esg_incidents WHERE id = ?', id);
  return row ? mapIncident(row) : null;
}

export function updateIncident(id: string, updates: Partial<CreateIncidentInput & { status: IncidentStatus }>): ESGIncident | null {
  const existing = getIncident(id);
  if (!existing) return null;
  run(
    `UPDATE esg_incidents SET category = ?, severity = ?, status = ?, title = ?, description = ?, occurred_at = ?, reported_at = ?, owner_user_id = ?, escalation_level = ?, regulator_notified = ?, immediate_actions = ?, evidence_links = ?, updated_at = ? WHERE id = ?`,
    updates.category ?? existing.category,
    updates.severity ?? existing.severity,
    updates.status ?? existing.status,
    updates.title ?? existing.title,
    updates.description ?? existing.description,
    updates.occurredAt ?? existing.occurred_at,
    updates.reportedAt ?? existing.reported_at,
    updates.ownerUserId ?? existing.owner_user_id,
    updates.escalationLevel ?? existing.escalation_level,
    updates.regulatorNotified == null ? existing.regulator_notified : updates.regulatorNotified ? 1 : 0,
    updates.immediateActions ?? existing.immediate_actions,
    JSON.stringify(updates.evidenceLinks ?? existing.evidence_links),
    new Date().toISOString(),
    id,
  );
  const incident = getIncident(id)!;
  emitEvent('incident.updated', incident);
  return incident;
}

export function queryIncidents(filter: { orgId?: string; workspaceId?: string; portfolioId?: string; category?: IncidentCategory; severity?: IncidentSeverity; status?: IncidentStatus; ownerUserId?: string; limit?: number; offset?: number } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) { conditions.push('org_id = ?'); params.push(filter.orgId); }
  if (filter.workspaceId) { conditions.push('workspace_id = ?'); params.push(filter.workspaceId); }
  if (filter.portfolioId) { conditions.push('portfolio_id = ?'); params.push(filter.portfolioId); }
  if (filter.category) { conditions.push('category = ?'); params.push(filter.category); }
  if (filter.severity) { conditions.push('severity = ?'); params.push(filter.severity); }
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
  if (filter.ownerUserId) { conditions.push('owner_user_id = ?'); params.push(filter.ownerUserId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM esg_incidents ${where}`, ...params)?.cnt ?? 0;
  const data = all<Record<string, unknown>>(`SELECT * FROM esg_incidents ${where} ORDER BY reported_at DESC LIMIT ? OFFSET ?`, ...params, filter.limit ?? 50, filter.offset ?? 0).map(mapIncident);
  return {
    data,
    total,
    summary: {
      open: data.filter((item) => item.status !== 'closed').length,
      critical: data.filter((item) => item.severity === 'critical').length,
      regulatorNotified: data.filter((item) => item.regulator_notified === 1).length,
    },
  };
}

export interface CreateReportPackInput {
  orgId: string;
  workspaceId?: string;
  portfolioId?: string;
  packType: ReportPackType;
  title: string;
  status?: ReportPackStatus;
  periodStart?: string;
  periodEnd?: string;
  generatedBy?: string;
  evidenceItems?: Array<{
    sourceType: ReportEvidenceItem['source_type'];
    sourceId?: string;
    title: string;
    evidenceUrl?: string;
    citation?: string;
    tags?: string[];
  }>;
}

export function createReportPack(input: CreateReportPackInput): { pack: ReportPack; evidenceItems: ReportEvidenceItem[] } {
  const id = randomUUID();
  const now = new Date().toISOString();
  const templateSections = createTemplateSections(input.packType);
  const summary = {
    evidenceCount: input.evidenceItems?.length ?? 0,
    generatedAt: now,
    packaging: input.packType === 'evidence_bundle' || input.packType === 'incident_pack' ? 'zip-ready' : 'board-ready',
  };

  run(
    `INSERT INTO report_packs (id, org_id, workspace_id, portfolio_id, pack_type, title, status, period_start, period_end, generated_by, template_sections, package_summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.workspaceId ?? null,
    input.portfolioId ?? null,
    input.packType,
    input.title,
    input.status ?? 'draft',
    input.periodStart ?? null,
    input.periodEnd ?? null,
    input.generatedBy ?? null,
    JSON.stringify(templateSections),
    JSON.stringify(summary),
    now,
    now,
  );

  for (const item of input.evidenceItems ?? []) {
    run(
      `INSERT INTO report_evidence_items (id, report_pack_id, source_type, source_id, title, evidence_url, citation, tags, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      id,
      item.sourceType,
      item.sourceId ?? null,
      item.title,
      item.evidenceUrl ?? null,
      item.citation ?? null,
      JSON.stringify(item.tags ?? []),
      now,
    );
  }

  const pack = getReportPack(id)!;
  const evidenceItems = listReportEvidence(id);
  emitEvent('report_pack.created', { pack, evidenceItems });
  return { pack, evidenceItems };
}

export function getReportPack(id: string): ReportPack | null {
  const row = get<Record<string, unknown>>('SELECT * FROM report_packs WHERE id = ?', id);
  return row ? mapReportPack(row) : null;
}

export function listReportEvidence(reportPackId: string): ReportEvidenceItem[] {
  return all<Record<string, unknown>>('SELECT * FROM report_evidence_items WHERE report_pack_id = ? ORDER BY created_at ASC', reportPackId).map(mapEvidenceItem);
}

export function queryReportPacks(filter: { orgId?: string; workspaceId?: string; portfolioId?: string; packType?: ReportPackType; status?: ReportPackStatus; limit?: number; offset?: number } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) { conditions.push('org_id = ?'); params.push(filter.orgId); }
  if (filter.workspaceId) { conditions.push('workspace_id = ?'); params.push(filter.workspaceId); }
  if (filter.portfolioId) { conditions.push('portfolio_id = ?'); params.push(filter.portfolioId); }
  if (filter.packType) { conditions.push('pack_type = ?'); params.push(filter.packType); }
  if (filter.status) { conditions.push('status = ?'); params.push(filter.status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM report_packs ${where}`, ...params)?.cnt ?? 0;
  const data = all<Record<string, unknown>>(`SELECT * FROM report_packs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params, filter.limit ?? 50, filter.offset ?? 0).map(mapReportPack);
  return { data, total };
}

export interface CreateStakeholderMetricInput {
  orgId: string;
  workspaceId?: string;
  portfolioId?: string;
  metricType: MetricType;
  metricKey: string;
  metricValue: number;
  unit?: string;
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
  recordedBy?: string;
}

export function createStakeholderMetric(input: CreateStakeholderMetricInput): StakeholderMetric {
  const id = randomUUID();
  run(
    `INSERT INTO stakeholder_metrics (id, org_id, workspace_id, portfolio_id, metric_type, metric_key, metric_value, unit, period_start, period_end, notes, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.workspaceId ?? null,
    input.portfolioId ?? null,
    input.metricType,
    input.metricKey,
    input.metricValue,
    input.unit ?? null,
    input.periodStart ?? null,
    input.periodEnd ?? null,
    input.notes ?? null,
    input.recordedBy ?? null,
    new Date().toISOString(),
  );
  const metric = getStakeholderMetric(id)!;
  emitEvent('stakeholder_metric.created', metric);
  return metric;
}

export function getStakeholderMetric(id: string): StakeholderMetric | null {
  const row = get<Record<string, unknown>>('SELECT * FROM stakeholder_metrics WHERE id = ?', id);
  return row ? mapMetric(row) : null;
}

export function queryStakeholderMetrics(filter: { orgId?: string; workspaceId?: string; portfolioId?: string; metricType?: MetricType; limit?: number; offset?: number } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) { conditions.push('org_id = ?'); params.push(filter.orgId); }
  if (filter.workspaceId) { conditions.push('workspace_id = ?'); params.push(filter.workspaceId); }
  if (filter.portfolioId) { conditions.push('portfolio_id = ?'); params.push(filter.portfolioId); }
  if (filter.metricType) { conditions.push('metric_type = ?'); params.push(filter.metricType); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM stakeholder_metrics ${where}`, ...params)?.cnt ?? 0;
  const data = all<Record<string, unknown>>(`SELECT * FROM stakeholder_metrics ${where} ORDER BY COALESCE(period_end, created_at) DESC LIMIT ? OFFSET ?`, ...params, filter.limit ?? 100, filter.offset ?? 0).map(mapMetric);
  return {
    data,
    total,
    summary: data.reduce<Record<string, number>>((acc, metric) => {
      acc[`${metric.metric_type}:${metric.metric_key}`] = (acc[`${metric.metric_type}:${metric.metric_key}`] ?? 0) + metric.metric_value;
      return acc;
    }, {}),
  };
}

export function getPermitDashboard(filter: { orgId?: string; workspaceId?: string; portfolioId?: string } = {}) {
  const permits = queryPermits(filter);
  const obligations = queryObligations(filter);
  const actions = queryCaseActions({ orgId: filter.orgId, status: 'overdue' });
  return {
    ...permits,
    obligations: obligations.data,
    obligationSummary: obligations.summary,
    alerts: {
      expiringPermits: permits.summary.expiring,
      expiredPermits: permits.summary.expired,
      overdueObligations: obligations.summary.overdue,
      overdueActions: actions.summary.overdue,
    },
  };
}

export function getESGDashboard(filter: { orgId?: string; workspaceId?: string; portfolioId?: string } = {}) {
  const obligations = queryObligations(filter);
  const communityCases = queryCommunityCases(filter);
  const reportPacks = queryReportPacks(filter);
  const metrics = queryStakeholderMetrics(filter);
  const actions = queryCaseActions({ orgId: filter.orgId });
  return {
    obligations,
    communityCases,
    reportPacks,
    metrics,
    actions,
    alerts: {
      overdueActions: actions.summary.overdue,
      overdueObligations: obligations.summary.overdue,
      sensitiveCases: communityCases.summary.sensitive,
    },
  };
}

export function getIncidentDashboard(filter: { orgId?: string; workspaceId?: string; portfolioId?: string } = {}) {
  const incidents = queryIncidents(filter);
  const actions = queryCaseActions({ orgId: filter.orgId, targetType: 'incident' });
  return {
    ...incidents,
    actions: actions.data,
    alerts: {
      criticalIncidents: incidents.summary.critical,
      overdueActions: actions.summary.overdue,
    },
  };
}
