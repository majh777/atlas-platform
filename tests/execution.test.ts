import { beforeEach, describe, expect, it } from 'vitest';
import { GET as executionRoute, POST as executionPost } from '@/app/api/execution/route';
import { GET as milestonesGet, PATCH as milestonesPatch, POST as milestonesPost } from '@/app/api/milestones/route';
import { GET as issuesGet, PATCH as issuesPatch, POST as issuesPost } from '@/app/api/issues/route';
import { computeBudgetSnapshot, computeVarianceAnalysis } from '@/lib/execution/cost-control';
import { getExecutionTwin } from '@/lib/execution/service';
import { resetExecutionStore } from '@/lib/execution/store';

beforeEach(() => {
  resetExecutionStore();
});

describe('execution digital twin', () => {
  it('computes budget and variance metrics from work packages', () => {
    const twin = getExecutionTwin();
    const budget = computeBudgetSnapshot(twin.workPackages);
    const variance = computeVarianceAnalysis(twin.workPackages, budget, twin.procurement, twin.issues);

    expect(budget.approvedBudgetUsd).toBeGreaterThan(300_000_000);
    expect(budget.currentForecastUsd).toBeGreaterThan(budget.approvedBudgetUsd);
    expect(variance.longLeadDelayedCount).toBe(1);
    expect(variance.criticalIssuesOpen).toBe(1);
  });

  it('returns execution overview from the API', async () => {
    const response = await executionRoute();
    const json = await response.json();

    expect(json.project.name).toContain('Atlas');
    expect(json.workPackages.length).toBeGreaterThanOrEqual(3);
    expect(json.changeOrders.length).toBeGreaterThanOrEqual(2);
  });

  it('creates and updates milestones through the API', async () => {
    const createResponse = await milestonesPost(new Request('http://localhost/api/milestones', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Wet commissioning window opened',
        workPackageId: 'wp-port-01',
        owner: 'Commissioning manager',
        baselineDate: new Date().toISOString(),
        forecastDate: new Date().toISOString(),
        status: 'planned',
        critical: true,
        dependencies: ['pre-energisation'],
        completion: 0,
      }),
      headers: { 'content-type': 'application/json' },
    }));
    const created = await createResponse.json();
    expect(createResponse.status).toBe(201);

    const updateResponse = await milestonesPatch(new Request('http://localhost/api/milestones', {
      method: 'PATCH',
      body: JSON.stringify({ id: created.milestone.id, status: 'in_progress', completion: 35 }),
      headers: { 'content-type': 'application/json' },
    }));
    const updated = await updateResponse.json();
    expect(updated.milestone.status).toBe('in_progress');
    expect(updated.milestone.completion).toBe(35);

    const listResponse = await milestonesGet(new Request('http://localhost/api/milestones?status=in_progress'));
    const listed = await listResponse.json();
    expect(listed.milestones.some((item: { id: string }) => item.id === created.milestone.id)).toBe(true);
  });

  it('supports mobile-friendly issue logging and closeout', async () => {
    const response = await issuesPost(new Request('http://localhost/api/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Pump skid grouting punch-list',
        category: 'punch_list',
        workPackageId: 'wp-civ-01',
        location: 'Area B / Skid 04',
        priority: 'medium',
        status: 'open',
        assignee: 'Area supervisor',
        reportedBy: 'iPhone field app',
        description: 'Final grout touch-up required before handover.',
        mobileCaptured: true,
      }),
      headers: { 'content-type': 'application/json' },
    }));
    const created = await response.json();
    expect(response.status).toBe(201);
    expect(created.issue.mobileCaptured).toBe(true);

    const patch = await issuesPatch(new Request('http://localhost/api/issues', {
      method: 'PATCH',
      body: JSON.stringify({ id: created.issue.id, status: 'closed' }),
      headers: { 'content-type': 'application/json' },
    }));
    const updated = await patch.json();
    expect(updated.issue.status).toBe('closed');

    const listResponse = await issuesGet(new Request('http://localhost/api/issues?category=punch_list'));
    const listed = await listResponse.json();
    expect(listed.issues.some((item: { id: string }) => item.id === created.issue.id)).toBe(true);
  });

  it('advances change-order workflow via execution API', async () => {
    const create = await executionPost(new Request('http://localhost/api/execution', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Additional drainage trenching',
        contractor: 'PanCorr Civil',
        workPackageId: 'wp-civ-01',
        status: 'draft',
        requestedCostUsd: 900_000,
        approvedCostUsd: 0,
        scheduleImpactDays: 3,
        reason: 'Unexpected runoff control works required in wet season.',
        approvers: ['Project controls lead'],
        initialComment: 'Raised by site team.',
      }),
      headers: { 'content-type': 'application/json' },
    }));
    const created = await create.json();
    expect(create.status).toBe(201);

    const advance = await executionPost(new Request('http://localhost/api/execution', {
      method: 'POST',
      body: JSON.stringify({
        action: 'advanceChangeOrder',
        id: created.changeOrder.id,
        status: 'approved',
        comment: 'Approved to protect drainage resilience.',
      }),
      headers: { 'content-type': 'application/json' },
    }));
    const updated = await advance.json();
    expect(updated.changeOrder.status).toBe('approved');
    expect(updated.changeOrder.approvedCostUsd).toBe(900_000);
    expect(updated.changeOrder.history.at(-1).comment).toContain('Approved');
  });
});
