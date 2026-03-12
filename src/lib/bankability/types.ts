export type BankabilityDomainKey =
  | "technical"
  | "commercial"
  | "financial"
  | "regulatory"
  | "esg"
  | "execution";

export type EvidenceStrength = "weak" | "moderate" | "strong";
export type ScenarioMode = "base" | "downside" | "upside";
export type ReadinessEntityType = "project" | "workstream" | "counterparty";
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskStatus = "open" | "mitigating" | "closed";
export type CommitteeTone = "support" | "conditional" | "hold";

export interface EvidenceLink {
  id: string;
  title: string;
  href: string;
  excerpt: string;
  strength: EvidenceStrength;
  updatedAt: string;
}

export interface ScoringCriterion {
  id: string;
  domain: BankabilityDomainKey;
  label: string;
  description: string;
  weight: number;
  score: number;
  owner: string;
  threshold: number;
  evidenceIds: string[];
  notes?: string;
}

export interface RedFlagRule {
  id: string;
  label: string;
  description: string;
  domain: BankabilityDomainKey;
  severity: RiskSeverity;
  predicate: (context: EvaluationContext) => boolean;
  mitigationTemplate: string;
}

export interface MitigationAction {
  id: string;
  issueId: string;
  title: string;
  owner: string;
  dueDate: string;
  status: RiskStatus;
  workstream: string;
  evidenceIds: string[];
}

export interface RiskIssue {
  id: string;
  title: string;
  domain: BankabilityDomainKey;
  severity: RiskSeverity;
  status: RiskStatus;
  counterparty: string;
  workstream: string;
  owner: string;
  description: string;
  mitigation: string;
  evidenceIds: string[];
}

export interface ReadinessTarget {
  id: string;
  type: ReadinessEntityType;
  label: string;
  domainWeights?: Partial<Record<BankabilityDomainKey, number>>;
  relatedCriteriaIds: string[];
}

export interface ArchetypeBenchmark {
  id: string;
  label: string;
  sector: string;
  expectedDomainScores: Record<BankabilityDomainKey, number>;
  notes: string;
}

export interface ScoringModelVersion {
  id: string;
  name: string;
  version: string;
  effectiveDate: string;
  domainWeights: Record<BankabilityDomainKey, number>;
  criteria: ScoringCriterion[];
  redFlagRules: RedFlagRule[];
}

export interface ScenarioAdjustment {
  criterionId: string;
  delta: number;
  reason: string;
}

export interface ScenarioDefinition {
  mode: ScenarioMode;
  label: string;
  description: string;
  adjustments: ScenarioAdjustment[];
}

export interface ProjectProfile {
  id: string;
  name: string;
  sector: string;
  stage: string;
  sponsor: string;
  geography: string;
  debtAskUsdM: number;
}

export interface EvaluationContext {
  project: ProjectProfile;
  scoringModel: ScoringModelVersion;
  evidence: EvidenceLink[];
  issues: RiskIssue[];
  mitigations: MitigationAction[];
  readinessTargets: ReadinessTarget[];
  benchmark: ArchetypeBenchmark;
}

export interface DomainScore {
  domain: BankabilityDomainKey;
  weightedScore: number;
  rawAverage: number;
  evidenceCoverage: number;
  flagged: boolean;
  narrative: string;
}

export interface ScenarioResult {
  mode: ScenarioMode;
  overallScore: number;
  domainScores: DomainScore[];
  deltaVsBase: number;
  narrative: string;
}

export interface ReadinessScorecard {
  targetId: string;
  label: string;
  type: ReadinessEntityType;
  score: number;
  status: "not-ready" | "progressing" | "ready";
  narrative: string;
}

export interface BenchmarkDelta {
  domain: BankabilityDomainKey;
  actual: number;
  benchmark: number;
  gap: number;
}

export interface CommitteeNarrative {
  headline: string;
  tone: CommitteeTone;
  summary: string;
  strengths: string[];
  watchouts: string[];
  evidenceLinks: EvidenceLink[];
}

export interface BankabilityEvaluation {
  project: ProjectProfile;
  scoringModel: Pick<ScoringModelVersion, "id" | "name" | "version" | "effectiveDate">;
  overallScore: number;
  domainScores: DomainScore[];
  redFlags: Array<{
    id: string;
    label: string;
    domain: BankabilityDomainKey;
    severity: RiskSeverity;
    mitigation: string;
  }>;
  readiness: ReadinessScorecard[];
  scenarios: ScenarioResult[];
  benchmarkDeltas: BenchmarkDelta[];
  committeeNarrative: CommitteeNarrative;
  mitigationRegister: MitigationAction[];
  exportPack: string;
}

export interface RiskDashboard {
  issues: RiskIssue[];
  mitigationRegister: MitigationAction[];
  countsBySeverity: Record<RiskSeverity, number>;
  countsByStatus: Record<RiskStatus, number>;
}
