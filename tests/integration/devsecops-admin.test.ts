/**
 * Integration Tests: DevSecOps, Admin Console, and Enterprise Operations
 * 
 * Tests Module 12 (DevSecOps), admin operations, and cross-module integrations.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, initDb, run, get, all } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { writeAuditLog, queryAuditLogs } from '@/lib/services/audit';
import { createNotification, getUserNotifications } from '@/lib/services/notifications';
import { randomUUID } from 'node:crypto';

const testOrg = { id: randomUUID(), name: 'Platform Operations' };

const testUsers = {
  platformAdmin: { id: randomUUID(), email: 'platform@atlas.test' },
  releaseManager: { id: randomUUID(), email: 'release@atlas.test' },
  sre: { id: randomUUID(), email: 'sre@atlas.test' },
  securityEngineer: { id: randomUUID(), email: 'security@atlas.test' }
};

beforeAll(async () => {
  initDb();

  const hash = await hashPassword('Password123!');
  for (const [role, user] of Object.entries(testUsers)) {
    run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      user.id, user.email, hash, `${role} User`
    );
  }
});

afterAll(() => {
  closeDb();
});

describe('Runbook Management', () => {
  let runbookId: string;

  it('step 1: creates operational runbook', () => {
    runbookId = randomUUID();

    run(
      `INSERT INTO ops_runbooks (id, org_id, slug, title, category, summary, owner_team,
       severity_scope, status, repository_path, tags, steps, verification, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      runbookId, testOrg.id,
      'database-failover',
      'Database Failover Procedure',
      'disaster-recovery',
      'Step-by-step guide for database failover to DR site',
      'Platform Engineering',
      'sev1,sev2',
      'active',
      'docs/runbooks/database-failover.md',
      JSON.stringify(['database', 'failover', 'dr', 'postgres']),
      JSON.stringify([
        { order: 1, title: 'Verify DR replica sync status', command: 'pg_replication_status.sh' },
        { order: 2, title: 'Initiate failover', command: 'pg_failover.sh --target=dr' },
        { order: 3, title: 'Update DNS records', command: 'dns_update.sh --zone=db' },
        { order: 4, title: 'Verify application connectivity', command: 'health_check.sh --all' }
      ]),
      JSON.stringify([
        'All application health checks pass',
        'Database write operations successful',
        'Monitoring alerts cleared'
      ]),
      testUsers.sre.id
    );

    const runbook = get<{ title: string; category: string }>(
      'SELECT title, category FROM ops_runbooks WHERE id = ?',
      runbookId
    );

    expect(runbook?.title).toBe('Database Failover Procedure');
    expect(runbook?.category).toBe('disaster-recovery');
  });

  it('step 2: creates multiple runbooks by category', () => {
    const runbooks = [
      { slug: 'incident-response', title: 'Incident Response', category: 'incident-management' },
      { slug: 'scale-up', title: 'Horizontal Scale-Up', category: 'capacity' },
      { slug: 'security-breach', title: 'Security Breach Response', category: 'security' }
    ];

    for (const rb of runbooks) {
      run(
        `INSERT INTO ops_runbooks (id, org_id, slug, title, category, summary, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), testOrg.id, rb.slug, rb.title, rb.category,
        `Runbook for ${rb.title.toLowerCase()}`, 'active', testUsers.sre.id
      );
    }

    const allRunbooks = all<{ category: string }>(
      'SELECT category FROM ops_runbooks WHERE org_id = ?',
      testOrg.id
    );

    expect(allRunbooks.length).toBe(4);
    expect(new Set(allRunbooks.map(r => r.category)).size).toBe(4);
  });

  it('step 3: searches runbooks by tag', () => {
    const dbRunbooks = all<{ title: string; tags: string }>(
      `SELECT title, tags FROM ops_runbooks WHERE org_id = ? AND tags LIKE ?`,
      testOrg.id, '%database%'
    );

    expect(dbRunbooks.length).toBeGreaterThanOrEqual(1);
  });

  it('step 4: archives outdated runbook', () => {
    run(
      `UPDATE ops_runbooks SET status = 'archived', updated_by = ? WHERE id = ?`,
      testUsers.sre.id, runbookId
    );

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.sre.id,
      action: 'runbook.archived',
      resourceType: 'ops_runbook',
      resourceId: runbookId,
      details: { reason: 'Superseded by automated failover' },
      ip: '10.0.0.1'
    });

    const archived = get<{ status: string }>(
      'SELECT status FROM ops_runbooks WHERE id = ?',
      runbookId
    );

    expect(archived?.status).toBe('archived');
  });
});

describe('Release Management', () => {
  let releaseId: string;
  let runbookId: string;

  beforeAll(() => {
    runbookId = randomUUID();
    run(
      `INSERT INTO ops_runbooks (id, org_id, slug, title, category, summary, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      runbookId, testOrg.id, 'deploy-prod', 'Production Deployment', 'deployment',
      'Standard production deployment procedure', 'active', testUsers.releaseManager.id
    );
  });

  it('step 1: creates release with approval workflow', () => {
    releaseId = randomUUID();

    run(
      `INSERT INTO ops_releases (id, org_id, version, name, status, environment, risk_level,
       release_notes, change_summary, runbook_id, rollback_version, scheduled_for, created_by, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      releaseId, testOrg.id,
      'v2.5.0',
      'March Feature Release',
      'draft',
      'production',
      'medium',
      '## Changes\n- New bankability scoring algorithm\n- UI improvements\n- Bug fixes',
      'Feature: ATLAS-1234, ATLAS-1235\nBugfix: ATLAS-1240',
      runbookId,
      'v2.4.3',
      '2026-03-20T02:00:00.000Z',
      testUsers.releaseManager.id,
      JSON.stringify({ 
        changeTickets: ['ATLAS-1234', 'ATLAS-1235', 'ATLAS-1240'],
        testCoverage: 92.5,
        securityScan: 'passed'
      })
    );

    const release = get<{ version: string; status: string }>(
      'SELECT version, status FROM ops_releases WHERE id = ?',
      releaseId
    );

    expect(release?.version).toBe('v2.5.0');
    expect(release?.status).toBe('draft');
  });

  it('step 2: approves release', () => {
    run(
      `UPDATE ops_releases SET status = 'approved', approved_by = ? WHERE id = ?`,
      testUsers.platformAdmin.id, releaseId
    );

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.platformAdmin.id,
      action: 'release.approved',
      resourceType: 'ops_release',
      resourceId: releaseId,
      details: { version: 'v2.5.0', environment: 'production' },
      ip: '10.0.0.1'
    });

    const release = get<{ status: string; approved_by: string }>(
      'SELECT status, approved_by FROM ops_releases WHERE id = ?',
      releaseId
    );

    expect(release?.status).toBe('approved');
    expect(release?.approved_by).toBe(testUsers.platformAdmin.id);
  });

  it('step 3: schedules release', () => {
    run(
      `UPDATE ops_releases SET status = 'scheduled' WHERE id = ?`,
      releaseId
    );

    // Notify stakeholders
    createNotification({
      userId: testUsers.sre.id,
      type: 'system',
      title: 'Release Scheduled',
      body: 'v2.5.0 scheduled for production deployment at 2026-03-20 02:00 UTC',
      link: `/releases/${releaseId}`
    });

    const release = get<{ status: string }>(
      'SELECT status FROM ops_releases WHERE id = ?',
      releaseId
    );

    expect(release?.status).toBe('scheduled');
  });

  it('step 4: marks release as deployed', () => {
    run(
      `UPDATE ops_releases SET status = 'released', deployed_at = ? WHERE id = ?`,
      new Date().toISOString(), releaseId
    );

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.releaseManager.id,
      action: 'release.deployed',
      resourceType: 'ops_release',
      resourceId: releaseId,
      details: { version: 'v2.5.0', environment: 'production', duration: '12 minutes' },
      ip: '10.0.0.1'
    });

    const release = get<{ status: string; deployed_at: string }>(
      'SELECT status, deployed_at FROM ops_releases WHERE id = ?',
      releaseId
    );

    expect(release?.status).toBe('released');
    expect(release?.deployed_at).toBeTruthy();
  });

  it('step 5: queries release history', () => {
    const releases = all<{ version: string; status: string }>(
      `SELECT version, status FROM ops_releases WHERE org_id = ? ORDER BY created_at DESC`,
      testOrg.id
    );

    expect(releases.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Deployment Tracking', () => {
  let deploymentId: string;
  let releaseId: string;

  beforeAll(() => {
    releaseId = randomUUID();
    run(
      `INSERT INTO ops_releases (id, org_id, version, name, status, environment, risk_level, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      releaseId, testOrg.id, 'v2.5.1', 'Hotfix Release', 'approved', 'production', 'low',
      testUsers.releaseManager.id
    );
  });

  it('step 1: creates deployment plan', () => {
    deploymentId = randomUUID();

    run(
      `INSERT INTO ops_deployments (id, org_id, release_id, environment, status, version,
       strategy, rollback_version, change_window, approval_ticket, initiated_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      deploymentId, testOrg.id, releaseId,
      'production',
      'planned',
      'v2.5.1',
      'blue-green',
      'v2.5.0',
      '2026-03-21T02:00:00Z to 2026-03-21T04:00:00Z',
      'CHG-2026-0321',
      testUsers.releaseManager.id,
      'Hotfix for critical bankability calculation bug'
    );

    const deployment = get<{ status: string; strategy: string }>(
      'SELECT status, strategy FROM ops_deployments WHERE id = ?',
      deploymentId
    );

    expect(deployment?.status).toBe('planned');
    expect(deployment?.strategy).toBe('blue-green');
  });

  it('step 2: starts deployment', () => {
    run(
      `UPDATE ops_deployments SET status = 'running', trace_id = ? WHERE id = ?`,
      'trace-abc123', deploymentId
    );

    const deployment = get<{ status: string; trace_id: string }>(
      'SELECT status, trace_id FROM ops_deployments WHERE id = ?',
      deploymentId
    );

    expect(deployment?.status).toBe('running');
    expect(deployment?.trace_id).toBe('trace-abc123');
  });

  it('step 3: deployment succeeds', () => {
    run(
      `UPDATE ops_deployments SET status = 'succeeded', observability_dashboard = ? WHERE id = ?`,
      'https://grafana.atlas.dev/d/deploy-v251', deploymentId
    );

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.releaseManager.id,
      action: 'deployment.succeeded',
      resourceType: 'ops_deployment',
      resourceId: deploymentId,
      details: { version: 'v2.5.1', duration: '8 minutes', environment: 'production' },
      ip: '10.0.0.1'
    });

    const deployment = get<{ status: string }>(
      'SELECT status FROM ops_deployments WHERE id = ?',
      deploymentId
    );

    expect(deployment?.status).toBe('succeeded');
  });

  it('step 4: simulates rollback scenario', () => {
    const failedDeployId = randomUUID();

    run(
      `INSERT INTO ops_deployments (id, org_id, environment, status, version, rollback_version, initiated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      failedDeployId, testOrg.id, 'production', 'failed', 'v2.5.2', 'v2.5.1',
      testUsers.releaseManager.id
    );

    run(
      `UPDATE ops_deployments SET status = 'rolled_back', notes = ? WHERE id = ?`,
      'Rollback initiated due to elevated error rate', failedDeployId
    );

    const rolledBack = get<{ status: string }>(
      'SELECT status FROM ops_deployments WHERE id = ?',
      failedDeployId
    );

    expect(rolledBack?.status).toBe('rolled_back');
  });
});

describe('Enterprise Incident Management', () => {
  let incidentId: string;
  let runbookId: string;

  beforeAll(() => {
    runbookId = randomUUID();
    run(
      `INSERT INTO ops_runbooks (id, org_id, slug, title, category, summary, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      runbookId, testOrg.id, 'api-outage', 'API Outage Response', 'incident-management',
      'Response procedure for API availability issues', 'active', testUsers.sre.id
    );
  });

  it('step 1: creates platform incident', () => {
    incidentId = randomUUID();

    run(
      `INSERT INTO ops_incidents (id, org_id, title, severity, status, source, service,
       summary, impact, runbook_id, owner_user_id, detected_at, timeline, customer_updates)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      incidentId, testOrg.id,
      'API Latency Degradation',
      'sev2',
      'open',
      'monitoring',
      'api-gateway',
      'Elevated p99 latency detected on API gateway',
      'Approximately 15% of API requests experiencing >500ms latency',
      runbookId,
      testUsers.sre.id,
      new Date().toISOString(),
      JSON.stringify([
        { time: new Date().toISOString(), event: 'Alert triggered', actor: 'monitoring' }
      ]),
      JSON.stringify([])
    );

    const incident = get<{ severity: string; status: string }>(
      'SELECT severity, status FROM ops_incidents WHERE id = ?',
      incidentId
    );

    expect(incident?.severity).toBe('sev2');
    expect(incident?.status).toBe('open');
  });

  it('step 2: assigns incident commander', () => {
    run(
      `UPDATE ops_incidents SET commander_user_id = ?, status = 'triaged' WHERE id = ?`,
      testUsers.platformAdmin.id, incidentId
    );

    const incident = get<{ commander_user_id: string; status: string }>(
      'SELECT commander_user_id, status FROM ops_incidents WHERE id = ?',
      incidentId
    );

    expect(incident?.commander_user_id).toBe(testUsers.platformAdmin.id);
    expect(incident?.status).toBe('triaged');
  });

  it('step 3: adds timeline entries', () => {
    const incident = get<{ timeline: string }>(
      'SELECT timeline FROM ops_incidents WHERE id = ?',
      incidentId
    );

    const timeline = JSON.parse(incident?.timeline || '[]');
    timeline.push(
      { time: new Date().toISOString(), event: 'Incident commander assigned', actor: testUsers.platformAdmin.id },
      { time: new Date().toISOString(), event: 'Root cause identified: Database connection pool exhaustion', actor: testUsers.sre.id }
    );

    run(
      `UPDATE ops_incidents SET timeline = ?, status = 'mitigating' WHERE id = ?`,
      JSON.stringify(timeline), incidentId
    );

    const updated = get<{ timeline: string }>(
      'SELECT timeline FROM ops_incidents WHERE id = ?',
      incidentId
    );

    expect(JSON.parse(updated?.timeline || '[]').length).toBe(3);
  });

  it('step 4: posts customer update', () => {
    const incident = get<{ customer_updates: string }>(
      'SELECT customer_updates FROM ops_incidents WHERE id = ?',
      incidentId
    );

    const updates = JSON.parse(incident?.customer_updates || '[]');
    updates.push({
      time: new Date().toISOString(),
      message: 'We are aware of elevated latency affecting some API calls. Our team is actively working on resolution.',
      author: testUsers.platformAdmin.id
    });

    run(
      `UPDATE ops_incidents SET customer_updates = ? WHERE id = ?`,
      JSON.stringify(updates), incidentId
    );

    const updated = get<{ customer_updates: string }>(
      'SELECT customer_updates FROM ops_incidents WHERE id = ?',
      incidentId
    );

    expect(JSON.parse(updated?.customer_updates || '[]').length).toBe(1);
  });

  it('step 5: resolves incident', () => {
    run(
      `UPDATE ops_incidents SET status = 'resolved', resolved_at = ? WHERE id = ?`,
      new Date().toISOString(), incidentId
    );

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.sre.id,
      action: 'incident.resolved',
      resourceType: 'ops_incident',
      resourceId: incidentId,
      details: { severity: 'sev2', duration: '45 minutes', rootCause: 'Connection pool exhaustion' },
      ip: '10.0.0.1'
    });

    const incident = get<{ status: string; resolved_at: string }>(
      'SELECT status, resolved_at FROM ops_incidents WHERE id = ?',
      incidentId
    );

    expect(incident?.status).toBe('resolved');
    expect(incident?.resolved_at).toBeTruthy();
  });
});

describe('Test Suite Management', () => {
  it('step 1: creates regression test suite', () => {
    const suiteId = randomUUID();

    run(
      `INSERT INTO ops_test_suites (id, org_id, suite_type, name, status, target_environment,
       score, findings, executed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      suiteId, testOrg.id,
      'regression',
      'Core API Regression Suite',
      'passed',
      'staging',
      98.5,
      JSON.stringify([
        { type: 'skipped', count: 2, reason: 'Feature flagged off' }
      ]),
      new Date().toISOString()
    );

    const suite = get<{ suite_type: string; score: number }>(
      'SELECT suite_type, score FROM ops_test_suites WHERE id = ?',
      suiteId
    );

    expect(suite?.suite_type).toBe('regression');
    expect(suite?.score).toBe(98.5);
  });

  it('step 2: creates performance test suite', () => {
    const suiteId = randomUUID();

    run(
      `INSERT INTO ops_test_suites (id, org_id, suite_type, name, status, target_environment,
       score, findings, executed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      suiteId, testOrg.id,
      'performance',
      'Load Test - 10K Users',
      'passed',
      'staging',
      95.0,
      JSON.stringify([
        { metric: 'p99_latency', value: 250, threshold: 500, status: 'pass' },
        { metric: 'error_rate', value: 0.02, threshold: 1.0, status: 'pass' },
        { metric: 'throughput', value: 5000, threshold: 4000, status: 'pass' }
      ]),
      new Date().toISOString()
    );

    const suite = get<{ findings: string }>(
      'SELECT findings FROM ops_test_suites WHERE id = ?',
      suiteId
    );

    const findings = JSON.parse(suite?.findings || '[]');
    expect(findings.every((f: { status: string }) => f.status === 'pass')).toBe(true);
  });

  it('step 3: creates security scan suite', () => {
    const suiteId = randomUUID();

    run(
      `INSERT INTO ops_test_suites (id, org_id, suite_type, name, status, target_environment,
       score, findings, executed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      suiteId, testOrg.id,
      'security',
      'SAST/DAST Security Scan',
      'failed',
      'staging',
      72.0,
      JSON.stringify([
        { severity: 'high', type: 'SQL Injection', count: 0 },
        { severity: 'medium', type: 'XSS', count: 2, locations: ['api/search', 'api/comments'] },
        { severity: 'low', type: 'Info Disclosure', count: 5 }
      ]),
      new Date().toISOString()
    );

    const suite = get<{ status: string; score: number }>(
      'SELECT status, score FROM ops_test_suites WHERE id = ?',
      suiteId
    );

    expect(suite?.status).toBe('failed');
    expect(suite?.score).toBeLessThan(80);
  });

  it('step 4: queries test suites by type', () => {
    const securitySuites = all<{ name: string }>(
      `SELECT name FROM ops_test_suites WHERE org_id = ? AND suite_type = 'security'`,
      testOrg.id
    );

    expect(securitySuites.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Secret Rotation Tracking', () => {
  it('step 1: creates secret rotation schedule', () => {
    const secrets = [
      { name: 'database_password', env: 'production', interval: 30 },
      { name: 'api_key_stripe', env: 'production', interval: 90 },
      { name: 'jwt_signing_key', env: 'production', interval: 180 }
    ];

    for (const s of secrets) {
      const nextDue = new Date(Date.now() + s.interval * 24 * 60 * 60 * 1000).toISOString();
      
      run(
        `INSERT INTO ops_secret_rotations (id, org_id, secret_name, environment, owner_team,
         rotation_interval_days, next_due_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), testOrg.id,
        s.name, s.env, 'Platform Security',
        s.interval, nextDue, 'scheduled'
      );
    }

    const rotations = all<{ secret_name: string }>(
      `SELECT secret_name FROM ops_secret_rotations WHERE org_id = ?`,
      testOrg.id
    );

    expect(rotations.length).toBe(3);
  });

  it('step 2: identifies due rotations', () => {
    // Add an overdue rotation
    const overdueId = randomUUID();
    const pastDue = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    run(
      `INSERT INTO ops_secret_rotations (id, org_id, secret_name, environment,
       rotation_interval_days, next_due_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      overdueId, testOrg.id,
      'legacy_api_key', 'production',
      30, pastDue, 'overdue'
    );

    const overdueRotations = all<{ secret_name: string }>(
      `SELECT secret_name FROM ops_secret_rotations WHERE org_id = ? AND status = 'overdue'`,
      testOrg.id
    );

    expect(overdueRotations.length).toBeGreaterThanOrEqual(1);
  });

  it('step 3: completes secret rotation', () => {
    const rotations = all<{ id: string }>(
      `SELECT id FROM ops_secret_rotations WHERE org_id = ? LIMIT 1`,
      testOrg.id
    );

    const rotationId = rotations[0].id;
    const nextDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    run(
      `UPDATE ops_secret_rotations SET status = 'rotated', last_rotated_at = ?, next_due_at = ? WHERE id = ?`,
      new Date().toISOString(), nextDue, rotationId
    );

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.securityEngineer.id,
      action: 'secret.rotated',
      resourceType: 'ops_secret_rotation',
      resourceId: rotationId,
      details: { environment: 'production' },
      ip: '10.0.0.1'
    });

    const rotation = get<{ status: string; last_rotated_at: string }>(
      'SELECT status, last_rotated_at FROM ops_secret_rotations WHERE id = ?',
      rotationId
    );

    expect(rotation?.status).toBe('rotated');
    expect(rotation?.last_rotated_at).toBeTruthy();
  });
});

describe('Admin Console Operations', () => {
  it('step 1: queries comprehensive audit log', () => {
    // Generate various audit events
    const actions = ['user.login', 'org.create', 'workspace.create', 'document.upload', 'release.approved'];
    
    for (const action of actions) {
      writeAuditLog({
        orgId: testOrg.id,
        userId: testUsers.platformAdmin.id,
        action,
        resourceType: action.split('.')[0],
        ip: '10.0.0.1'
      });
    }

    const logs = queryAuditLogs({ orgId: testOrg.id });
    expect(logs.total).toBeGreaterThanOrEqual(5);
  });

  it('step 2: filters audit log by action', () => {
    const loginLogs = queryAuditLogs({ orgId: testOrg.id, action: 'user.login' });
    
    expect(loginLogs.data.every(l => l.action === 'user.login')).toBe(true);
  });

  it('step 3: filters audit log by user', () => {
    const userLogs = queryAuditLogs({ userId: testUsers.platformAdmin.id });
    
    expect(userLogs.data.every(l => l.user_id === testUsers.platformAdmin.id)).toBe(true);
  });

  it('step 4: filters audit log by date range', () => {
    const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const logs = queryAuditLogs({ orgId: testOrg.id, from: fromDate });
    
    expect(logs.total).toBeGreaterThanOrEqual(1);
    logs.data.forEach(log => {
      expect(new Date(log.created_at).getTime()).toBeGreaterThanOrEqual(new Date(fromDate).getTime());
    });
  });

  it('step 5: generates admin notifications', () => {
    // Create various admin notifications
    const notifications = [
      { type: 'security', title: 'New login from unknown device', userId: testUsers.platformAdmin.id },
      { type: 'system', title: 'Database backup completed', userId: testUsers.sre.id },
      { type: 'alert', title: 'Certificate expiring in 30 days', userId: testUsers.securityEngineer.id }
    ];

    for (const n of notifications) {
      createNotification({
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: `Admin notification: ${n.title}`
      });
    }

    const adminNotifs = getUserNotifications(testUsers.platformAdmin.id);
    expect(adminNotifs.total).toBeGreaterThanOrEqual(1);
  });
});

describe('Cross-Module Integration: Release to Incident Flow', () => {
  it('complete flow: release → deployment → incident → resolution', () => {
    // 1. Create release
    const releaseId = randomUUID();
    run(
      `INSERT INTO ops_releases (id, org_id, version, name, status, environment, risk_level, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      releaseId, testOrg.id, 'v2.6.0', 'Integration Test Release', 'approved', 'production', 'medium',
      testUsers.releaseManager.id
    );

    // 2. Create deployment
    const deploymentId = randomUUID();
    run(
      `INSERT INTO ops_deployments (id, org_id, release_id, environment, status, version, initiated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      deploymentId, testOrg.id, releaseId, 'production', 'succeeded', 'v2.6.0',
      testUsers.releaseManager.id
    );

    // 3. Incident occurs post-deployment
    const incidentId = randomUUID();
    run(
      `INSERT INTO ops_incidents (id, org_id, deployment_id, release_id, title, severity, status,
       source, summary, detected_at, timeline, customer_updates)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      incidentId, testOrg.id, deploymentId, releaseId,
      'Post-deployment Error Rate Spike',
      'sev2',
      'open',
      'deployment',
      'Error rate increased from 0.1% to 2% after v2.6.0 deployment',
      new Date().toISOString(),
      JSON.stringify([{ time: new Date().toISOString(), event: 'Incident created from deployment monitoring' }]),
      JSON.stringify([])
    );

    // 4. Verify linkage
    const incident = get<{ deployment_id: string; release_id: string }>(
      'SELECT deployment_id, release_id FROM ops_incidents WHERE id = ?',
      incidentId
    );

    expect(incident?.deployment_id).toBe(deploymentId);
    expect(incident?.release_id).toBe(releaseId);

    // 5. Rollback deployment
    run(
      `UPDATE ops_deployments SET status = 'rolled_back' WHERE id = ?`,
      deploymentId
    );

    // 6. Resolve incident
    run(
      `UPDATE ops_incidents SET status = 'resolved', resolved_at = ? WHERE id = ?`,
      new Date().toISOString(), incidentId
    );

    // 7. Verify final states
    const finalDeployment = get<{ status: string }>(
      'SELECT status FROM ops_deployments WHERE id = ?',
      deploymentId
    );
    const finalIncident = get<{ status: string }>(
      'SELECT status FROM ops_incidents WHERE id = ?',
      incidentId
    );

    expect(finalDeployment?.status).toBe('rolled_back');
    expect(finalIncident?.status).toBe('resolved');
  });
});
