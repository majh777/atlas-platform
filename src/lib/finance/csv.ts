import type { FinancialScenarioResult } from "@/lib/finance/types";

export function exportScenarioToCsv(result: FinancialScenarioResult) {
  const rows = [
    ["scenario_id", result.input.id],
    ["scenario_name", result.input.name],
    ["project_name", result.input.projectName],
    ["funding_structure", result.input.fundingStructure],
    ["revenue", result.metrics.revenue],
    ["ebitda", result.metrics.ebitda],
    ["project_irr", result.metrics.projectIrr],
    ["dscr", result.metrics.dscr],
    ["leverage_ratio", result.metrics.leverageRatio],
    ["funding_readiness_score", result.metrics.fundingReadinessScore],
    ["audit_fingerprint", result.audit.fingerprint],
  ];

  return rows.map((row) => row.join(",")).join("\n");
}

export function importScenarioCsv(csv: string) {
  const entries = Object.fromEntries(
    csv
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(","))
      .map(([key, ...rest]) => [key, rest.join(",")]),
  );

  return entries;
}
