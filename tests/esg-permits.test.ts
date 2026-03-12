import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initDb, run } from '@/lib/db';
import {
  createCommunityCase,
  createIncident,
  createObligation,
  createPermit,
  createReportPack,
  createStakeholderMetric,
  getESGDashboard,
  getIncidentDashboard,
  getPermitDashboard,
  listReportEvidence,
  queryCaseActions,
  updateCaseAction,
  updateCommunityCase,
  updateObligation,
  updatePermit,
} from '@/lib/esg/service';
import { getUserNotifications } from '@/lib/services/notifications';

beforeAll(() => {
  initDb();
  for (const uid of ['user-esg-1', 'user-esg-2']) {
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

beforeEach(() => {
  for (const table of [
    'report_evidence_items',
    'report_packs',
    'case_actions',
    'esg_incidents',
    'community_cases',
    'obligations',
    'permits',
    'stakeholder_metrics',
    'notifications',
  ]) {
    run(`DELETE FROM ${table}`);
  }
});

describe('Module 9 ESG and permitting services', () => {
  it('tracks permit expiry and obligation status with alert summaries', () => {
    const permit = createPermit({
      orgId: 'org-esg',
      workspaceId: 'ws-esg',
      portfolioId: 'pf-esg',
      title: 'Exploration permit',
      permitNumber: 'EP-001',
      permitType: 'exploration',
      authority: 'Mines Authority',
      expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      alertDays: 30,
      ownerUserId: 'user-esg-1',
      createdBy: 'user-esg-1',
    });

    const obligation = createObligation({
      orgId: 'org-esg',
      workspaceId: 'ws-esg',
      portfolioId: 'pf-esg',
      permitId: permit.id,
      title: 'File renewal annex',
      obligationType: 'permit',
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      ownerUserId: 'user-esg-1',
      createdBy: 'user-esg-1',
    });

    expect(permit.status).toBe('expiring');
    expect(obligation.status).toBe('overdue');

    const dashboard = getPermitDashboard({ orgId: 'org-esg' });
    expect(dashboard.alerts.expiringPermits).toBe(1);
    expect(dashboard.alerts.overdueObligations).toBe(1);

    const notifications = getUserNotifications('user-esg-1');
    expect(notifications.data.some((item) => item.type === 'permit_expiry')).toBe(true);
    expect(notifications.data.some((item) => item.type === 'obligation_overdue')).toBe(true);

    const updatedPermit = updatePermit(permit.id, { expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() });
    const updatedObligation = updateObligation(obligation.id, { status: 'completed' });
    expect(updatedPermit?.status).toBe('expired');
    expect(updatedObligation?.status).toBe('completed');
  });

  it('manages sensitive community cases and overdue actions', () => {
    const communityCase = createCommunityCase({
      orgId: 'org-esg',
      workspaceId: 'ws-esg',
      portfolioId: 'pf-esg',
      caseType: 'grievance',
      sensitivity: 'restricted',
      stakeholderName: 'Host community council',
      summary: 'Compensation grievance raised during site visit',
      ownerUserId: 'user-esg-2',
      createdBy: 'user-esg-1',
    });

    expect(communityCase.status).toBe('escalated');
    expect(communityCase.escalation_level).toBe('executive');

    const action = queryCaseActions({ orgId: 'org-esg' }).data[0] ?? null;
    expect(action).toBeNull();

    const createdAction = updateCommunityCase(communityCase.id, { status: 'action_required' });
    expect(createdAction?.status).toBe('action_required');

    const followUp = updateCaseAction(
      createIncident({
        orgId: 'org-esg',
        workspaceId: 'ws-esg',
        portfolioId: 'pf-esg',
        category: 'social',
        severity: 'high',
        title: 'Community blockade at access road',
        description: 'Temporary road blockade linked to unresolved grievance.',
        ownerUserId: 'user-esg-2',
        createdBy: 'user-esg-1',
      }).id,
      { status: 'completed' },
    );

    expect(followUp).toBeNull();

    const notifications = getUserNotifications('user-esg-2');
    expect(notifications.data.some((item) => item.type === 'community_sensitive_case')).toBe(true);
  });

  it('records escalated incidents, corrective actions, reporting packs, and metrics', () => {
    const incident = createIncident({
      orgId: 'org-esg',
      workspaceId: 'ws-esg',
      portfolioId: 'pf-esg',
      category: 'environmental',
      severity: 'critical',
      title: 'Tailings seepage alarm',
      description: 'Monitoring station detected abnormal seepage readings.',
      ownerUserId: 'user-esg-1',
      createdBy: 'user-esg-2',
    });

    expect(incident.status).toBe('escalated');
    expect(incident.escalation_level).toBe('regulatory');

    const incidentActions = queryCaseActions({ orgId: 'org-esg', targetType: 'incident' });
    expect(incidentActions.total).toBe(1);
    expect(incidentActions.data[0].priority).toBe('critical');

    createStakeholderMetric({
      orgId: 'org-esg',
      workspaceId: 'ws-esg',
      portfolioId: 'pf-esg',
      metricType: 'local_content',
      metricKey: 'local_procurement_share',
      metricValue: 38,
      unit: '%',
      recordedBy: 'user-esg-1',
    });

    createStakeholderMetric({
      orgId: 'org-esg',
      workspaceId: 'ws-esg',
      portfolioId: 'pf-esg',
      metricType: 'stakeholder_engagement',
      metricKey: 'engagement_sessions',
      metricValue: 6,
      unit: 'sessions',
      recordedBy: 'user-esg-1',
    });

    const reportPack = createReportPack({
      orgId: 'org-esg',
      workspaceId: 'ws-esg',
      portfolioId: 'pf-esg',
      packType: 'incident_pack',
      title: 'Critical incident evidence pack',
      generatedBy: 'user-esg-1',
      evidenceItems: [
        {
          sourceType: 'incident',
          sourceId: incident.id,
          title: 'Incident timeline',
          evidenceUrl: '/evidence/incident-timeline',
          citation: 'Incident log 01',
          tags: ['critical', 'timeline'],
        },
      ],
    });

    expect(reportPack.pack.template_sections).toContain('incident-timeline');
    expect(listReportEvidence(reportPack.pack.id)).toHaveLength(1);

    const esg = getESGDashboard({ orgId: 'org-esg' });
    const incidents = getIncidentDashboard({ orgId: 'org-esg' });

    expect(esg.metrics.summary['local_content:local_procurement_share']).toBe(38);
    expect(esg.metrics.summary['stakeholder_engagement:engagement_sessions']).toBe(6);
    expect(esg.reportPacks.total).toBe(1);
    expect(incidents.alerts.criticalIncidents).toBe(1);
  });
});
