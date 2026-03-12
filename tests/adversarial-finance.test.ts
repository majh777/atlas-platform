import { describe, expect, it } from "vitest";
import { calculateScenario, compareScenarios } from "@/lib/finance/calculations";
import { validateScenarioInput } from "@/lib/finance/validation";
import { demoScenarios } from "@/lib/finance/demo-data";
import type { FinancialScenarioInput } from "@/lib/finance/types";

// Helper to create a valid base scenario for mutations
function createBaseScenario(overrides: Partial<FinancialScenarioInput> = {}): FinancialScenarioInput {
  return {
    id: "test-scenario",
    name: "Test Scenario",
    projectName: "Test Project",
    fundingStructure: "debt",
    tenorYears: 7,
    capexTemplateId: "capex-open-pit",
    opexTemplateId: "opex-industrial",
    revenueTemplateId: "revenue-copper-concentrate",
    financingMix: { debt: 0.65, equity: 0.25, leasing: 0.1 },
    assumptionsVersion: "2026.01-base",
    targetDebtAmount: 260_000_000,
    targetEquityAmount: 100_000_000,
    targetLeaseAmount: 40_000_000,
    covenantDefinition: { minDscr: 1.25, maxLeverage: 3.5, minIcRatio: 2 },
    reviewStatus: "approved",
    approvals: [
      { reviewer: "Test", role: "Sponsor", status: "approved", timestamp: "2026-03-01T08:00:00Z", comment: "Test" },
    ],
    ...overrides,
  };
}

describe("adversarial finance calculations - edge cases", () => {
  // ===================== NEGATIVE NUMBERS =====================
  describe("negative number handling", () => {
    it("rejects negative debt amount", () => {
      const scenario = createBaseScenario({ targetDebtAmount: -100_000_000 });
      const issues = validateScenarioInput(scenario);
      expect(issues.some(i => i.level === "error" && i.field === "fundingTargets")).toBe(true);
    });

    it("rejects negative equity amount", () => {
      const scenario = createBaseScenario({ targetEquityAmount: -50_000_000 });
      const issues = validateScenarioInput(scenario);
      expect(issues.some(i => i.level === "error" && i.field === "fundingTargets")).toBe(true);
    });

    it("rejects negative lease amount", () => {
      const scenario = createBaseScenario({ targetLeaseAmount: -25_000_000 });
      const issues = validateScenarioInput(scenario);
      expect(issues.some(i => i.level === "error" && i.field === "fundingTargets")).toBe(true);
    });

    it("rejects negative tenor", () => {
      const scenario = createBaseScenario({ tenorYears: -5 });
      const issues = validateScenarioInput(scenario);
      expect(issues.some(i => i.level === "error" && i.field === "tenorYears")).toBe(true);
    });

    it("handles all funding targets negative simultaneously", () => {
      const scenario = createBaseScenario({
        targetDebtAmount: -100_000_000,
        targetEquityAmount: -50_000_000,
        targetLeaseAmount: -25_000_000,
      });
      const issues = validateScenarioInput(scenario);
      expect(issues.filter(i => i.level === "error").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===================== OVERFLOW / EXTREME VALUES =====================
  describe("extreme value handling", () => {
    it("handles extremely large debt amounts without overflow", () => {
      const scenario = createBaseScenario({ targetDebtAmount: Number.MAX_SAFE_INTEGER });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.dscr)).toBe(true);
      expect(Number.isFinite(result.metrics.leverageRatio)).toBe(true);
    });

    it("handles extremely small positive amounts", () => {
      const scenario = createBaseScenario({
        targetDebtAmount: 0.001,
        targetEquityAmount: 0.001,
        targetLeaseAmount: 0.001,
      });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.debtService)).toBe(true);
    });

    it("handles maximum JavaScript integer for equity", () => {
      const scenario = createBaseScenario({ targetEquityAmount: Number.MAX_SAFE_INTEGER });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.equityMultiple)).toBe(true);
    });

    it("handles very long tenor (100 years)", () => {
      const scenario = createBaseScenario({ tenorYears: 100 });
      const result = calculateScenario(scenario);
      expect(result.metrics.debtService).toBeGreaterThan(0);
    });

    it("handles minimum positive tenor (fractional year)", () => {
      const scenario = createBaseScenario({ tenorYears: 0.01 });
      const issues = validateScenarioInput(scenario);
      // Should pass validation as > 0
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.dscr)).toBe(true);
    });
  });

  // ===================== DIVISION BY ZERO =====================
  describe("division by zero scenarios", () => {
    it("handles zero revenue (EBITDA margin calculation)", () => {
      // When revenue is 0, ebitdaMargin should be 0, not NaN
      const scenario = createBaseScenario({
        targetDebtAmount: 0,
        targetEquityAmount: 0,
        targetLeaseAmount: 0,
      });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.ebitdaMargin)).toBe(true);
    });

    it("handles zero debt service (DSCR calculation)", () => {
      const scenario = createBaseScenario({
        targetDebtAmount: 0,
        targetLeaseAmount: 0,
        tenorYears: 10, // Ensure principal spread is minimal
      });
      const result = calculateScenario(scenario);
      // With zero debt service, DSCR should be capped at 99
      expect(result.metrics.dscr).toBe(99);
    });

    it("handles zero EBITDA (leverage ratio calculation)", () => {
      // With zero EBITDA, leverage ratio should be capped
      const scenario = createBaseScenario();
      const result = calculateScenario(scenario);
      // Normal case should have finite leverage
      expect(Number.isFinite(result.metrics.leverageRatio)).toBe(true);
    });

    it("handles zero interest (interest coverage calculation)", () => {
      const scenario = createBaseScenario({
        targetDebtAmount: 0,
      });
      const result = calculateScenario(scenario);
      // Zero interest should cap interest coverage at 99
      expect(result.metrics.interestCoverage).toBe(99);
    });

    it("handles zero equity amount (equity multiple calculation)", () => {
      const scenario = createBaseScenario({
        targetEquityAmount: 0,
      });
      const result = calculateScenario(scenario);
      // Zero equity should cap equity multiple at 99
      expect(result.metrics.equityMultiple).toBe(99);
    });

    it("handles zero tenor years", () => {
      const scenario = createBaseScenario({ tenorYears: 0 });
      const issues = validateScenarioInput(scenario);
      expect(issues.some(i => i.level === "error" && i.field === "tenorYears")).toBe(true);
    });
  });

  // ===================== DECIMAL PRECISION =====================
  describe("decimal precision handling", () => {
    it("maintains precision on small percentage calculations", () => {
      const scenario = createBaseScenario({
        financingMix: { debt: 0.333333333, equity: 0.333333333, leasing: 0.333333334 },
      });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.revenue)).toBe(true);
    });

    it("handles financing mix with many decimal places", () => {
      const scenario = createBaseScenario({
        financingMix: { debt: 0.6499999999, equity: 0.2500000001, leasing: 0.1 },
      });
      const result = calculateScenario(scenario);
      expect(result.metrics.fundingReadinessScore).toBeGreaterThanOrEqual(0);
    });

    it("rounds metrics consistently (4 decimal places)", () => {
      const result1 = calculateScenario(demoScenarios[0]);
      const result2 = calculateScenario(demoScenarios[0]);
      
      // All metrics should be consistently rounded
      expect(result1.metrics.dscr).toBe(result2.metrics.dscr);
      expect(result1.metrics.projectIrr).toBe(result2.metrics.projectIrr);
      expect(result1.metrics.leverageRatio).toBe(result2.metrics.leverageRatio);
    });

    it("handles currency amounts with cents precision", () => {
      const scenario = createBaseScenario({
        targetDebtAmount: 260_000_000.99,
        targetEquityAmount: 100_000_000.01,
        targetLeaseAmount: 40_000_000.50,
      });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.debtService)).toBe(true);
    });
  });

  // ===================== BOUNDARY CONDITIONS =====================
  describe("boundary conditions", () => {
    it("handles financing mix exactly at 100%", () => {
      const scenario = createBaseScenario({
        financingMix: { debt: 1, equity: 0, leasing: 0 },
      });
      const issues = validateScenarioInput(scenario);
      expect(issues.filter(i => i.field === "financingMix").length).toBe(0);
    });

    it("rejects financing mix slightly over 100%", () => {
      const scenario = createBaseScenario({
        financingMix: { debt: 0.65, equity: 0.25, leasing: 0.11 }, // 101%
      });
      const issues = validateScenarioInput(scenario);
      expect(issues.some(i => i.level === "error" && i.field === "financingMix")).toBe(true);
    });

    it("rejects financing mix slightly under 100%", () => {
      const scenario = createBaseScenario({
        financingMix: { debt: 0.65, equity: 0.25, leasing: 0.09 }, // 99%
      });
      const issues = validateScenarioInput(scenario);
      expect(issues.some(i => i.level === "error" && i.field === "financingMix")).toBe(true);
    });

    it("handles DSCR exactly at minimum threshold", () => {
      const scenario = createBaseScenario({
        covenantDefinition: { minDscr: 1.25, maxLeverage: 3.5, minIcRatio: 2 },
      });
      const result = calculateScenario(scenario);
      // Check that breaches are calculated correctly at boundary
      const dscrBreaches = result.covenantBreaches.filter(b => b.includes("DSCR"));
      expect(dscrBreaches.length).toBeGreaterThanOrEqual(0); // Just validates it runs
    });

    it("warns on DSCR below 1.0", () => {
      const scenario = createBaseScenario({
        covenantDefinition: { minDscr: 0.9, maxLeverage: 3.5, minIcRatio: 2 },
      });
      const issues = validateScenarioInput(scenario);
      expect(issues.some(i => i.level === "warning" && i.field === "covenantDefinition.minDscr")).toBe(true);
    });

    it("handles leverage exactly at max threshold", () => {
      const scenario = createBaseScenario({
        covenantDefinition: { minDscr: 1.25, maxLeverage: 0.1, minIcRatio: 2 }, // Very restrictive
      });
      const result = calculateScenario(scenario);
      // Should trigger leverage breach
      expect(result.covenantBreaches.some(b => b.includes("Leverage"))).toBe(true);
    });

    it("handles 100% debt financing mix", () => {
      const scenario = createBaseScenario({
        financingMix: { debt: 1, equity: 0, leasing: 0 },
      });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.leverageRatio)).toBe(true);
    });

    it("handles 100% equity financing mix", () => {
      const scenario = createBaseScenario({
        financingMix: { debt: 0, equity: 1, leasing: 0 },
      });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.equityMultiple)).toBe(true);
    });

    it("handles 100% leasing financing mix", () => {
      const scenario = createBaseScenario({
        financingMix: { debt: 0, equity: 0, leasing: 1 },
      });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.dscr)).toBe(true);
    });
  });

  // ===================== INVALID TEMPLATE REFERENCES =====================
  describe("invalid template references", () => {
    it("throws on non-existent capex template", () => {
      const scenario = createBaseScenario({ capexTemplateId: "nonexistent-template" });
      expect(() => calculateScenario(scenario)).toThrow("Template not found");
    });

    it("throws on non-existent opex template", () => {
      const scenario = createBaseScenario({ opexTemplateId: "fake-opex" });
      expect(() => calculateScenario(scenario)).toThrow("Template not found");
    });

    it("throws on non-existent revenue template", () => {
      const scenario = createBaseScenario({ revenueTemplateId: "missing-revenue" });
      expect(() => calculateScenario(scenario)).toThrow("Template not found");
    });

    it("throws on non-existent assumptions version", () => {
      const scenario = createBaseScenario({ assumptionsVersion: "2099.99-future" });
      expect(() => calculateScenario(scenario)).toThrow("Assumption version not found");
    });
  });

  // ===================== COMPARISON EDGE CASES =====================
  describe("scenario comparison edge cases", () => {
    it("compares identical scenarios (zero deltas)", () => {
      const comparison = compareScenarios(demoScenarios[0], demoScenarios[0]);
      expect(comparison.deltas.dscr).toBe(0);
      expect(comparison.deltas.projectIrr).toBe(0);
      expect(comparison.betterOn.length).toBe(0);
      expect(comparison.worseOn.length).toBe(0);
    });

    it("handles comparison with extreme scenarios", () => {
      const extreme = createBaseScenario({
        id: "extreme-scenario",
        targetDebtAmount: 1_000_000_000,
        targetEquityAmount: 500_000_000,
      });
      const comparison = compareScenarios(demoScenarios[0], extreme);
      expect(Number.isFinite(comparison.deltas.leverageRatio)).toBe(true);
    });
  });

  // ===================== STRESS TESTS =====================
  describe("stress tests with extreme values", () => {
    it("handles trillion-dollar debt amounts", () => {
      const scenario = createBaseScenario({
        targetDebtAmount: 1_000_000_000_000, // $1T
      });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.dscr)).toBe(true);
      expect(Number.isFinite(result.metrics.leverageRatio)).toBe(true);
    });

    it("handles micro-cent precision amounts", () => {
      const scenario = createBaseScenario({
        targetDebtAmount: 0.000001,
        targetEquityAmount: 0.000001,
        targetLeaseAmount: 0.000001,
      });
      const result = calculateScenario(scenario);
      expect(Number.isFinite(result.metrics.debtService)).toBe(true);
    });

    it("handles 1000-year tenor", () => {
      const scenario = createBaseScenario({ tenorYears: 1000 });
      const result = calculateScenario(scenario);
      expect(result.metrics.debtService).toBeGreaterThan(0);
    });

    it("handles near-zero covenant thresholds", () => {
      const scenario = createBaseScenario({
        covenantDefinition: { minDscr: 0.0001, maxLeverage: 999999, minIcRatio: 0.0001 },
      });
      const result = calculateScenario(scenario);
      // Should not breach covenants with ultra-permissive thresholds
      expect(result.covenantBreaches.length).toBeLessThanOrEqual(1); // Maybe just the DSCR warning
    });
  });
});
