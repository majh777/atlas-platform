import { getAtlasBankabilityContext, scenarios } from "./data";
import {
  BankabilityDomainKey,
  BankabilityEvaluation,
  BenchmarkDelta,
  CommitteeNarrative,
  DomainScore,
  EvaluationContext,
  EvidenceLink,
  ReadinessScorecard,
  RiskDashboard,
  RiskSeverity,
  ScenarioDefinition,
  ScenarioMode,
  ScenarioResult,
  ScoringCriterion,
} from "./types";

const DOMAIN_ORDER: BankabilityDomainKey[] = [
  "technical",
  "commercial",
  "financial",
  "regulatory",
  "esg",
  "execution",
];

const severityRank: Record<RiskSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalize(criteria: ScoringCriterion[]) {
  return criteria.reduce((sum, criterion) => sum + criterion.weight, 0) || 1;
}

function withScenario(criteria: ScoringCriterion[], scenario: ScenarioDefinition) {
  const deltaMap = new Map(scenario.adjustments.map((adjustment) => [adjustment.criterionId, adjustment.delta]));

  return criteria.map((criterion) => ({
    ...criterion,
    score: clamp(criterion.score + (deltaMap.get(criterion.id) ?? 0)),
  }));
}

function evidenceCoverage(evidenceIds: string[], evidence: EvidenceLink[]) {
  const linked = evidence.filter((item) => evidenceIds.includes(item.id));
  if (linked.length === 0) return 0;

  const strengthScore = linked.reduce((sum, item) => {
    if (item.strength === "strong") return sum + 1;
    if (item.strength === "moderate") return sum + 0.7;
    return sum + 0.4;
  }, 0);

  return Number(((strengthScore / linked.length) * 100).toFixed(1));
}

function buildDomainNarrative(domain: BankabilityDomainKey, average: number, flagged: boolean, coverage: number) {
  const posture = average >= 75 ? "bankable" : average >= 60 ? "conditional" : "fragile";
  const flagText = flagged ? "Red-flag conditions remain active." : "No active hard-stop triggers.";
  return `${domain.toUpperCase()} is ${posture} at ${average.toFixed(1)}/100 with ${coverage.toFixed(1)} evidence coverage. ${flagText}`;
}

export function calculateDomainScores(
  context: EvaluationContext,
  scenario: ScenarioDefinition,
): DomainScore[] {
  const adjusted = withScenario(context.scoringModel.criteria, scenario);

  return DOMAIN_ORDER.map((domain) => {
    const criteria = adjusted.filter((criterion) => criterion.domain === domain);
    const weightBase = normalize(criteria);
    const weightedAverage = criteria.reduce((sum, criterion) => sum + criterion.score * criterion.weight, 0) / weightBase;
    const rawAverage = criteria.reduce((sum, criterion) => sum + criterion.score, 0) / Math.max(criteria.length, 1);
    const domainEvidenceIds = criteria.flatMap((criterion) => criterion.evidenceIds);
    const coverage = evidenceCoverage(domainEvidenceIds, context.evidence);
    const flagged = context.issues.some((issue) => issue.domain === domain && severityRank[issue.severity] >= severityRank.high && issue.status !== "closed");

    return {
      domain,
      weightedScore: Number(weightedAverage.toFixed(1)),
      rawAverage: Number(rawAverage.toFixed(1)),
      evidenceCoverage: coverage,
      flagged,
      narrative: buildDomainNarrative(domain, rawAverage, flagged, coverage),
    };
  });
}

export function calculateOverallScore(domainScores: DomainScore[], context: EvaluationContext) {
  const weighted = domainScores.reduce((sum, score) => {
    return sum + score.weightedScore * context.scoringModel.domainWeights[score.domain];
  }, 0);

  return Number(weighted.toFixed(1));
}

export function buildScenarioResults(context: EvaluationContext): ScenarioResult[] {
  const baseDomainScores = calculateDomainScores(context, scenarios[0]);
  const baseScore = calculateOverallScore(baseDomainScores, context);

  return scenarios.map((scenario) => {
    const domainScores = calculateDomainScores(context, scenario);
    const overallScore = calculateOverallScore(domainScores, context);
    const deltaVsBase = Number((overallScore - baseScore).toFixed(1));

    return {
      mode: scenario.mode,
      overallScore,
      domainScores,
      deltaVsBase,
      narrative: `${scenario.label}: ${scenario.description} Overall score ${overallScore.toFixed(1)} (${deltaVsBase >= 0 ? "+" : ""}${deltaVsBase.toFixed(1)} vs base).`,
    };
  });
}

export function buildReadinessScorecards(
  context: EvaluationContext,
  baseDomainScores: DomainScore[],
): ReadinessScorecard[] {
  const criteriaById = new Map(context.scoringModel.criteria.map((criterion) => [criterion.id, criterion]));
  const domainScoreMap = new Map(baseDomainScores.map((score) => [score.domain, score.weightedScore]));

  return context.readinessTargets.map((target) => {
    const related = target.relatedCriteriaIds
      .map((criterionId) => criteriaById.get(criterionId))
      .filter((criterion): criterion is ScoringCriterion => Boolean(criterion));

    let score: number;
    if (target.domainWeights) {
      score = Number(
        Object.entries(target.domainWeights).reduce((sum, [domain, weight]) => {
          return sum + (domainScoreMap.get(domain as BankabilityDomainKey) ?? 0) * weight;
        }, 0).toFixed(1),
      );
    } else {
      score = Number(
        (related.reduce((sum, criterion) => sum + criterion.score, 0) / Math.max(related.length, 1)).toFixed(1),
      );
    }

    const status = score >= 75 ? "ready" : score >= 60 ? "progressing" : "not-ready";

    return {
      targetId: target.id,
      label: target.label,
      type: target.type,
      score,
      status,
      narrative: `${target.label} is ${status.replace("-", " ")} with score ${score.toFixed(1)}.`,
    };
  });
}

export function buildBenchmarkDeltas(context: EvaluationContext, baseDomainScores: DomainScore[]): BenchmarkDelta[] {
  return baseDomainScores.map((score) => {
    const benchmark = context.benchmark.expectedDomainScores[score.domain];
    return {
      domain: score.domain,
      actual: score.weightedScore,
      benchmark,
      gap: Number((score.weightedScore - benchmark).toFixed(1)),
    };
  });
}

function getTopEvidence(context: EvaluationContext, limit = 4) {
  return [...context.evidence]
    .sort((a, b) => {
      const strengthWeight = { weak: 1, moderate: 2, strong: 3 };
      return strengthWeight[b.strength] - strengthWeight[a.strength];
    })
    .slice(0, limit);
}

export function buildCommitteeNarrative(
  context: EvaluationContext,
  overallScore: number,
  baseDomainScores: DomainScore[],
): CommitteeNarrative {
  const strongest = [...baseDomainScores].sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 2);
  const weakest = [...baseDomainScores].sort((a, b) => a.weightedScore - b.weightedScore).slice(0, 2);
  const tone = overallScore >= 75 ? "support" : overallScore >= 60 ? "conditional" : "hold";

  return {
    headline: `${context.project.name}: ${tone === "support" ? "supportable" : tone === "conditional" ? "conditionally bankable" : "not yet bankable"}`,
    tone,
    summary: `Model ${context.scoringModel.version} indicates ${overallScore.toFixed(1)}/100 overall. Committee should focus on regulatory closure, downside debt resilience, and execution-interface discipline before final credit approval.`,
    strengths: strongest.map((item) => `${item.domain.toUpperCase()} is comparatively strong at ${item.weightedScore.toFixed(1)}.`),
    watchouts: weakest.map((item) => `${item.domain.toUpperCase()} is below target at ${item.weightedScore.toFixed(1)} and needs targeted mitigation.`),
    evidenceLinks: getTopEvidence(context),
  };
}

export function explainCriterion(context: EvaluationContext, criterionId: string) {
  const criterion = context.scoringModel.criteria.find((item) => item.id === criterionId);
  if (!criterion) return null;

  const evidence = context.evidence.filter((item) => criterion.evidenceIds.includes(item.id));
  const gap = criterion.score - criterion.threshold;

  return {
    criterionId,
    label: criterion.label,
    score: criterion.score,
    threshold: criterion.threshold,
    gap,
    explanation:
      gap >= 0
        ? `${criterion.label} clears threshold by ${gap.toFixed(1)} points with ${evidence.length} linked evidence item(s).`
        : `${criterion.label} trails threshold by ${Math.abs(gap).toFixed(1)} points; mitigation should prioritize evidence-backed remediation.`,
    evidence,
  };
}

export function buildExportPack(
  context: EvaluationContext,
  overallScore: number,
  readiness: ReadinessScorecard[],
  scenariosToExport: ScenarioResult[],
  benchmarkDeltas: BenchmarkDelta[],
) {
  const readinessLines = readiness.map((item) => `- ${item.label}: ${item.score.toFixed(1)} (${item.status})`).join("\n");
  const scenarioLines = scenariosToExport
    .map((item) => `- ${item.mode}: ${item.overallScore.toFixed(1)} (${item.deltaVsBase >= 0 ? "+" : ""}${item.deltaVsBase.toFixed(1)} vs base)`)
    .join("\n");
  const benchmarkLines = benchmarkDeltas
    .map((item) => `- ${item.domain}: ${item.actual.toFixed(1)} vs ${item.benchmark.toFixed(1)} benchmark (${item.gap >= 0 ? "+" : ""}${item.gap.toFixed(1)})`)
    .join("\n");

  return `# Board / Lender Pack — ${context.project.name}

## Project Snapshot
- Sector: ${context.project.sector}
- Stage: ${context.project.stage}
- Sponsor: ${context.project.sponsor}
- Geography: ${context.project.geography}
- Debt ask: $${context.project.debtAskUsdM}m
- Scoring model: ${context.scoringModel.name} v${context.scoringModel.version}

## Overall Bankability
- Overall score: ${overallScore.toFixed(1)}/100
- Benchmark archetype: ${context.benchmark.label}

## Readiness Scorecards
${readinessLines}

## Scenario Summary
${scenarioLines}

## Benchmark Gaps
${benchmarkLines}

## Risk Actions
${context.mitigations
  .map((item) => `- ${item.title} — owner ${item.owner}, due ${item.dueDate}, status ${item.status}`)
  .join("\n")}
`;
}

export function evaluateBankability(mode: ScenarioMode = "base"): BankabilityEvaluation {
  const context = getAtlasBankabilityContext();
  const scenario = scenarios.find((item) => item.mode === mode) ?? scenarios[0];
  const domainScores = calculateDomainScores(context, scenario);
  const overallScore = calculateOverallScore(domainScores, context);
  const readiness = buildReadinessScorecards(context, domainScores);
  const scenarioResults = buildScenarioResults(context);
  const benchmarkDeltas = buildBenchmarkDeltas(context, domainScores);
  const committeeNarrative = buildCommitteeNarrative(context, overallScore, domainScores);
  const redFlags = context.scoringModel.redFlagRules
    .filter((rule) => rule.predicate(context))
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      domain: rule.domain,
      severity: rule.severity,
      mitigation: rule.mitigationTemplate,
    }));

  return {
    project: context.project,
    scoringModel: {
      id: context.scoringModel.id,
      name: context.scoringModel.name,
      version: context.scoringModel.version,
      effectiveDate: context.scoringModel.effectiveDate,
    },
    overallScore,
    domainScores,
    redFlags,
    readiness,
    scenarios: scenarioResults,
    benchmarkDeltas,
    committeeNarrative,
    mitigationRegister: context.mitigations,
    exportPack: buildExportPack(context, overallScore, readiness, scenarioResults, benchmarkDeltas),
  };
}

export function getRiskDashboard(): RiskDashboard {
  const context = getAtlasBankabilityContext();

  return {
    issues: context.issues,
    mitigationRegister: context.mitigations,
    countsBySeverity: {
      low: context.issues.filter((issue) => issue.severity === "low").length,
      medium: context.issues.filter((issue) => issue.severity === "medium").length,
      high: context.issues.filter((issue) => issue.severity === "high").length,
      critical: context.issues.filter((issue) => issue.severity === "critical").length,
    },
    countsByStatus: {
      open: context.issues.filter((issue) => issue.status === "open").length,
      mitigating: context.issues.filter((issue) => issue.status === "mitigating").length,
      closed: context.issues.filter((issue) => issue.status === "closed").length,
    },
  };
}
