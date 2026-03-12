import { describe, expect, it } from "vitest";
import { evaluateBankability, explainCriterion, getRiskDashboard } from "@/lib/bankability/engine";
import { getAtlasBankabilityContext } from "@/lib/bankability/data";

describe("bankability engine", () => {
  it("evaluates the base case with readiness, scenarios, and benchmark outputs", () => {
    const evaluation = evaluateBankability();

    expect(evaluation.project.name).toContain("Atlas");
    expect(evaluation.overallScore).toBeGreaterThan(0);
    expect(evaluation.domainScores).toHaveLength(6);
    expect(evaluation.readiness.length).toBeGreaterThanOrEqual(3);
    expect(evaluation.scenarios.map((item) => item.mode)).toEqual(["base", "downside", "upside"]);
    expect(evaluation.redFlags.length).toBeGreaterThanOrEqual(1);
    expect(evaluation.exportPack).toContain("Board / Lender Pack");
  });

  it("makes downside worse than upside for overall score", () => {
    const downside = evaluateBankability("downside");
    const upside = evaluateBankability("upside");

    expect(downside.overallScore).toBeLessThan(upside.overallScore);
  });

  it("explains criteria with linked evidence", () => {
    const explanation = explainCriterion(getAtlasBankabilityContext(), "fin-dscr");

    expect(explanation).not.toBeNull();
    expect(explanation?.label).toContain("Debt capacity");
    expect(explanation?.evidence.length).toBeGreaterThan(0);
    expect(explanation?.explanation).toContain("threshold");
  });

  it("builds a risk dashboard with severity counts and mitigation actions", () => {
    const dashboard = getRiskDashboard();

    expect(dashboard.issues.length).toBeGreaterThan(0);
    expect(dashboard.mitigationRegister.length).toBeGreaterThan(0);
    expect(dashboard.countsBySeverity.critical).toBe(1);
    expect(dashboard.countsByStatus.open).toBeGreaterThan(0);
  });
});
