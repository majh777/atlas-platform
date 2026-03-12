export type PortalRole = 'executive' | 'investor' | 'operator';
export type PortalStatus = 'live' | 'pilot' | 'scheduled';
export type ReportFormat = 'pdf' | 'spreadsheet' | 'json';

export interface WorkspaceTheme {
  logoText: string;
  primary: string;
  accent: string;
  surface: string;
  whiteLabel: boolean;
}

export interface PortalWorkspace {
  id: string;
  name: string;
  portfolio: string;
  region: string;
  theme: WorkspaceTheme;
}

export interface PortalMetric {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'steady';
  emphasis?: 'default' | 'success' | 'warn';
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  due: string;
  severity: 'info' | 'warn' | 'critical';
  status: 'open' | 'in_progress' | 'done';
}

export interface EvidenceItem {
  id: string;
  title: string;
  classification: 'open' | 'controlled' | 'restricted';
  summary: string;
  source: string;
}

export interface ScheduledReport {
  id: string;
  portalId: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  channel: 'email' | 'workspace' | 'data-room';
  nextRunAt: string;
  recipients: string[];
  format: ReportFormat;
}

export interface DashboardBundle {
  role: PortalRole;
  workspace: PortalWorkspace;
  headline: string;
  subheadline: string;
  metrics: PortalMetric[];
  chartSeries: Array<{
    title: string;
    points: ChartPoint[];
  }>;
  actionTray: ActionItem[];
  evidence: EvidenceItem[];
  navigation: Array<{
    label: string;
    href: string;
    roles: PortalRole[];
  }>;
}

export interface PortalDefinition {
  id: string;
  slug: string;
  role: PortalRole;
  title: string;
  status: PortalStatus;
  summary: string;
  workspace: PortalWorkspace;
  capabilities: string[];
  mobileActions: string[];
}

export interface ReportArtifact {
  id: string;
  portalId: string;
  title: string;
  generatedAt: string;
  format: ReportFormat;
  audience: PortalRole;
  summary: string;
  notifications: string[];
  exportName: string;
  payload: string;
}
