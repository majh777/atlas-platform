export type MilestoneStatus = 'planned' | 'at_risk' | 'in_progress' | 'completed' | 'delayed';
export type IssueStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type IssueCategory = 'field' | 'rfi' | 'punch_list' | 'quality' | 'safety';
export type ChangeOrderStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'implemented';
export type ProcurementStatus = 'tracking' | 'ordered' | 'fabrication' | 'shipping' | 'site_received' | 'delayed';

export interface WorkPackage {
  id: string;
  code: string;
  name: string;
  area: string;
  contractor: string;
  discipline: 'civil' | 'mechanical' | 'electrical' | 'rail' | 'port' | 'utilities';
  progress: number;
  plannedPercent: number;
  scheduleVarianceDays: number;
  physicalPercent: number;
  earnedValueUsd: number;
  budgetUsd: number;
  forecastUsd: number;
  commitmentsUsd: number;
  contingencyUsd: number;
  riskRating: 'low' | 'medium' | 'high';
  longLeadExposure: boolean;
  nextMilestoneId: string;
}

export interface Milestone {
  id: string;
  title: string;
  workPackageId: string;
  owner: string;
  baselineDate: string;
  forecastDate: string;
  actualDate?: string;
  status: MilestoneStatus;
  critical: boolean;
  dependencies: string[];
  completion: number;
}

export interface BudgetSnapshot {
  approvedBudgetUsd: number;
  currentForecastUsd: number;
  commitmentsUsd: number;
  actualsUsd: number;
  contingencyUsd: number;
  contingencyDrawnUsd: number;
  estimateAtCompletionUsd: number;
}

export interface ContractorScorecard {
  contractor: string;
  safety: number;
  quality: number;
  productivity: number;
  commercial: number;
  claimsExposureUsd: number;
  activeChangeOrders: number;
  notes: string;
}

export interface ChangeOrder {
  id: string;
  title: string;
  contractor: string;
  workPackageId: string;
  status: ChangeOrderStatus;
  requestedCostUsd: number;
  approvedCostUsd: number;
  scheduleImpactDays: number;
  reason: string;
  approvers: string[];
  history: Array<{
    at: string;
    status: ChangeOrderStatus;
    comment: string;
  }>;
}

export interface IssueRecord {
  id: string;
  title: string;
  category: IssueCategory;
  workPackageId: string;
  location: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: IssueStatus;
  assignee: string;
  reportedBy: string;
  createdAt: string;
  dueDate?: string;
  description: string;
  mobileCaptured: boolean;
}

export interface ProcurementItem {
  id: string;
  item: string;
  supplier: string;
  workPackageId: string;
  requiredOnSiteDate: string;
  forecastArrivalDate: string;
  status: ProcurementStatus;
  longLead: boolean;
  varianceDays: number;
}

export interface VarianceAnalysis {
  scheduleVarianceDays: number;
  costVarianceUsd: number;
  commitmentCoveragePct: number;
  contingencyRemainingUsd: number;
  longLeadDelayedCount: number;
  criticalIssuesOpen: number;
}

export interface ExecutionTwin {
  project: {
    id: string;
    name: string;
    location: string;
    phase: string;
  };
  generatedAt: string;
  workPackages: WorkPackage[];
  milestones: Milestone[];
  budget: BudgetSnapshot;
  contractorScorecards: ContractorScorecard[];
  changeOrders: ChangeOrder[];
  issues: IssueRecord[];
  procurement: ProcurementItem[];
  variance: VarianceAnalysis;
  highlights: string[];
}
