import type { FinancialScenarioInput, ValidationIssue } from "@/lib/finance/types";

export function validateScenarioInput(input: FinancialScenarioInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const mixTotal = input.financingMix.debt + input.financingMix.equity + input.financingMix.leasing;

  if (Math.abs(mixTotal - 1) > 0.0001) {
    issues.push({
      level: "error",
      field: "financingMix",
      message: "Financing mix must sum to 100%.",
    });
  }

  if (input.tenorYears <= 0) {
    issues.push({ level: "error", field: "tenorYears", message: "Tenor must be greater than zero." });
  }

  if (input.targetDebtAmount < 0 || input.targetEquityAmount < 0 || input.targetLeaseAmount < 0) {
    issues.push({ level: "error", field: "fundingTargets", message: "Funding targets cannot be negative." });
  }

  if (input.covenantDefinition.minDscr < 1) {
    issues.push({ level: "warning", field: "covenantDefinition.minDscr", message: "Minimum DSCR below 1.0 is unusually weak." });
  }

  if (input.approvals.length === 0) {
    issues.push({ level: "warning", field: "approvals", message: "Scenario has no review history yet." });
  }

  return issues;
}
