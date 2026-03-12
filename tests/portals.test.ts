import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getDashboards } from '@/app/api/dashboards/route';
import { GET as getPortals, POST as postPortals } from '@/app/api/portals/route';
import { GET as getReports, POST as postReports } from '@/app/api/reports/route';
import { generateReport, getDashboardBundle, getPortalSummary, listPortals } from '@/lib/portals/store';

describe('portal store', () => {
  it('lists role-aware portals and summaries', () => {
    const investorPortals = listPortals('investor');
    expect(investorPortals).toHaveLength(1);
    expect(investorPortals[0].workspace.theme.whiteLabel).toBe(true);

    const summary = getPortalSummary();
    expect(summary.totalPortals).toBeGreaterThanOrEqual(3);
    expect(summary.whiteLabelWorkspaces).toBeGreaterThanOrEqual(1);
  });

  it('builds cached dashboard bundles with controlled evidence', () => {
    const first = getDashboardBundle('executive');
    const second = getDashboardBundle('executive');

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(first?.navigation.every((item) => item.roles.includes('executive'))).toBe(true);
    expect(first?.evidence.length).toBeGreaterThan(0);
  });

  it('generates pdf and spreadsheet exports', () => {
    const pdf = generateReport('portal-investor-core', 'pdf');
    const sheet = generateReport('portal-exec-core', 'spreadsheet');

    expect(pdf?.payload.startsWith('%PDF-1.4')).toBe(true);
    expect(sheet?.payload).toContain('section,label,value,delta');
  });
});

describe('portal api routes', () => {
  it('returns portals and schedules new reports', async () => {
    const response = await getPortals(new NextRequest('http://localhost/api/portals?role=investor'));
    const json = await response.json();
    expect(json.total).toBe(1);

    const scheduled = await postPortals(
      new NextRequest('http://localhost/api/portals', {
        method: 'POST',
        body: JSON.stringify({
          portalId: 'portal-investor-core',
          cadence: 'weekly',
          channel: 'email',
          recipients: ['investor@example.com'],
          format: 'pdf',
        }),
      }),
    );
    const created = await scheduled.json();
    expect(created.data.portalId).toBe('portal-investor-core');
    expect(created.data.channel).toBe('email');
  });

  it('returns dashboard payloads and report artifacts', async () => {
    const dashboardResponse = await getDashboards(new NextRequest('http://localhost/api/dashboards?role=operator'));
    const dashboard = await dashboardResponse.json();
    expect(dashboard.data.role).toBe('operator');
    expect(dashboard.data.actionTray.length).toBeGreaterThan(0);

    const reportResponse = await postReports(
      new NextRequest('http://localhost/api/reports', {
        method: 'POST',
        body: JSON.stringify({ portalId: 'portal-exec-core', format: 'json' }),
      }),
    );
    const report = await reportResponse.json();
    expect(report.data.exportName).toBe('executive-cockpit.json');
  });

  it('supports report downloads', async () => {
    const response = await getReports(new NextRequest('http://localhost/api/reports?portalId=portal-investor-core&format=spreadsheet&download=1'));
    expect(response.headers.get('content-type')).toContain('text/csv');
    const text = await response.text();
    expect(text).toContain('Capital deployed');
  });
});
