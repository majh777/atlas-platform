import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, initDb, run } from '@/lib/db';
import {
  createDeployment,
  createOpsIncident,
  createOpsTestSuite,
  createRelease,
  createRunbook,
  getOpsOverview,
  queryDeployments,
  queryOpsIncidents,
  queryOpsTestSuites,
  queryReleases,
  queryRunbooks,
  updateDeploymentStatus,
  updateOpsIncident,
  updateRelease,
} from '@/lib/ops/service';
import { getUserNotifications } from '@/lib/services/notifications';

beforeAll(() => {
  initDb();
  for (const uid of ['ops-admin', 'oncall-user']) {
    run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      uid,
      `${uid}@atlas.dev`,
      'hash',
      uid,
    );
  }
});

afterAll(() => {
  closeDb();
});

describe('Module 12 DevSecOps + enterprise ops', () => {
  it('creates runbooks, releases, deployments, and updates rollback-aware status', () => {
    const runbook = createRunbook({
      orgId: 'org-ops',
      slug: 'rollback-prod',
      title: 'Rollback production deployment',
      category: 'deployment',
      summary: 'Rollback procedure for failed prod deploys.',
      repositoryPath: 'docs/runbooks/deployment-rollback.md',
      tags: ['rollback', 'production'],
      createdBy: 'ops-admin',
      steps: [{ order: 1, action: 'Assess blast radius' }],
      verification: [{ order: 1, action: 'Validate p95 recovery' }],
    });

    const release = createRelease({
      orgId: 'org-ops',
      version: '2026.03.12.1',
      name: 'Module 12 rollout',
      environment: 'production',
      riskLevel: 'high',
      rollbackVersion: '2026.03.11.4',
      runbookId: runbook.id,
      createdBy: 'ops-admin',
      metadata: { pipeline: 'atlas-release' },
      status: 'approved',
    });

    const deployment = createDeployment({
      orgId: 'org-ops',
      releaseId: release.id,
      environment: 'production',
      version: release.version,
      rollbackVersion: release.rollback_version ?? undefined,
      observabilityDashboard: '/observability/dashboards/release-health.json',
      initiatedBy: 'ops-admin',
      traceId: 'trace-prod-123',
    });

    const running = updateDeploymentStatus(deployment.id, 'running');
    expect(running?.status).toBe('running');

    const rolledBack = updateDeploymentStatus(deployment.id, 'rolled_back', { notes: 'p95 breached after deploy' });
    expect(rolledBack?.status).toBe('rolled_back');

    const updatedRelease = queryReleases({ orgId: 'org-ops' }).find((item) => item.id === release.id);
    expect(updatedRelease?.status).toBe('rolled_back');
    expect(queryRunbooks({ orgId: 'org-ops' })[0].repository_path).toContain('docs/runbooks');
    expect(queryDeployments({ orgId: 'org-ops' })[0].rollback_version).toBe('2026.03.11.4');
  });

  it('opens enterprise incidents with notifications and runbook linkage', () => {
    const runbook = createRunbook({
      orgId: 'org-ops',
      slug: 'sev1-commander',
      title: 'SEV1 command',
      category: 'incident',
      summary: 'Coordinate mitigations and stakeholder communications.',
      repositoryPath: 'docs/runbooks/sev1-incident.md',
      createdBy: 'ops-admin',
    });

    const incident = createOpsIncident({
      orgId: 'org-ops',
      title: 'Production API saturation',
      severity: 'sev1',
      source: 'monitoring',
      summary: 'p95 latency over 2.1s and error rate exceeded 8%.',
      service: 'api',
      runbookId: runbook.id,
      ownerUserId: 'oncall-user',
    });

    expect(incident.runbook_id).toBe(runbook.id);
    expect(queryOpsIncidents({ orgId: 'org-ops' }).some((item) => item.id === incident.id)).toBe(true);

    const notifications = getUserNotifications('oncall-user');
    expect(notifications.data.some((item) => item.title.includes('Incident SEV1'))).toBe(true);

    const resolved = updateOpsIncident(incident.id, {
      status: 'resolved',
      resolvedAt: '2026-03-12T13:00:00.000Z',
      customerUpdates: [{ at: '2026-03-12T12:45:00.000Z', message: 'Mitigation deployed' }],
    });
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.customer_updates).toHaveLength(1);
  });

  it('tracks automated regression, resilience, performance, and security suites in the ops overview', () => {
    createOpsTestSuite({
      orgId: 'org-ops',
      suiteType: 'regression',
      name: 'Critical underwriting flows',
      targetEnvironment: 'staging',
      status: 'passed',
      score: 97,
      findings: [],
      executedAt: '2026-03-12T08:00:00.000Z',
    });
    createOpsTestSuite({
      orgId: 'org-ops',
      suiteType: 'performance',
      name: 'API soak test',
      targetEnvironment: 'staging',
      status: 'passed',
      score: 91,
      findings: [{ severity: 'medium', detail: 'p95 near threshold under 5x load' }],
      executedAt: '2026-03-12T08:30:00.000Z',
    });
    createOpsTestSuite({
      orgId: 'org-ops',
      suiteType: 'resilience',
      name: 'Chaos failover drill',
      targetEnvironment: 'dr',
      status: 'passed',
      score: 95,
      findings: [{ severity: 'low', detail: 'Read replica promotion took 17 seconds' }],
      executedAt: '2026-03-12T09:00:00.000Z',
    });
    createOpsTestSuite({
      orgId: 'org-ops',
      suiteType: 'security',
      name: 'Supply-chain scan',
      targetEnvironment: 'production',
      status: 'failed',
      score: 72,
      findings: [{ severity: 'high', detail: 'Rotate npm token and update vulnerable transitive package' }],
      executedAt: '2026-03-12T09:30:00.000Z',
    });

    const suites = queryOpsTestSuites({ orgId: 'org-ops' });
    expect(suites).toHaveLength(4);
    expect(suites.some((suite) => suite.suite_type === 'resilience')).toBe(true);

    const release = createRelease({
      orgId: 'org-ops',
      version: '2026.03.12.2',
      name: 'Observability marker patch',
      environment: 'staging',
      status: 'scheduled',
    });
    updateRelease(release.id, { status: 'released', deployedAt: '2026-03-12T10:00:00.000Z' });

    const overview = getOpsOverview('org-ops');
    expect(overview.summary.lastRegressionScore).toBe(97);
    expect(overview.summary.securityFindings).toBeGreaterThanOrEqual(1);
    expect(overview.observability.tracing.provider).toBe('OpenTelemetry');
    expect(overview.security.supplyChainControls).toContain('SBOM generation');
  });
});
