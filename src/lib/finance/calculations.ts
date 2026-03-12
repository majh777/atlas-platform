import { createHash } from "node:crypto";
import { getAssumptionVersion, getTemplate } from "@/lib/finance/templates";
import type {
  FinancialScenarioInput,
  FinancialScenarioResult,
  ScenarioComparisonResult,
  ScenarioMetric,
  ScenarioStressResult,
  SensitivityShock,
} from "@/lib/finance/types";
import { validateScenarioInput } from "@/lib/finance/validation";

const DEFAULT_SHOCKS: SensitivityShock[] = [
  { name: "Base", capexDeltaPct: 0, opexDeltaPct: 0, priceDeltaPct: 0, productionDeltaPct: 0, rateDeltaPct: 0 },
  { name: "Downside pricing", capexDeltaPct: 0.05, opexDeltaPct: 0.04, priceDeltaPct: -0.12, productionDeltaPct: -0.06, rateDeltaPct: 0.01 },
  { name: "Cost overrun", capexDeltaPct: 0.14, opexDeltaPct: 0.08, priceDeltaPct: 0, productionDeltaPct: -0.03, rateDeltaPct: 0.012 },
  { name: "Upside throughput", capexDeltaPct: 0, opexDeltaPct: 0.03, priceDeltaPct: 0.04, productionDeltaPct: 0.08, rateDeltaPct: 0 },
];

function round(value: number) {
  return Number(value.toFixed(4));
}

function computeMetrics(input: FinancialScenarioInput, shock: SensitivityShock): ScenarioMetric {
  const assumptionsVersion = getAssumptionVersion(input.assumptionsVersion);
  const assumptions = assumptionsVersion.assumptions;
  const capex = getTemplate("capex", input.capexTemplateId);
  const opex = getTemplate("opex", input.opexTemplateId);
  const revenue = getTemplate("revenue", input.revenueTemplateId);

  const totalCapex = capex.items.reduce((sum, item) => sum + item.annualAmount, 0) * (1 + shock.capexDeltaPct);
  const totalOpex = opex.items.reduce((sum, item) => sum + item.annualAmount, 0) * (1 + assumptions.inflationRate + shock.opexDeltaPct);
  const totalRevenue = revenue.items.reduce((sum, item) => {
    const price = item.unitPrice * (1 + assumptions.defaultPriceEscalation + item.escalationRate + shock.priceDeltaPct);
    const volume = item.annualVolume * (1 + assumptions.defaultProductionGrowth + shock.productionDeltaPct);
    return sum + price * volume;
  }, 0);

  const effectiveDebtRate = assumptions.interestRate + shock.rateDeltaPct;
  const annualPrincipal = input.targetDebtAmount / input.tenorYears;
  const annualInterest = input.targetDebtAmount * effectiveDebtRate;
  const annualLeaseCost = input.targetLeaseAmount * assumptions.leaseRate;
  const debtService = annualPrincipal + annualInterest + annualLeaseCost;
  const ebitda = totalRevenue - totalOpex;
  const ebitdaMargin = totalRevenue === 0 ? 0 : ebitda / totalRevenue;
  const dscr = debtService === 0 ? 99 : ebitda / debtService;
  const leverageRatio = ebitda === 0 ? 99 : input.targetDebtAmount / ebitda;
  const interestCoverage = annualInterest === 0 ? 99 : ebitda / annualInterest;
  const terminalValue = Math.max(ebitda, 0) * assumptions.exitMultiple;
  const projectIrr = ((ebitda * (1 - assumptions.taxRate)) + terminalValue / input.tenorYears - totalCapex) / totalCapex;
  const equityValue = Math.max(terminalValue - input.targetDebtAmount, 0);
  const equityMultiple = input.targetEquityAmount === 0 ? 99 : equityValue / input.targetEquityAmount;
  const fundingReadinessScore = Math.max(
    0,
    Math.min(
      100,
      60 + (dscr - input.covenantDefinition.minDscr) * 20 + (projectIrr * 100) * 0.6 - leverageRatio * 6 + interestCoverage * 1.5,
    ),
  );

  return {
    revenue: round(totalRevenue),
    ebitda: round(ebitda),
    ebitdaMargin: round(ebitdaMargin),
    totalCapex: round(totalCapex),
    totalOpex: round(totalOpex),
    debtService: round(debtService),
    dscr: round(dscr),
    leverageRatio: round(leverageRatio),
    interestCoverage: round(interestCoverage),
    projectIrr: round(projectIrr),
    equityMultiple: round(equityMultiple),
    fundingReadinessScore: round(fundingReadinessScore),
  };
}

function getCovenantBreaches(input: FinancialScenarioInput, metrics: ScenarioMetric) {
  const breaches: string[] = [];
  if (metrics.dscr < input.covenantDefinition.minDscr) breaches.push(`DSCR below ${input.covenantDefinition.minDscr}`);
  if (metrics.leverageRatio > input.covenantDefinition.maxLeverage) breaches.push(`Leverage above ${input.covenantDefinition.maxLeverage}x`);
  if (metrics.interestCoverage < input.covenantDefinition.minIcRatio) breaches.push(`Interest coverage below ${input.covenantDefinition.minIcRatio}x`);
  return breaches;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function buildSensitivity(input: FinancialScenarioInput): ScenarioStressResult[] {
  return DEFAULT_SHOCKS.filter((shock) => shock.name !== "Base").map((shock) => {
    const metrics = computeMetrics(input, shock);
    return {
      shock: shock.name,
      metrics,
      covenantBreaches: getCovenantBreaches(input, metrics),
    };
  });
}

/**
 * Calculates a complete financial scenario with metrics, covenants, and sensitivity analysis.
 * 
 * Computes key metrics including DSCR, leverage ratio, project IRR, and equity multiple.
 * Runs sensitivity analysis against standard stress shocks.
 * Generates a lender-ready pack with highlights, checklists, and audit trail.
 * 
 * @param input - The financial scenario input parameters
 * @returns Complete scenario result with metrics, covenant analysis, and lender pack
 * @throws Error if input validation fails
 * 
 * @example
 * ```typescript
 * const result = calculateScenario({
 *   id: 'scenario-001',
 *   targetDebtAmount: 150_000_000,
 *   targetEquityAmount: 50_000_000,
 *   tenorYears: 15,
 *   fundingStructure: 'project_finance',
 *   covenantDefinition: { minDscr: 1.35, maxLeverage: 6.0, minIcRatio: 2.0 },
 *   // ... other inputs
 * });
 * console.log(`DSCR: ${result.metrics.dscr}x`);
 * console.log(`Breaches: ${result.covenantBreaches.join(', ')}`);
 * ```
 */
export function calculateScenario(input: FinancialScenarioInput): FinancialScenarioResult {
  const issues = validateScenarioInput(input).filter((issue) => issue.level === "error");
  if (issues.length > 0) {
    throw new Error(`Scenario validation failed: ${issues.map((issue) => issue.message).join("; ")}`);
  }

  const assumptions = getAssumptionVersion(input.assumptionsVersion);
  const metrics = computeMetrics(input, DEFAULT_SHOCKS[0]);
  const covenantBreaches = getCovenantBreaches(input, metrics);
  const sensitivity = buildSensitivity(input);
  const deterministicPayload = {
    input,
    assumptionsVersion: assumptions.version,
    metrics,
    covenantBreaches,
    sensitivity,
  };
  const fingerprint = createHash("sha256").update(stableStringify(deterministicPayload)).digest("hex");

  return {
    input,
    assumptions,
    metrics,
    covenantBreaches,
    sensitivity,
    lenderPack: {
      highlights: [
        `Funding structure: ${input.fundingStructure}`,
        `Base DSCR: ${metrics.dscr}x`,
        `Project IRR: ${(metrics.projectIrr * 100).toFixed(2)}%`,
      ],
      checklist: [
        "Historical operating data uploaded",
        "Independent technical advisor report attached",
        "Environmental and social approvals confirmed",
        "Board approval recorded",
      ],
      approvalHistory: input.approvals,
    },
    audit: {
      fingerprint,
      generatedAt: input.id,
      steps: [
        "Loaded template library",
        "Loaded assumptions version",
        "Computed base and stress-case metrics",
        "Evaluated covenant thresholds",
        "Generated lender pack and deterministic hash",
      ],
    },
  };
}

export function compareScenarios(base: FinancialScenarioInput, candidate: FinancialScenarioInput): ScenarioComparisonResult {
  const baseMetrics = calculateScenario(base).metrics;
  const candidateMetrics = calculateScenario(candidate).metrics;
  const deltas = Object.fromEntries(
    Object.keys(baseMetrics).map((key) => {
      const metricKey = key as keyof ScenarioMetric;
      return [metricKey, round(candidateMetrics[metricKey] - baseMetrics[metricKey])];
    }),
  ) as Record<keyof ScenarioMetric, number>;

  const betterOn = Object.entries(deltas)
    .filter(([, value]) => value > 0)
    .map(([key]) => key);
  const worseOn = Object.entries(deltas)
    .filter(([, value]) => value < 0)
    .map(([key]) => key);

  return {
    baseId: base.id,
    candidateId: candidate.id,
    deltas,
    betterOn,
    worseOn,
  };
}
