import type { BudgetSnapshot, IssueRecord, ProcurementItem, VarianceAnalysis, WorkPackage } from './types';

export function computeBudgetSnapshot(workPackages: WorkPackage[]): BudgetSnapshot {
  const approvedBudgetUsd = workPackages.reduce((sum, item) => sum + item.budgetUsd, 0);
  const currentForecastUsd = workPackages.reduce((sum, item) => sum + item.forecastUsd, 0);
  const commitmentsUsd = workPackages.reduce((sum, item) => sum + item.commitmentsUsd, 0);
  const actualsUsd = workPackages.reduce((sum, item) => sum + item.earnedValueUsd * 0.92, 0);
  const contingencyUsd = workPackages.reduce((sum, item) => sum + item.contingencyUsd, 0);
  const contingencyDrawnUsd = Math.max(currentForecastUsd - approvedBudgetUsd, 0);

  return {
    approvedBudgetUsd,
    currentForecastUsd,
    commitmentsUsd,
    actualsUsd,
    contingencyUsd,
    contingencyDrawnUsd,
    estimateAtCompletionUsd: currentForecastUsd,
  };
}

export function computeVarianceAnalysis(
  workPackages: WorkPackage[],
  budget: BudgetSnapshot,
  procurement: ProcurementItem[],
  issues: IssueRecord[],
): VarianceAnalysis {
  const scheduleVarianceDays = Math.round(
    workPackages.reduce((sum, item) => sum + item.scheduleVarianceDays, 0) / Math.max(workPackages.length, 1),
  );
  const costVarianceUsd = budget.currentForecastUsd - budget.approvedBudgetUsd;
  const commitmentCoveragePct = Math.round((budget.commitmentsUsd / Math.max(budget.approvedBudgetUsd, 1)) * 100);
  const contingencyRemainingUsd = budget.contingencyUsd - budget.contingencyDrawnUsd;
  const longLeadDelayedCount = procurement.filter((item) => item.longLead && item.varianceDays > 0).length;
  const criticalIssuesOpen = issues.filter((issue) => issue.priority === 'critical' && issue.status !== 'closed').length;

  return {
    scheduleVarianceDays,
    costVarianceUsd,
    commitmentCoveragePct,
    contingencyRemainingUsd,
    longLeadDelayedCount,
    criticalIssuesOpen,
  };
}
