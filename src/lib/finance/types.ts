export type FundingStructure = "debt" | "equity" | "leasing" | "blended";
export type TemplateType = "capex" | "opex" | "revenue";
export type ReviewStatus = "draft" | "pending" | "approved" | "rejected";

export interface AssumptionVersion {
  version: string;
  effectiveDate: string;
  assumptions: AssumptionLibrary;
  summary: string;
}

export interface AssumptionLibrary {
  inflationRate: number;
  discountRate: number;
  taxRate: number;
  interestRate: number;
  leaseRate: number;
  exitMultiple: number;
  defaultProductionGrowth: number;
  defaultPriceEscalation: number;
}

export interface CostLineItem {
  label: string;
  annualAmount: number;
  category: string;
}

export interface RevenueLineItem {
  label: string;
  annualVolume: number;
  unitPrice: number;
  escalationRate: number;
}

export interface CapexTemplate {
  id: string;
  name: string;
  type: "capex";
  basis: string;
  items: CostLineItem[];
}

export interface OpexTemplate {
  id: string;
  name: string;
  type: "opex";
  basis: string;
  items: CostLineItem[];
}

export interface RevenueTemplate {
  id: string;
  name: string;
  type: "revenue";
  basis: string;
  items: RevenueLineItem[];
}

export type ModelTemplate = CapexTemplate | OpexTemplate | RevenueTemplate;

export interface FinancingMix {
  debt: number;
  equity: number;
  leasing: number;
}

export interface CovenantDefinition {
  minDscr: number;
  maxLeverage: number;
  minIcRatio: number;
}

export interface SensitivityShock {
  name: string;
  capexDeltaPct: number;
  opexDeltaPct: number;
  priceDeltaPct: number;
  productionDeltaPct: number;
  rateDeltaPct: number;
}

export interface ApprovalRecord {
  reviewer: string;
  role: string;
  status: ReviewStatus;
  timestamp: string;
  comment: string;
}

export interface FinancialScenarioInput {
  id: string;
  name: string;
  projectName: string;
  fundingStructure: FundingStructure;
  tenorYears: number;
  capexTemplateId: string;
  opexTemplateId: string;
  revenueTemplateId: string;
  financingMix: FinancingMix;
  assumptionsVersion: string;
  targetDebtAmount: number;
  targetEquityAmount: number;
  targetLeaseAmount: number;
  covenantDefinition: CovenantDefinition;
  reviewStatus: ReviewStatus;
  approvals: ApprovalRecord[];
}

export interface ScenarioMetric {
  revenue: number;
  ebitda: number;
  ebitdaMargin: number;
  totalCapex: number;
  totalOpex: number;
  debtService: number;
  dscr: number;
  leverageRatio: number;
  interestCoverage: number;
  projectIrr: number;
  equityMultiple: number;
  fundingReadinessScore: number;
}

export interface ScenarioStressResult {
  shock: string;
  metrics: ScenarioMetric;
  covenantBreaches: string[];
}

export interface DeterministicAuditTrail {
  fingerprint: string;
  generatedAt: string;
  steps: string[];
}

export interface FinancialScenarioResult {
  input: FinancialScenarioInput;
  assumptions: AssumptionVersion;
  metrics: ScenarioMetric;
  sensitivity: ScenarioStressResult[];
  covenantBreaches: string[];
  lenderPack: {
    highlights: string[];
    checklist: string[];
    approvalHistory: ApprovalRecord[];
  };
  audit: DeterministicAuditTrail;
}

export interface ScenarioComparisonResult {
  baseId: string;
  candidateId: string;
  deltas: Record<keyof ScenarioMetric, number>;
  betterOn: string[];
  worseOn: string[];
}

export interface ValidationIssue {
  level: "error" | "warning";
  field: string;
  message: string;
}
