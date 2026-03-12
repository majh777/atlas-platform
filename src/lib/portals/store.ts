import type {
  ActionItem,
  DashboardBundle,
  PortalDefinition,
  PortalRole,
  PortalWorkspace,
  ReportArtifact,
  ReportFormat,
  ScheduledReport,
} from '@/types/portal';

const navigation = [
  { label: 'Home', href: '/', roles: ['executive', 'investor', 'operator'] as PortalRole[] },
  { label: 'Portals', href: '/portals', roles: ['executive', 'investor', 'operator'] as PortalRole[] },
  { label: 'Dashboards', href: '/dashboards', roles: ['executive', 'investor', 'operator'] as PortalRole[] },
  { label: 'Reports', href: '/reports', roles: ['executive', 'investor', 'operator'] as PortalRole[] },
  { label: 'Deal radar', href: '/deal-radar', roles: ['executive', 'operator'] as PortalRole[] },
  { label: 'Evidence', href: '/evidence', roles: ['executive', 'investor', 'operator'] as PortalRole[] },
];

const workspaces: PortalWorkspace[] = [
  {
    id: 'ws-atlas-core',
    name: 'Atlas Core Infra',
    portfolio: 'Central Africa Metals',
    region: 'Central Africa',
    theme: {
      logoText: 'Atlas',
      primary: '#22d3ee',
      accent: '#38bdf8',
      surface: '#0f172a',
      whiteLabel: false,
    },
  },
  {
    id: 'ws-panthera',
    name: 'Panthera Sponsor Room',
    portfolio: 'Corridor Expansion Program',
    region: 'West Africa',
    theme: {
      logoText: 'Panthera Capital',
      primary: '#f59e0b',
      accent: '#f97316',
      surface: '#111827',
      whiteLabel: true,
    },
  },
];

const portals: PortalDefinition[] = [
  {
    id: 'portal-exec-core',
    slug: 'executive-cockpit',
    role: 'executive',
    title: 'Executive cockpit and portfolio command center',
    status: 'live',
    summary: 'Cross-workspace performance, capital deployment, risk heat, lender readiness, and mobile action trays for leadership reviews.',
    workspace: workspaces[0],
    capabilities: ['Portfolio command center', 'Cross-project risk heatmap', 'Capital deployment pacing', 'Mobile approvals'],
    mobileActions: ['Approve board memo', 'Escalate variance', 'Open data room'],
  },
  {
    id: 'portal-investor-core',
    slug: 'investor-reporting',
    role: 'investor',
    title: 'Investor reporting portal',
    status: 'live',
    summary: 'Controlled evidence views, periodic capital call reporting, covenant summaries, and export-ready performance packs.',
    workspace: workspaces[1],
    capabilities: ['Controlled evidence view', 'Investor KPI cards', 'Monthly reporting cadence', 'Data-room delivery'],
    mobileActions: ['Review capital call', 'Download report', 'Acknowledge notice'],
  },
  {
    id: 'portal-operator-core',
    slug: 'operator-oversight',
    role: 'operator',
    title: 'Operator portal for project and asset oversight',
    status: 'pilot',
    summary: 'Run-rate tracking, milestone exceptions, permit workbacks, operating actions, and field-ready mobile trays.',
    workspace: workspaces[0],
    capabilities: ['Shift actions', 'Milestone burn-down', 'Variance drill-down', 'Permit readiness'],
    mobileActions: ['Acknowledge blocker', 'Assign field task', 'Upload evidence'],
  },
];

const actionLibrary: Record<PortalRole, ActionItem[]> = {
  executive: [
    { id: 'a1', title: 'Approve debt sizing memo', owner: 'IC Chair', due: '2026-03-15', severity: 'critical', status: 'open' },
    { id: 'a2', title: 'Escalate rail EPC variance', owner: 'Portfolio PMO', due: '2026-03-17', severity: 'warn', status: 'in_progress' },
    { id: 'a3', title: 'Review board export draft', owner: 'Chief of Staff', due: '2026-03-18', severity: 'info', status: 'open' },
  ],
  investor: [
    { id: 'a4', title: 'Release monthly investor tear sheet', owner: 'IR Lead', due: '2026-03-20', severity: 'critical', status: 'open' },
    { id: 'a5', title: 'Refresh controlled evidence room', owner: 'Diligence Ops', due: '2026-03-16', severity: 'warn', status: 'in_progress' },
    { id: 'a6', title: 'Confirm distribution list', owner: 'Fund Admin', due: '2026-03-14', severity: 'info', status: 'done' },
  ],
  operator: [
    { id: 'a7', title: 'Resolve substation delivery delay', owner: 'Site Manager', due: '2026-03-13', severity: 'critical', status: 'open' },
    { id: 'a8', title: 'Upload safety pack evidence', owner: 'HSE Lead', due: '2026-03-13', severity: 'warn', status: 'in_progress' },
    { id: 'a9', title: 'Confirm shift handover notes', owner: 'Operations Control', due: '2026-03-12', severity: 'info', status: 'done' },
  ],
};

const evidenceLibrary = {
  executive: [
    { id: 'e1', title: 'Capital deployment bridge', classification: 'open', summary: 'Quarterly bridge from approved capex to deployed proceeds.', source: 'Finance model v4.2' },
    { id: 'e2', title: 'Risk committee heat note', classification: 'controlled', summary: 'Cross-project watchlist with mitigation status and owner.', source: 'Risk register 2026-03' },
  ],
  investor: [
    { id: 'e3', title: 'Independent engineer certificate', classification: 'controlled', summary: 'Completion evidence and contingency draw commentary.', source: 'IE report signed 2026-03-01' },
    { id: 'e4', title: 'Data-room covenant pack', classification: 'restricted', summary: 'Investor-only covenant compliance and draw conditions.', source: 'Lender reporting package' },
  ],
  operator: [
    { id: 'e5', title: 'Permit tracker evidence', classification: 'controlled', summary: 'Permit milestone attachments and approval dates.', source: 'Permitting lane' },
    { id: 'e6', title: 'Shift handover packet', classification: 'open', summary: 'Open actions, blockers, and crew readiness notes.', source: 'Operations desk' },
  ],
} as const;

const chartSeries: Record<PortalRole, DashboardBundle['chartSeries']> = {
  executive: [
    {
      title: 'Portfolio value at risk',
      points: [
        { label: 'Jan', value: 22 },
        { label: 'Feb', value: 19 },
        { label: 'Mar', value: 15 },
        { label: 'Apr', value: 12 },
      ],
    },
    {
      title: 'Capital deployment cadence',
      points: [
        { label: 'Q1', value: 120 },
        { label: 'Q2', value: 185 },
        { label: 'Q3', value: 210 },
        { label: 'Q4', value: 240 },
      ],
    },
  ],
  investor: [
    {
      title: 'NAV and realized progress',
      points: [
        { label: 'Q1', value: 68 },
        { label: 'Q2', value: 72 },
        { label: 'Q3', value: 78 },
        { label: 'Q4', value: 84 },
      ],
    },
    {
      title: 'Evidence completion',
      points: [
        { label: 'Debt', value: 91 },
        { label: 'ESG', value: 84 },
        { label: 'Legal', value: 88 },
        { label: 'Ops', value: 79 },
      ],
    },
  ],
  operator: [
    {
      title: 'Milestone burn-down',
      points: [
        { label: 'Week 1', value: 18 },
        { label: 'Week 2', value: 14 },
        { label: 'Week 3', value: 9 },
        { label: 'Week 4', value: 6 },
      ],
    },
    {
      title: 'Daily output vs plan',
      points: [
        { label: 'Mon', value: 92 },
        { label: 'Tue', value: 95 },
        { label: 'Wed', value: 101 },
        { label: 'Thu', value: 98 },
      ],
    },
  ],
};

const metricLibrary: Record<PortalRole, DashboardBundle['metrics']> = {
  executive: [
    { label: 'Portfolio NAV', value: '$1.24bn', delta: '+8.4%', trend: 'up', emphasis: 'success' },
    { label: 'Projects in red-zone', value: '2', delta: '-1 vs last month', trend: 'up', emphasis: 'success' },
    { label: 'Debt readiness', value: '84/100', delta: '+6 pts', trend: 'up', emphasis: 'success' },
    { label: 'Actions due < 7d', value: '11', delta: '+3', trend: 'steady', emphasis: 'warn' },
  ],
  investor: [
    { label: 'Capital deployed', value: '$482m', delta: '+$34m', trend: 'up', emphasis: 'success' },
    { label: 'Distribution coverage', value: '1.18x', delta: '+0.06x', trend: 'up', emphasis: 'success' },
    { label: 'Controlled evidence', value: '47 files', delta: '98% current', trend: 'steady' },
    { label: 'Reporting SLA', value: '100%', delta: 'On time', trend: 'up', emphasis: 'success' },
  ],
  operator: [
    { label: 'Workfront completion', value: '76%', delta: '+9 pts', trend: 'up', emphasis: 'success' },
    { label: 'Open blockers', value: '5', delta: '-2', trend: 'up', emphasis: 'success' },
    { label: 'Safety actions', value: '3', delta: '1 critical', trend: 'steady', emphasis: 'warn' },
    { label: 'Shift utilization', value: '93%', delta: '+4 pts', trend: 'up', emphasis: 'success' },
  ],
};

const reportSchedules: ScheduledReport[] = [
  {
    id: 'schedule-1',
    portalId: 'portal-investor-core',
    cadence: 'monthly',
    channel: 'data-room',
    nextRunAt: '2026-03-31T08:00:00.000Z',
    recipients: ['lp-committee@panthera.example', 'investor-relations@atlas.example'],
    format: 'pdf',
  },
  {
    id: 'schedule-2',
    portalId: 'portal-exec-core',
    cadence: 'weekly',
    channel: 'workspace',
    nextRunAt: '2026-03-19T05:30:00.000Z',
    recipients: ['exec-office@atlas.example'],
    format: 'spreadsheet',
  },
];

const dashboardCache = new Map<string, { at: number; value: DashboardBundle }>();
const CACHE_TTL_MS = 60_000;

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

function getPortalByRole(role: PortalRole, workspaceId?: string) {
  return portals.find((portal) => portal.role === role && (!workspaceId || portal.workspace.id === workspaceId)) ?? portals.find((portal) => portal.role === role) ?? null;
}

export function listPortals(role?: PortalRole) {
  return role ? portals.filter((portal) => portal.role === role) : portals;
}

export function listScheduledReports(portalId?: string) {
  return portalId ? reportSchedules.filter((report) => report.portalId === portalId) : reportSchedules;
}

export function getDashboardBundle(role: PortalRole, workspaceId?: string) {
  const cacheKey = `${role}:${workspaceId ?? 'default'}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const portal = getPortalByRole(role, workspaceId);
  if (!portal) {
    return null;
  }

  const dashboard: DashboardBundle = {
    role,
    workspace: portal.workspace,
    headline: portal.title,
    subheadline: portal.summary,
    metrics: metricLibrary[role],
    chartSeries: chartSeries[role],
    actionTray: actionLibrary[role],
    evidence: [...evidenceLibrary[role]],
    navigation: navigation.filter((item) => item.roles.includes(role)),
  };

  dashboardCache.set(cacheKey, { at: Date.now(), value: dashboard });
  return dashboard;
}

function buildNarrativeLines(role: PortalRole) {
  const bundle = getDashboardBundle(role);
  if (!bundle) return [];

  return [
    `${bundle.headline}`,
    `${bundle.workspace.name} · ${bundle.workspace.portfolio} · ${bundle.workspace.region}`,
    ...bundle.metrics.map((metric) => `${metric.label}: ${metric.value} (${metric.delta})`),
    '',
    'Action tray',
    ...bundle.actionTray.map((item) => `- ${item.title} | owner ${item.owner} | due ${item.due} | ${item.status}`),
    '',
    'Evidence access',
    ...bundle.evidence.map((item) => `- [${item.classification}] ${item.title}: ${item.summary}`),
  ];
}

function buildMinimalPdf(title: string, lines: string[]) {
  const safe = [title, ...lines].map((line) => line.replace(/[()\\]/g, '')).slice(0, 18);
  const content = ['BT', '/F1 12 Tf', '40 760 Td']
    .concat(
      safe.flatMap((line, index) => (index === 0 ? [`(${line}) Tj`] : ['0 -18 Td', `(${line}) Tj`])),
    )
    .concat(['ET'])
    .join('\n');
  const stream = `${content}`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function buildSpreadsheet(role: PortalRole) {
  const bundle = getDashboardBundle(role);
  if (!bundle) return '';

  const header = 'section,label,value,delta';
  const metrics = bundle.metrics.map((metric) => `metric,${metric.label},${metric.value},${metric.delta}`);
  const actions = bundle.actionTray.map((item) => `action,${item.title},${item.status},${item.owner}`);
  return [header, ...metrics, ...actions].join('\n');
}

export function generateReport(portalId: string, format: ReportFormat = 'pdf') {
  const portal = portals.find((item) => item.id === portalId);
  if (!portal) return null;

  const lines = buildNarrativeLines(portal.role);
  const title = `${portal.workspace.theme.logoText} ${portal.role} report`;
  const payload =
    format === 'pdf'
      ? buildMinimalPdf(title, lines)
      : format === 'spreadsheet'
        ? buildSpreadsheet(portal.role)
        : JSON.stringify({ portal, lines, generatedAt: new Date().toISOString() }, null, 2);

  const artifact: ReportArtifact = {
    id: `report-${portalId}-${format}`,
    portalId,
    title,
    generatedAt: new Date().toISOString(),
    format,
    audience: portal.role,
    summary: `${portal.title} generated for ${portal.workspace.name} with ${portal.workspace.theme.whiteLabel ? 'white-label' : 'Atlas'} branding.`,
    notifications: [
      `Queued ${format.toUpperCase()} export for ${portal.workspace.name}`,
      `Notified ${portal.role} recipients via scheduled reporting lane`,
    ],
    exportName: `${portal.slug}.${format === 'spreadsheet' ? 'csv' : format === 'pdf' ? 'pdf' : 'json'}`,
    payload,
  };

  return artifact;
}

export function scheduleReport(input: Omit<ScheduledReport, 'id'>) {
  const report: ScheduledReport = {
    ...input,
    id: `schedule-${reportSchedules.length + 1}`,
  };
  reportSchedules.unshift(report);
  return report;
}

export function getRoleAwareNavigation(role: PortalRole) {
  return navigation.filter((item) => item.roles.includes(role));
}

export function getPortalSummary() {
  return {
    totalPortals: portals.length,
    whiteLabelWorkspaces: workspaces.filter((workspace) => workspace.theme.whiteLabel).length,
    scheduledReports: reportSchedules.length,
    cacheEntries: dashboardCache.size,
    mobileActions: portals.reduce((sum, portal) => sum + portal.mobileActions.length, 0),
    evidenceCoverage: formatPercent((evidenceLibrary.investor.length + evidenceLibrary.executive.length + evidenceLibrary.operator.length) * 16.5),
  };
}
