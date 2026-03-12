/**
 * Integration Tests: ESG, Permits, and Execution Workflows
 * 
 * Tests Module 9 (ESG/Permitting) and Module 7 (Execution Digital Twin)
 * covering regulatory compliance, community engagement, and project controls.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, initDb, run, get, all } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { writeAuditLog, queryAuditLogs } from '@/lib/services/audit';
import { createNotification } from '@/lib/services/notifications';
import { createTask, updateTask, queryTasks } from '@/lib/services/tasks';
import { randomUUID } from 'node:crypto';

const testOrg = { id: randomUUID(), name: 'Energy Project Co' };
const testWorkspace = { id: randomUUID(), name: 'Solar Farm Alpha' };
const testPortfolio = { id: randomUUID(), name: 'Solar Alpha Portfolio' };

const testUsers = {
  projectManager: { id: randomUUID(), email: 'pm@atlas.test' },
  esgOfficer: { id: randomUUID(), email: 'esg@atlas.test' },
  siteManager: { id: randomUUID(), email: 'site@atlas.test' },
  communityLiaison: { id: randomUUID(), email: 'community@atlas.test' }
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

describe('Permit Register Management', () => {
  let permitId: string;

  it('step 1: creates an environmental permit', () => {
    permitId = randomUUID();

    run(
      `INSERT INTO permits (id, org_id, workspace_id, portfolio_id, title, permit_number, permit_type, 
       authority, jurisdiction, status, risk_level, issue_date, expiry_date, alert_days, owner_user_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      permitId, testOrg.id, testWorkspace.id, testPortfolio.id,
      'Environmental Impact Assessment',
      'EIA-2026-001',
      'environmental',
      'Environmental Protection Agency',
      'California',
      'active',
      'medium',
      '2025-06-15',
      '2028-06-15',
      90,
      testUsers.esgOfficer.id,
      testUsers.projectManager.id
    );

    const permit = get<{ title: string; status: string }>(
      'SELECT title, status FROM permits WHERE id = ?',
      permitId
    );

    expect(permit?.title).toBe('Environmental Impact Assessment');
    expect(permit?.status).toBe('active');
  });

  it('step 2: creates multiple permits with different types', () => {
    const permits = [
      { title: 'Building Permit', number: 'BP-2026-001', type: 'construction', authority: 'City Planning' },
      { title: 'Grid Connection License', number: 'GC-2026-001', type: 'utility', authority: 'Grid Operator' },
      { title: 'Water Discharge Permit', number: 'WD-2026-001', type: 'environmental', authority: 'Water Board' }
    ];

    for (const p of permits) {
      run(
        `INSERT INTO permits (id, org_id, workspace_id, title, permit_number, permit_type, 
         authority, status, risk_level, expiry_date, owner_user_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), testOrg.id, testWorkspace.id,
        p.title, p.number, p.type, p.authority,
        'active', 'low', '2027-12-31',
        testUsers.esgOfficer.id, testUsers.projectManager.id
      );
    }

    const allPermits = all<{ permit_type: string }>(
      'SELECT permit_type FROM permits WHERE org_id = ?',
      testOrg.id
    );

    expect(allPermits.length).toBe(4);
    expect(new Set(allPermits.map(p => p.permit_type)).size).toBe(3);
  });

  it('step 3: identifies expiring permits', () => {
    // Add a permit that will expire soon
    const expiringPermitId = randomUUID();
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    run(
      `INSERT INTO permits (id, org_id, title, permit_number, permit_type, authority, 
       status, risk_level, expiry_date, alert_days, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      expiringPermitId, testOrg.id,
      'Soon Expiring Permit', 'SE-2026-001', 'operational', 'Authority',
      'expiring', 'high', expiryDate, 60,
      testUsers.projectManager.id
    );

    const expiringPermits = all<{ title: string; status: string }>(
      `SELECT title, status FROM permits WHERE org_id = ? AND status = 'expiring'`,
      testOrg.id
    );

    expect(expiringPermits.length).toBeGreaterThanOrEqual(1);
  });

  it('step 4: links evidence to permit', () => {
    const evidenceLinks = JSON.stringify([
      'evidence://eia-report-v2',
      'evidence://public-consultation-summary',
      'evidence://mitigation-plan'
    ]);

    run(
      'UPDATE permits SET evidence_links = ? WHERE id = ?',
      evidenceLinks, permitId
    );

    const permit = get<{ evidence_links: string }>(
      'SELECT evidence_links FROM permits WHERE id = ?',
      permitId
    );

    const links = JSON.parse(permit?.evidence_links || '[]');
    expect(links.length).toBe(3);
  });

  it('step 5: creates audit log for permit status change', () => {
    run(
      `UPDATE permits SET status = 'renewal_in_progress' WHERE id = ?`,
      permitId
    );

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.esgOfficer.id,
      action: 'permit.status_change',
      resourceType: 'permit',
      resourceId: permitId,
      details: { from: 'active', to: 'renewal_in_progress' },
      ip: '10.0.0.1'
    });

    const logs = queryAuditLogs({ orgId: testOrg.id, action: 'permit.status_change' });
    expect(logs.total).toBeGreaterThanOrEqual(1);
  });
});

describe('Obligations and Commitments Tracking', () => {
  let permitId: string;
  let obligationId: string;

  beforeAll(() => {
    permitId = randomUUID();
    run(
      `INSERT INTO permits (id, org_id, title, permit_number, permit_type, authority, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      permitId, testOrg.id, 'Operating License', 'OL-2026-001', 'operational', 'Energy Regulator', 'active',
      testUsers.projectManager.id
    );
  });

  it('step 1: creates permit-linked obligation', () => {
    obligationId = randomUUID();

    run(
      `INSERT INTO obligations (id, org_id, workspace_id, permit_id, title, obligation_type, 
       source_reference, status, priority, due_date, owner_user_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      obligationId, testOrg.id, testWorkspace.id, permitId,
      'Quarterly emissions report submission',
      'permit',
      'OL-2026-001, Section 4.2',
      'open',
      'high',
      '2026-03-31',
      testUsers.esgOfficer.id,
      testUsers.projectManager.id
    );

    const obligation = get<{ title: string; permit_id: string }>(
      'SELECT title, permit_id FROM obligations WHERE id = ?',
      obligationId
    );

    expect(obligation?.title).toContain('emissions report');
    expect(obligation?.permit_id).toBe(permitId);
  });

  it('step 2: creates ESG commitment obligations', () => {
    const commitments = [
      { title: 'Net zero emissions by 2030', type: 'esg', priority: 'high' },
      { title: 'Local workforce 70% target', type: 'local_content', priority: 'medium' },
      { title: 'Community fund contribution', type: 'community', priority: 'medium' }
    ];

    for (const c of commitments) {
      run(
        `INSERT INTO obligations (id, org_id, title, obligation_type, status, priority, owner_user_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), testOrg.id, c.title, c.type, 'open', c.priority,
        testUsers.esgOfficer.id, testUsers.projectManager.id
      );
    }

    const esgObligations = all<{ obligation_type: string }>(
      `SELECT obligation_type FROM obligations WHERE org_id = ? AND obligation_type IN ('esg', 'local_content', 'community')`,
      testOrg.id
    );

    expect(esgObligations.length).toBe(3);
  });

  it('step 3: completes obligation with evidence', () => {
    const completedAt = new Date().toISOString();
    const evidenceLinks = JSON.stringify(['evidence://emissions-report-q1-2026']);

    run(
      `UPDATE obligations SET status = 'completed', completed_at = ?, evidence_links = ? WHERE id = ?`,
      completedAt, evidenceLinks, obligationId
    );

    const obligation = get<{ status: string; completed_at: string }>(
      'SELECT status, completed_at FROM obligations WHERE id = ?',
      obligationId
    );

    expect(obligation?.status).toBe('completed');
    expect(obligation?.completed_at).toBeTruthy();
  });

  it('step 4: identifies overdue obligations', () => {
    const overdueId = randomUUID();
    const pastDueDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    run(
      `INSERT INTO obligations (id, org_id, title, obligation_type, status, priority, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      overdueId, testOrg.id, 'Late Safety Inspection', 'regulatory', 'overdue', 'critical', pastDueDate,
      testUsers.projectManager.id
    );

    const overdueObligations = all<{ title: string }>(
      `SELECT title FROM obligations WHERE org_id = ? AND status = 'overdue'`,
      testOrg.id
    );

    expect(overdueObligations.length).toBeGreaterThanOrEqual(1);
  });

  it('step 5: creates notification for upcoming due date', () => {
    createNotification({
      userId: testUsers.esgOfficer.id,
      type: 'alert',
      title: 'Obligation Due Soon',
      body: 'Quarterly emissions report due in 7 days',
      link: `/obligations/${obligationId}`
    });
  });
});

describe('Community Cases and Grievances', () => {
  let caseId: string;

  it('step 1: logs a community grievance', () => {
    caseId = randomUUID();

    run(
      `INSERT INTO community_cases (id, org_id, workspace_id, case_type, sensitivity, status,
       stakeholder_name, stakeholder_group, location, channel, summary, details,
       received_at, owner_user_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      caseId, testOrg.id, testWorkspace.id,
      'grievance',
      'standard',
      'open',
      'John Smith',
      'Local Residents Association',
      'Village A',
      'email',
      'Noise complaint during construction hours',
      'Resident reports excessive noise from 6am-7am before permitted hours.',
      new Date().toISOString(),
      testUsers.communityLiaison.id,
      testUsers.communityLiaison.id
    );

    const grievance = get<{ case_type: string; status: string }>(
      'SELECT case_type, status FROM community_cases WHERE id = ?',
      caseId
    );

    expect(grievance?.case_type).toBe('grievance');
    expect(grievance?.status).toBe('open');
  });

  it('step 2: escalates sensitive case', () => {
    const sensitiveCaseId = randomUUID();

    run(
      `INSERT INTO community_cases (id, org_id, case_type, sensitivity, status,
       stakeholder_name, stakeholder_group, summary, escalation_level, 
       confidential_notes, owner_user_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sensitiveCaseId, testOrg.id,
      'grievance',
      'sensitive',
      'escalated',
      'Anonymous',
      'Indigenous Community',
      'Cultural heritage site concern',
      'executive',
      'Involves sacred site. Requires CEO involvement.',
      testUsers.communityLiaison.id,
      testUsers.communityLiaison.id
    );

    const sensitiveCase = get<{ sensitivity: string; escalation_level: string }>(
      'SELECT sensitivity, escalation_level FROM community_cases WHERE id = ?',
      sensitiveCaseId
    );

    expect(sensitiveCase?.sensitivity).toBe('sensitive');
    expect(sensitiveCase?.escalation_level).toBe('executive');
  });

  it('step 3: creates engagement record', () => {
    const engagementId = randomUUID();

    run(
      `INSERT INTO community_cases (id, org_id, case_type, sensitivity, status,
       stakeholder_name, stakeholder_group, summary, owner_user_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      engagementId, testOrg.id,
      'engagement',
      'standard',
      'resolved',
      'Maria Garcia',
      'Local Business Council',
      'Partnership discussion for local procurement',
      testUsers.communityLiaison.id,
      testUsers.communityLiaison.id
    );

    const engagements = all<{ case_type: string }>(
      `SELECT case_type FROM community_cases WHERE org_id = ? AND case_type = 'engagement'`,
      testOrg.id
    );

    expect(engagements.length).toBeGreaterThanOrEqual(1);
  });

  it('step 4: resolves grievance with action', () => {
    // Create corrective action
    const actionId = randomUUID();
    run(
      `INSERT INTO case_actions (id, org_id, target_type, target_id, title, description,
       status, priority, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      actionId, testOrg.id,
      'community_case', caseId,
      'Adjust construction start time',
      'Move construction start to 7:30am to comply with permit hours',
      'completed',
      'high',
      testUsers.siteManager.id,
      testUsers.communityLiaison.id
    );

    // Update case status
    run(
      `UPDATE community_cases SET status = 'resolved' WHERE id = ?`,
      caseId
    );

    const resolvedCase = get<{ status: string }>(
      'SELECT status FROM community_cases WHERE id = ?',
      caseId
    );

    expect(resolvedCase?.status).toBe('resolved');
  });

  it('step 5: queries cases by stakeholder group', () => {
    const cases = all<{ stakeholder_group: string }>(
      `SELECT stakeholder_group FROM community_cases WHERE org_id = ?`,
      testOrg.id
    );

    const groups = new Set(cases.map(c => c.stakeholder_group));
    expect(groups.size).toBeGreaterThanOrEqual(2);
  });
});

describe('ESG Incidents and Response', () => {
  let incidentId: string;

  it('step 1: creates environmental incident', () => {
    incidentId = randomUUID();

    run(
      `INSERT INTO esg_incidents (id, org_id, workspace_id, category, severity, status,
       title, description, occurred_at, reported_at, owner_user_id, 
       escalation_level, immediate_actions, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      incidentId, testOrg.id, testWorkspace.id,
      'environmental',
      'medium',
      'investigating',
      'Minor fuel spill at equipment yard',
      'Approximately 20L diesel spill during refueling. Contained immediately.',
      new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString(),
      testUsers.siteManager.id,
      'internal',
      'Spill contained with absorbent materials. Area cordoned off.',
      testUsers.siteManager.id
    );

    const incident = get<{ category: string; severity: string }>(
      'SELECT category, severity FROM esg_incidents WHERE id = ?',
      incidentId
    );

    expect(incident?.category).toBe('environmental');
    expect(incident?.severity).toBe('medium');
  });

  it('step 2: creates high-severity safety incident with regulator notification', () => {
    const safetyIncidentId = randomUUID();

    run(
      `INSERT INTO esg_incidents (id, org_id, category, severity, status,
       title, description, reported_at, owner_user_id, 
       escalation_level, regulator_notified, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      safetyIncidentId, testOrg.id,
      'safety',
      'high',
      'investigating',
      'Near-miss incident at construction site',
      'Unsecured load fell from crane. No injuries. Investigation underway.',
      new Date().toISOString(),
      testUsers.siteManager.id,
      'regulatory',
      1,
      testUsers.siteManager.id
    );

    const incident = get<{ regulator_notified: number; escalation_level: string }>(
      'SELECT regulator_notified, escalation_level FROM esg_incidents WHERE id = ?',
      safetyIncidentId
    );

    expect(incident?.regulator_notified).toBe(1);
    expect(incident?.escalation_level).toBe('regulatory');
  });

  it('step 3: creates corrective action for incident', () => {
    const actionId = randomUUID();

    run(
      `INSERT INTO case_actions (id, org_id, target_type, target_id, title, description,
       status, priority, due_at, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      actionId, testOrg.id,
      'incident', incidentId,
      'Implement secondary containment',
      'Install secondary containment system at all refueling stations',
      'in_progress',
      'high',
      '2026-04-15T17:00:00.000Z',
      testUsers.siteManager.id,
      testUsers.esgOfficer.id
    );

    const action = get<{ target_type: string; target_id: string }>(
      'SELECT target_type, target_id FROM case_actions WHERE id = ?',
      actionId
    );

    expect(action?.target_type).toBe('incident');
    expect(action?.target_id).toBe(incidentId);
  });

  it('step 4: closes incident with resolution', () => {
    run(
      `UPDATE esg_incidents SET status = 'closed' WHERE id = ?`,
      incidentId
    );

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.esgOfficer.id,
      action: 'incident.closed',
      resourceType: 'esg_incident',
      resourceId: incidentId,
      details: { 
        resolution: 'Cleanup completed. Root cause addressed.',
        daysToResolve: 5 
      },
      ip: '10.0.0.1'
    });

    const logs = queryAuditLogs({ orgId: testOrg.id, action: 'incident.closed' });
    expect(logs.total).toBeGreaterThanOrEqual(1);
  });

  it('step 5: queries incidents by severity and category', () => {
    const environmentalIncidents = all<{ category: string }>(
      `SELECT category FROM esg_incidents WHERE org_id = ? AND category = 'environmental'`,
      testOrg.id
    );

    const highSeverity = all<{ severity: string }>(
      `SELECT severity FROM esg_incidents WHERE org_id = ? AND severity IN ('high', 'critical')`,
      testOrg.id
    );

    expect(environmentalIncidents.length).toBeGreaterThanOrEqual(1);
    expect(highSeverity.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Report Packs and Evidence Bundles', () => {
  let reportPackId: string;

  it('step 1: creates regulatory report pack', () => {
    reportPackId = randomUUID();

    run(
      `INSERT INTO report_packs (id, org_id, workspace_id, pack_type, title, status,
       period_start, period_end, generated_by, template_sections)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      reportPackId, testOrg.id, testWorkspace.id,
      'regulatory_report',
      'Q1 2026 Environmental Compliance Report',
      'draft',
      '2026-01-01',
      '2026-03-31',
      testUsers.esgOfficer.id,
      JSON.stringify([
        { name: 'Executive Summary', required: true },
        { name: 'Permit Status', required: true },
        { name: 'Emissions Data', required: true },
        { name: 'Incidents', required: true },
        { name: 'Corrective Actions', required: false }
      ])
    );

    const pack = get<{ pack_type: string; status: string }>(
      'SELECT pack_type, status FROM report_packs WHERE id = ?',
      reportPackId
    );

    expect(pack?.pack_type).toBe('regulatory_report');
    expect(pack?.status).toBe('draft');
  });

  it('step 2: adds evidence items to report pack', () => {
    const evidenceItems = [
      { type: 'permit', title: 'Environmental Permit Status', citation: 'EIA-2026-001' },
      { type: 'document', title: 'Emissions Monitoring Data', citation: 'Q1 Emissions Report' },
      { type: 'incident', title: 'Incident Summary', citation: 'Q1 Incident Log' }
    ];

    for (const item of evidenceItems) {
      run(
        `INSERT INTO report_evidence_items (id, report_pack_id, source_type, title, citation, tags)
         VALUES (?, ?, ?, ?, ?, ?)`,
        randomUUID(), reportPackId,
        item.type, item.title, item.citation,
        JSON.stringify(['compliance', 'q1-2026'])
      );
    }

    const items = all<{ source_type: string }>(
      'SELECT source_type FROM report_evidence_items WHERE report_pack_id = ?',
      reportPackId
    );

    expect(items.length).toBe(3);
  });

  it('step 3: updates pack status to ready', () => {
    const packageSummary = JSON.stringify({
      permitCount: 4,
      obligationsMet: 12,
      obligationsPending: 3,
      incidentCount: 2,
      criticalIncidents: 0
    });

    run(
      `UPDATE report_packs SET status = 'ready', package_summary = ? WHERE id = ?`,
      packageSummary, reportPackId
    );

    const pack = get<{ status: string; package_summary: string }>(
      'SELECT status, package_summary FROM report_packs WHERE id = ?',
      reportPackId
    );

    expect(pack?.status).toBe('ready');
    const summary = JSON.parse(pack?.package_summary || '{}');
    expect(summary.permitCount).toBe(4);
  });

  it('step 4: submits report pack', () => {
    run(
      `UPDATE report_packs SET status = 'submitted', submitted_at = ? WHERE id = ?`,
      new Date().toISOString(), reportPackId
    );

    writeAuditLog({
      orgId: testOrg.id,
      userId: testUsers.esgOfficer.id,
      action: 'report.submitted',
      resourceType: 'report_pack',
      resourceId: reportPackId,
      details: { packType: 'regulatory_report', period: 'Q1 2026' },
      ip: '10.0.0.1'
    });

    const pack = get<{ status: string; submitted_at: string }>(
      'SELECT status, submitted_at FROM report_packs WHERE id = ?',
      reportPackId
    );

    expect(pack?.status).toBe('submitted');
    expect(pack?.submitted_at).toBeTruthy();
  });
});

describe('Stakeholder Metrics Tracking', () => {
  it('step 1: records local content metrics', () => {
    const metrics = [
      { key: 'local_workforce_percentage', value: 72.5, unit: 'percent' },
      { key: 'local_procurement_spend', value: 15000000, unit: 'USD' },
      { key: 'local_subcontractor_count', value: 45, unit: 'count' }
    ];

    for (const m of metrics) {
      run(
        `INSERT INTO stakeholder_metrics (id, org_id, workspace_id, metric_type, metric_key,
         metric_value, unit, period_start, period_end, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), testOrg.id, testWorkspace.id,
        'local_content',
        m.key, m.value, m.unit,
        '2026-01-01', '2026-03-31',
        testUsers.esgOfficer.id
      );
    }

    const localContentMetrics = all<{ metric_key: string; metric_value: number }>(
      `SELECT metric_key, metric_value FROM stakeholder_metrics 
       WHERE org_id = ? AND metric_type = 'local_content'`,
      testOrg.id
    );

    expect(localContentMetrics.length).toBe(3);
    const workforce = localContentMetrics.find(m => m.metric_key === 'local_workforce_percentage');
    expect(workforce?.metric_value).toBe(72.5);
  });

  it('step 2: records stakeholder engagement metrics', () => {
    const metrics = [
      { key: 'community_meetings_held', value: 12, unit: 'count' },
      { key: 'stakeholder_queries_resolved', value: 45, unit: 'count' },
      { key: 'satisfaction_score', value: 4.2, unit: 'rating' }
    ];

    for (const m of metrics) {
      run(
        `INSERT INTO stakeholder_metrics (id, org_id, metric_type, metric_key,
         metric_value, unit, period_start, period_end, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(), testOrg.id,
        'stakeholder_engagement',
        m.key, m.value, m.unit,
        '2026-01-01', '2026-03-31',
        testUsers.communityLiaison.id
      );
    }

    const engagementMetrics = all<{ metric_key: string }>(
      `SELECT metric_key FROM stakeholder_metrics 
       WHERE org_id = ? AND metric_type = 'stakeholder_engagement'`,
      testOrg.id
    );

    expect(engagementMetrics.length).toBe(3);
  });

  it('step 3: tracks metrics over time periods', () => {
    // Add Q2 metrics
    run(
      `INSERT INTO stakeholder_metrics (id, org_id, metric_type, metric_key,
       metric_value, unit, period_start, period_end, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(), testOrg.id,
      'local_content',
      'local_workforce_percentage', 75.0, 'percent',
      '2026-04-01', '2026-06-30',
      testUsers.esgOfficer.id
    );

    const workforceMetrics = all<{ metric_value: number; period_end: string }>(
      `SELECT metric_value, period_end FROM stakeholder_metrics 
       WHERE org_id = ? AND metric_key = 'local_workforce_percentage'
       ORDER BY period_end`,
      testOrg.id
    );

    expect(workforceMetrics.length).toBe(2);
    expect(workforceMetrics[1].metric_value).toBeGreaterThan(workforceMetrics[0].metric_value);
  });
});

describe('Execution Digital Twin - Milestone Tracking', () => {
  it('step 1: creates project milestones', () => {
    const milestones = [
      { title: 'Site Preparation Complete', status: 'completed', dueDate: '2026-02-28' },
      { title: 'Foundation Work Complete', status: 'in_progress', dueDate: '2026-04-15' },
      { title: 'Equipment Installation', status: 'pending', dueDate: '2026-06-30' },
      { title: 'Grid Connection', status: 'pending', dueDate: '2026-08-15' },
      { title: 'Commercial Operation Date', status: 'pending', dueDate: '2026-09-01' }
    ];

    for (const m of milestones) {
      const task = createTask({
        orgId: testOrg.id,
        title: m.title,
        status: m.status === 'completed' ? 'completed' : (m.status === 'in_progress' ? 'in_progress' : 'pending'),
        priority: 'high',
        dueDate: m.dueDate,
        createdBy: testUsers.projectManager.id,
        assignedTo: testUsers.siteManager.id
      });

      expect(task.id).toBeTruthy();
    }

    const projectTasks = queryTasks({ orgId: testOrg.id, priority: 'high' });
    expect(projectTasks.total).toBeGreaterThanOrEqual(5);
  });

  it('step 2: tracks milestone completion', () => {
    const completedTasks = queryTasks({ orgId: testOrg.id, status: 'completed' });
    const inProgressTasks = queryTasks({ orgId: testOrg.id, status: 'in_progress' });
    const pendingTasks = queryTasks({ orgId: testOrg.id, status: 'pending' });

    const totalMilestones = completedTasks.total + inProgressTasks.total + pendingTasks.total;
    const completionRate = (completedTasks.total / totalMilestones) * 100;

    expect(completionRate).toBeGreaterThanOrEqual(0);
    expect(completionRate).toBeLessThanOrEqual(100);
  });

  it('step 3: creates field issue', () => {
    const issueTask = createTask({
      orgId: testOrg.id,
      title: 'RFI: Foundation design clarification',
      description: 'Need clarification on foundation depth for soft soil condition in Zone C',
      status: 'pending',
      priority: 'urgent',
      createdBy: testUsers.siteManager.id,
      assignedTo: testUsers.projectManager.id
    });

    expect(issueTask.id).toBeTruthy();
    expect(issueTask.priority).toBe('urgent');
  });

  it('step 4: updates task with resolution', () => {
    const urgentTasks = queryTasks({ orgId: testOrg.id, priority: 'urgent', status: 'pending' });
    
    if (urgentTasks.data.length > 0) {
      const updated = updateTask(urgentTasks.data[0].id, {
        status: 'completed',
        description: urgentTasks.data[0].description + '\n\nResolution: Increase depth to 2.5m per geotechnical recommendation.'
      });

      expect(updated?.status).toBe('completed');
      expect(updated?.completed_at).toBeTruthy();
    }
  });

  it('step 5: generates milestone report', () => {
    const allTasks = queryTasks({ orgId: testOrg.id });
    const byStatus = {
      completed: allTasks.data.filter(t => t.status === 'completed').length,
      inProgress: allTasks.data.filter(t => t.status === 'in_progress').length,
      pending: allTasks.data.filter(t => t.status === 'pending').length
    };

    const report = {
      totalMilestones: allTasks.total,
      completed: byStatus.completed,
      inProgress: byStatus.inProgress,
      pending: byStatus.pending,
      completionPercentage: Math.round((byStatus.completed / allTasks.total) * 100),
      generatedAt: new Date().toISOString()
    };

    expect(report.totalMilestones).toBeGreaterThan(0);
    expect(report.completionPercentage).toBeGreaterThanOrEqual(0);
  });
});
