import { randomUUID } from 'node:crypto';
import { all, get, run } from '@/lib/db';
import { createNotification } from '@/lib/services/notifications';
import { emitEvent } from '@/lib/services/events';

export type DeploymentEnvironment = 'dev' | 'staging' | 'production' | 'dr';
export type DeploymentStatus = 'planned' | 'running' | 'succeeded' | 'failed' | 'rolled_back';
export type ReleaseStatus = 'draft' | 'approved' | 'scheduled' | 'released' | 'rolled_back' | 'cancelled';
export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
export type IncidentStatus = 'open' | 'triaged' | 'mitigating' | 'monitoring' | 'resolved' | 'closed';
export type IncidentSource = 'monitoring' | 'security' | 'support' | 'deployment' | 'manual';
export type TestSuiteType = 'regression' | 'performance' | 'resilience' | 'security';
export type TestSuiteStatus = 'queued' | 'running' | 'passed' | 'failed';

export interface DeploymentRecord {
  id: string;
  org_id: string;
  release_id: string | null;
  environment: DeploymentEnvironment;
  status: DeploymentStatus;
  version: string;
  strategy: string;
  rollback_version: string | null;
  change_window: string | null;
  approval_ticket: string | null;
  observability_dashboard: string | null;
  trace_id: string | null;
  initiated_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseRecord {
  id: string;
  org_id: string;
  version: string;
  name: string;
  status: ReleaseStatus;
  environment: DeploymentEnvironment;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  release_notes: string | null;
  change_summary: string | null;
  runbook_id: string | null;
  rollback_version: string | null;
  scheduled_for: string | null;
  approved_by: string | null;
  deployed_at: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OpsIncidentRecord {
  id: string;
  org_id: string;
  deployment_id: string | null;
  release_id: string | null;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source: IncidentSource;
  service: string | null;
  summary: string;
  impact: string | null;
  runbook_id: string | null;
  owner_user_id: string | null;
  commander_user_id: string | null;
  detected_at: string;
  resolved_at: string | null;
  timeline: Array<Record<string, unknown>>;
  customer_updates: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

export interface RunbookRecord {
  id: string;
  org_id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  owner_team: string | null;
  severity_scope: string | null;
  status: 'draft' | 'active' | 'archived';
  repository_path: string | null;
  tags: string[];
  steps: Array<Record<string, unknown>>;
  verification: Array<Record<string, unknown>>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsTestSuiteRecord {
  id: string;
  org_id: string;
  suite_type: TestSuiteType;
  name: string;
  status: TestSuiteStatus;
  target_environment: DeploymentEnvironment;
  score: number | null;
  findings: Array<Record<string, unknown>>;
  executed_at: string | null;
  created_at: string;
}

interface DeploymentInput {
  orgId: string;
  releaseId?: string;
  environment: DeploymentEnvironment;
  version: string;
  strategy?: string;
  rollbackVersion?: string;
  changeWindow?: string;
  approvalTicket?: string;
  observabilityDashboard?: string;
  traceId?: string;
  initiatedBy?: string;
  notes?: string;
}

interface ReleaseInput {
  orgId: string;
  version: string;
  name: string;
  environment: DeploymentEnvironment;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  releaseNotes?: string;
  changeSummary?: string;
  runbookId?: string;
  rollbackVersion?: string;
  scheduledFor?: string;
  approvedBy?: string;
  deployedAt?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  status?: ReleaseStatus;
}

interface OpsIncidentInput {
  orgId: string;
  title: string;
  severity: IncidentSeverity;
  source: IncidentSource;
  summary: string;
  deploymentId?: string;
  releaseId?: string;
  service?: string;
  impact?: string;
  runbookId?: string;
  ownerUserId?: string;
  commanderUserId?: string;
  detectedAt?: string;
  timeline?: Array<Record<string, unknown>>;
  customerUpdates?: Array<Record<string, unknown>>;
}

interface RunbookInput {
  orgId: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  ownerTeam?: string;
  severityScope?: string;
  repositoryPath?: string;
  tags?: string[];
  steps?: Array<Record<string, unknown>>;
  verification?: Array<Record<string, unknown>>;
  createdBy?: string;
}

interface TestSuiteInput {
  orgId: string;
  suiteType: TestSuiteType;
  name: string;
  targetEnvironment: DeploymentEnvironment;
  status?: TestSuiteStatus;
  score?: number;
  findings?: Array<Record<string, unknown>>;
  executedAt?: string;
}

function parseJsonArray(value: unknown): Array<Record<string, unknown>> {
  if (!value) return [];
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  try {
    return JSON.parse(String(value)) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

function parseStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    return JSON.parse(String(value)) as string[];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapRelease(row: Record<string, unknown>): ReleaseRecord {
  return {
    ...row,
    metadata: parseJsonObject(row.metadata),
  } as ReleaseRecord;
}

function mapIncident(row: Record<string, unknown>): OpsIncidentRecord {
  return {
    ...row,
    timeline: parseJsonArray(row.timeline),
    customer_updates: parseJsonArray(row.customer_updates),
  } as OpsIncidentRecord;
}

function mapRunbook(row: Record<string, unknown>): RunbookRecord {
  return {
    ...row,
    tags: parseStringArray(row.tags),
    steps: parseJsonArray(row.steps),
    verification: parseJsonArray(row.verification),
  } as RunbookRecord;
}

function mapTestSuite(row: Record<string, unknown>): OpsTestSuiteRecord {
  return {
    ...row,
    findings: parseJsonArray(row.findings),
  } as OpsTestSuiteRecord;
}

export function createRelease(input: ReleaseInput): ReleaseRecord {
  const id = randomUUID();
  const now = new Date().toISOString();
  run(
    `INSERT INTO ops_releases (
      id, org_id, version, name, status, environment, risk_level, release_notes, change_summary,
      runbook_id, rollback_version, scheduled_for, approved_by, deployed_at, created_by, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.version,
    input.name,
    input.status ?? 'draft',
    input.environment,
    input.riskLevel ?? 'medium',
    input.releaseNotes ?? null,
    input.changeSummary ?? null,
    input.runbookId ?? null,
    input.rollbackVersion ?? null,
    input.scheduledFor ?? null,
    input.approvedBy ?? null,
    input.deployedAt ?? null,
    input.createdBy ?? null,
    JSON.stringify(input.metadata ?? {}),
    now,
    now,
  );
  const release = getRelease(id)!;
  emitEvent('ops.release.created', release);
  return release;
}

export function updateRelease(id: string, patch: Partial<ReleaseInput> & { status?: ReleaseStatus }): ReleaseRecord | null {
  const current = getRelease(id);
  if (!current) return null;
  const next = {
    ...current,
    version: patch.version ?? current.version,
    name: patch.name ?? current.name,
    status: patch.status ?? current.status,
    environment: patch.environment ?? current.environment,
    risk_level: patch.riskLevel ?? current.risk_level,
    release_notes: patch.releaseNotes ?? current.release_notes,
    change_summary: patch.changeSummary ?? current.change_summary,
    runbook_id: patch.runbookId ?? current.runbook_id,
    rollback_version: patch.rollbackVersion ?? current.rollback_version,
    scheduled_for: patch.scheduledFor ?? current.scheduled_for,
    approved_by: patch.approvedBy ?? current.approved_by,
    deployed_at: patch.deployedAt ?? current.deployed_at,
    metadata: patch.metadata ?? current.metadata,
  };
  run(
    `UPDATE ops_releases
       SET version = ?, name = ?, status = ?, environment = ?, risk_level = ?, release_notes = ?, change_summary = ?,
           runbook_id = ?, rollback_version = ?, scheduled_for = ?, approved_by = ?, deployed_at = ?, metadata = ?, updated_at = ?
     WHERE id = ?`,
    next.version,
    next.name,
    next.status,
    next.environment,
    next.risk_level,
    next.release_notes,
    next.change_summary,
    next.runbook_id,
    next.rollback_version,
    next.scheduled_for,
    next.approved_by,
    next.deployed_at,
    JSON.stringify(next.metadata ?? {}),
    new Date().toISOString(),
    id,
  );
  const updated = getRelease(id)!;
  emitEvent('ops.release.updated', updated);
  return updated;
}

export function getRelease(id: string): ReleaseRecord | null {
  const row = get<Record<string, unknown>>('SELECT * FROM ops_releases WHERE id = ?', id);
  return row ? mapRelease(row) : null;
}

export function queryReleases(filter: { orgId?: string; environment?: DeploymentEnvironment; status?: ReleaseStatus } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) {
    conditions.push('org_id = ?');
    params.push(filter.orgId);
  }
  if (filter.environment) {
    conditions.push('environment = ?');
    params.push(filter.environment);
  }
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = all<Record<string, unknown>>(`SELECT * FROM ops_releases ${where} ORDER BY COALESCE(scheduled_for, created_at) DESC`, ...params);
  return rows.map(mapRelease);
}

export function createDeployment(input: DeploymentInput): DeploymentRecord {
  const id = randomUUID();
  const now = new Date().toISOString();
  run(
    `INSERT INTO ops_deployments (
      id, org_id, release_id, environment, status, version, strategy, rollback_version,
      change_window, approval_ticket, observability_dashboard, trace_id, initiated_by, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.releaseId ?? null,
    input.environment,
    'planned',
    input.version,
    input.strategy ?? 'blue-green',
    input.rollbackVersion ?? null,
    input.changeWindow ?? null,
    input.approvalTicket ?? null,
    input.observabilityDashboard ?? null,
    input.traceId ?? null,
    input.initiatedBy ?? null,
    input.notes ?? null,
    now,
    now,
  );
  const deployment = getDeployment(id)!;
  emitEvent('ops.deployment.created', deployment);
  return deployment;
}

export function updateDeploymentStatus(id: string, status: DeploymentStatus, patch?: { notes?: string; traceId?: string }): DeploymentRecord | null {
  const current = getDeployment(id);
  if (!current) return null;
  run(
    `UPDATE ops_deployments SET status = ?, notes = ?, trace_id = ?, updated_at = ? WHERE id = ?`,
    status,
    patch?.notes ?? current.notes,
    patch?.traceId ?? current.trace_id,
    new Date().toISOString(),
    id,
  );
  const deployment = getDeployment(id)!;
  if (deployment.release_id && status === 'succeeded') {
    updateRelease(deployment.release_id, { status: 'released', deployedAt: deployment.updated_at });
  }
  if (deployment.release_id && status === 'rolled_back') {
    updateRelease(deployment.release_id, { status: 'rolled_back' });
  }
  emitEvent(`ops.deployment.${status}`, deployment);
  return deployment;
}

export function getDeployment(id: string): DeploymentRecord | null {
  const row = get<DeploymentRecord>('SELECT * FROM ops_deployments WHERE id = ?', id);
  return row ?? null;
}

export function queryDeployments(filter: { orgId?: string; environment?: DeploymentEnvironment; status?: DeploymentStatus } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) {
    conditions.push('org_id = ?');
    params.push(filter.orgId);
  }
  if (filter.environment) {
    conditions.push('environment = ?');
    params.push(filter.environment);
  }
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return all<DeploymentRecord>(`SELECT * FROM ops_deployments ${where} ORDER BY created_at DESC`, ...params);
}

export function createRunbook(input: RunbookInput): RunbookRecord {
  const id = randomUUID();
  const now = new Date().toISOString();
  run(
    `INSERT INTO ops_runbooks (
      id, org_id, slug, title, category, summary, owner_team, severity_scope, status,
      repository_path, tags, steps, verification, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.slug,
    input.title,
    input.category,
    input.summary,
    input.ownerTeam ?? null,
    input.severityScope ?? null,
    input.repositoryPath ?? null,
    JSON.stringify(input.tags ?? []),
    JSON.stringify(input.steps ?? []),
    JSON.stringify(input.verification ?? []),
    input.createdBy ?? null,
    input.createdBy ?? null,
    now,
    now,
  );
  const runbook = getRunbook(id)!;
  emitEvent('ops.runbook.created', runbook);
  return runbook;
}

export function getRunbook(id: string): RunbookRecord | null {
  const row = get<Record<string, unknown>>('SELECT * FROM ops_runbooks WHERE id = ?', id);
  return row ? mapRunbook(row) : null;
}

export function queryRunbooks(filter: { orgId?: string; category?: string; status?: 'draft' | 'active' | 'archived' } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) {
    conditions.push('org_id = ?');
    params.push(filter.orgId);
  }
  if (filter.category) {
    conditions.push('category = ?');
    params.push(filter.category);
  }
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = all<Record<string, unknown>>(`SELECT * FROM ops_runbooks ${where} ORDER BY title ASC`, ...params);
  return rows.map(mapRunbook);
}

export function createOpsIncident(input: OpsIncidentInput): OpsIncidentRecord {
  const id = randomUUID();
  const now = new Date().toISOString();
  run(
    `INSERT INTO ops_incidents (
      id, org_id, deployment_id, release_id, title, severity, status, source, service, summary, impact,
      runbook_id, owner_user_id, commander_user_id, detected_at, resolved_at, timeline, customer_updates, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.deploymentId ?? null,
    input.releaseId ?? null,
    input.title,
    input.severity,
    input.source,
    input.service ?? null,
    input.summary,
    input.impact ?? null,
    input.runbookId ?? null,
    input.ownerUserId ?? null,
    input.commanderUserId ?? input.ownerUserId ?? null,
    input.detectedAt ?? now,
    JSON.stringify(input.timeline ?? [{ at: now, event: 'incident_opened', source: input.source }]),
    JSON.stringify(input.customerUpdates ?? []),
    now,
    now,
  );
  const incident = getOpsIncident(id)!;
  if (incident.owner_user_id) {
    createNotification({
      userId: incident.owner_user_id,
      title: `Incident ${incident.severity.toUpperCase()}: ${incident.title}`,
      body: incident.summary,
      type: 'system',
      link: `/api/incidents?domain=enterprise&id=${incident.id}`,
    });
  }
  emitEvent('ops.incident.created', incident);
  return incident;
}

export function updateOpsIncident(id: string, patch: Partial<OpsIncidentInput> & { status?: IncidentStatus; resolvedAt?: string }): OpsIncidentRecord | null {
  const current = getOpsIncident(id);
  if (!current) return null;
  const timeline = patch.timeline ?? current.timeline;
  const customerUpdates = patch.customerUpdates ?? current.customer_updates;
  run(
    `UPDATE ops_incidents
       SET title = ?, severity = ?, status = ?, source = ?, service = ?, summary = ?, impact = ?, runbook_id = ?,
           owner_user_id = ?, commander_user_id = ?, detected_at = ?, resolved_at = ?, timeline = ?, customer_updates = ?, updated_at = ?
     WHERE id = ?`,
    patch.title ?? current.title,
    patch.severity ?? current.severity,
    patch.status ?? current.status,
    patch.source ?? current.source,
    patch.service ?? current.service,
    patch.summary ?? current.summary,
    patch.impact ?? current.impact,
    patch.runbookId ?? current.runbook_id,
    patch.ownerUserId ?? current.owner_user_id,
    patch.commanderUserId ?? current.commander_user_id,
    patch.detectedAt ?? current.detected_at,
    patch.resolvedAt ?? current.resolved_at,
    JSON.stringify(timeline),
    JSON.stringify(customerUpdates),
    new Date().toISOString(),
    id,
  );
  const updated = getOpsIncident(id)!;
  emitEvent('ops.incident.updated', updated);
  return updated;
}

export function getOpsIncident(id: string): OpsIncidentRecord | null {
  const row = get<Record<string, unknown>>('SELECT * FROM ops_incidents WHERE id = ?', id);
  return row ? mapIncident(row) : null;
}

export function queryOpsIncidents(filter: { orgId?: string; severity?: IncidentSeverity; status?: IncidentStatus } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) {
    conditions.push('org_id = ?');
    params.push(filter.orgId);
  }
  if (filter.severity) {
    conditions.push('severity = ?');
    params.push(filter.severity);
  }
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = all<Record<string, unknown>>(`SELECT * FROM ops_incidents ${where} ORDER BY detected_at DESC`, ...params);
  return rows.map(mapIncident);
}

export function createOpsTestSuite(input: TestSuiteInput): OpsTestSuiteRecord {
  const id = randomUUID();
  run(
    `INSERT INTO ops_test_suites (id, org_id, suite_type, name, status, target_environment, score, findings, executed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.orgId,
    input.suiteType,
    input.name,
    input.status ?? 'queued',
    input.targetEnvironment,
    input.score ?? null,
    JSON.stringify(input.findings ?? []),
    input.executedAt ?? null,
  );
  return getOpsTestSuite(id)!;
}

export function getOpsTestSuite(id: string): OpsTestSuiteRecord | null {
  const row = get<Record<string, unknown>>('SELECT * FROM ops_test_suites WHERE id = ?', id);
  return row ? mapTestSuite(row) : null;
}

export function queryOpsTestSuites(filter: { orgId?: string; suiteType?: TestSuiteType } = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orgId) {
    conditions.push('org_id = ?');
    params.push(filter.orgId);
  }
  if (filter.suiteType) {
    conditions.push('suite_type = ?');
    params.push(filter.suiteType);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = all<Record<string, unknown>>(`SELECT * FROM ops_test_suites ${where} ORDER BY created_at DESC`, ...params);
  return rows.map(mapTestSuite);
}

export function getOpsOverview(orgId?: string) {
  const releases = queryReleases({ orgId });
  const deployments = queryDeployments({ orgId });
  const incidents = queryOpsIncidents({ orgId });
  const runbooks = queryRunbooks({ orgId, status: 'active' });
  const tests = queryOpsTestSuites({ orgId });

  return {
    releases,
    deployments,
    incidents,
    runbooks,
    tests,
    summary: {
      releaseApprovalQueue: releases.filter((item) => item.status === 'draft' || item.status === 'approved').length,
      liveIncidents: incidents.filter((item) => item.status !== 'resolved' && item.status !== 'closed').length,
      failedDeployments: deployments.filter((item) => item.status === 'failed' || item.status === 'rolled_back').length,
      activeRunbooks: runbooks.length,
      lastRegressionScore: tests.find((item) => item.suite_type === 'regression')?.score ?? null,
      securityFindings: tests
        .filter((item) => item.suite_type === 'security')
        .flatMap((item) => item.findings)
        .filter((finding) => String(finding.severity ?? '').length > 0).length,
    },
    observability: {
      dashboards: [
        { id: 'atlas-release-health', title: 'Release Health', url: '/observability/dashboards/release-health.json' },
        { id: 'atlas-service-map', title: 'Service Map', url: '/observability/dashboards/service-map.json' },
      ],
      alerts: [
        { id: 'deploy-error-budget', name: 'Deployment Error Budget Burn', threshold: '5% in 15m', route: 'on-call-platform' },
        { id: 'api-p95', name: 'API p95 Latency', threshold: '>900ms for 10m', route: 'sre-war-room' },
      ],
      tracing: {
        provider: 'OpenTelemetry',
        exporters: ['otlp-http', 'console'],
      },
    },
    security: {
      dependencyPolicy: 'pnpm audit + osv-scanner + CodeQL',
      secretsRotationCadence: '30d production / 7d break-glass',
      supplyChainControls: ['SBOM generation', 'lockfile drift checks', 'signed release manifests'],
    },
  };
}
