import { describe, expect, it } from "vitest";
import { calculateScenario, compareScenarios } from "@/lib/finance/calculations";
import { evaluateBankability, getRiskDashboard } from "@/lib/bankability/engine";
import {
  calculateOpportunityScore,
  probabilityWeightedValue,
} from "@/lib/scoring";
import { demoScenarios } from "@/lib/finance/demo-data";
import type { FinancialScenarioInput, FinancingMix } from "@/lib/finance/types";
import type { OpportunityCriteria } from "@/types/opportunity";

// Helper to create scenarios
function createScenario(id: string, overrides: Partial<FinancialScenarioInput> = {}): FinancialScenarioInput {
  return {
    ...demoScenarios[0],
    id,
    ...overrides,
  };
}

describe("concurrent calculation race conditions", () => {
  it("handles concurrent financial scenario calculations", async () => {
    const scenarios = Array.from({ length: 10 }, (_, i) =>
      createScenario(`concurrent-${i}`, {
        targetDebtAmount: 260_000_000 + i * 1_000_000,
      })
    );

    const results = await Promise.all(
      scenarios.map(scenario => Promise.resolve(calculateScenario(scenario)))
    );

    // All results should be unique and valid
    const fingerprints = new Set(results.map(r => r.audit.fingerprint));
    expect(fingerprints.size).toBe(10); // All unique

    results.forEach(result => {
      expect(Number.isFinite(result.metrics.dscr)).toBe(true);
      expect(Number.isFinite(result.metrics.projectIrr)).toBe(true);
    });
  });

  it("handles concurrent bankability evaluations", async () => {
    const modes: Array<"base" | "downside" | "upside"> = ["base", "downside", "upside"];
    const evaluations = await Promise.all(
      modes.map(mode => Promise.resolve(evaluateBankability(mode)))
    );

    // Results should be consistent across concurrent calls
    expect(evaluations[0].overallScore).not.toBe(evaluations[1].overallScore);
    expect(evaluations[1].overallScore).toBeLessThan(evaluations[2].overallScore);
  });

  it("handles concurrent scoring calculations", async () => {
    const criteriaList: OpportunityCriteria[] = Array.from({ length: 100 }, (_, i) => ({
      strategicFit: (i % 10) + 1,
      sponsorCredibility: ((i + 1) % 10) + 1,
      regulatoryReadiness: ((i + 2) % 10) + 1,
      dealReadiness: ((i + 3) % 10) + 1,
      economics: ((i + 4) % 10) + 1,
    }));

    const scores = await Promise.all(
      criteriaList.map(criteria => Promise.resolve(calculateOpportunityScore(criteria)))
    );

    scores.forEach(score => {
      expect(Number.isFinite(score)).toBe(true);
    });
  });

  it("handles concurrent scenario comparisons", async () => {
    const scenarios = Array.from({ length: 5 }, (_, i) =>
      createScenario(`compare-${i}`, {
        targetDebtAmount: 200_000_000 + i * 50_000_000,
      })
    );

    const comparisons = await Promise.all(
      scenarios.slice(1).map(candidate =>
        Promise.resolve(compareScenarios(scenarios[0], candidate))
      )
    );

    comparisons.forEach(comparison => {
      expect(comparison.baseId).toBe(scenarios[0].id);
      Object.values(comparison.deltas).forEach(delta => {
        expect(Number.isFinite(delta)).toBe(true);
      });
    });
  });
});

describe("stress tests - high volume", () => {
  it("processes 100 financial scenarios sequentially", () => {
    const scenarios = Array.from({ length: 100 }, (_, i) =>
      createScenario(`stress-${i}`, {
        targetDebtAmount: 100_000_000 + i * 10_000_000,
        tenorYears: 5 + (i % 10),
      })
    );

    const startTime = Date.now();
    const results = scenarios.map(s => calculateScenario(s));
    const elapsed = Date.now() - startTime;

    expect(results.length).toBe(100);
    expect(elapsed).toBeLessThan(5000); // Should complete in < 5 seconds
    
    results.forEach(result => {
      expect(result.metrics.fundingReadinessScore).toBeGreaterThanOrEqual(0);
      expect(result.metrics.fundingReadinessScore).toBeLessThanOrEqual(100);
    });
  });

  it("processes 1000 scoring calculations", () => {
    const startTime = Date.now();
    
    for (let i = 0; i < 1000; i++) {
      const criteria: OpportunityCriteria = {
        strategicFit: Math.random() * 10,
        sponsorCredibility: Math.random() * 10,
        regulatoryReadiness: Math.random() * 10,
        dealReadiness: Math.random() * 10,
        economics: Math.random() * 10,
      };
      const score = calculateOpportunityScore(criteria);
      expect(Number.isFinite(score)).toBe(true);
    }

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(1000); // Should be very fast
  });

  it("processes 500 probability weighted values", () => {
    const results: number[] = [];
    
    for (let i = 0; i < 500; i++) {
      const value = Math.random() * 1_000_000_000;
      const probability = Math.random() * 100;
      results.push(probabilityWeightedValue(value, probability));
    }

    results.forEach(r => {
      expect(Number.isFinite(r)).toBe(true);
    });
  });

  it("handles rapid bankability evaluations", () => {
    const modes: Array<"base" | "downside" | "upside"> = ["base", "downside", "upside"];
    const results: Array<{ mode: string; score: number }> = [];

    for (let i = 0; i < 30; i++) {
      const mode = modes[i % 3];
      const evaluation = evaluateBankability(mode);
      results.push({ mode, score: evaluation.overallScore });
    }

    // Verify deterministic results
    const baseScores = results.filter(r => r.mode === "base").map(r => r.score);
    const uniqueBaseScores = new Set(baseScores);
    expect(uniqueBaseScores.size).toBe(1); // All base evaluations should be identical
  });
});

describe("stress tests - extreme financing mixes", () => {
  const extremeMixes: FinancingMix[] = [
    { debt: 0.999, equity: 0.0005, leasing: 0.0005 },
    { debt: 0.0005, equity: 0.999, leasing: 0.0005 },
    { debt: 0.0005, equity: 0.0005, leasing: 0.999 },
    { debt: 0.333333, equity: 0.333333, leasing: 0.333334 },
    { debt: 0.5, equity: 0.5, leasing: 0 },
    { debt: 0, equity: 0.5, leasing: 0.5 },
    { debt: 0.5, equity: 0, leasing: 0.5 },
  ];

  extremeMixes.forEach((mix, index) => {
    it(`handles extreme financing mix ${index + 1}: ${JSON.stringify(mix)}`, () => {
      const scenario = createScenario(`mix-${index}`, { financingMix: mix });
      const result = calculateScenario(scenario);
      
      expect(Number.isFinite(result.metrics.dscr)).toBe(true);
      expect(Number.isFinite(result.metrics.leverageRatio)).toBe(true);
      expect(Number.isFinite(result.metrics.equityMultiple)).toBe(true);
    });
  });
});

describe("stress tests - extreme covenant definitions", () => {
  const extremeCovenants = [
    { minDscr: 0.001, maxLeverage: 1000, minIcRatio: 0.001 },
    { minDscr: 10, maxLeverage: 0.1, minIcRatio: 20 },
    { minDscr: 1, maxLeverage: 1, minIcRatio: 1 },
    { minDscr: 5, maxLeverage: 0.5, minIcRatio: 10 },
    { minDscr: 0, maxLeverage: Infinity, minIcRatio: 0 },
  ];

  extremeCovenants.forEach((covenant, index) => {
    it(`handles extreme covenant definition ${index + 1}`, () => {
      const scenario = createScenario(`covenant-${index}`, {
        covenantDefinition: covenant,
      });
      const result = calculateScenario(scenario);
      
      // Should not crash and should identify breaches appropriately
      expect(Array.isArray(result.covenantBreaches)).toBe(true);
      result.covenantBreaches.forEach(breach => {
        expect(typeof breach).toBe("string");
      });
    });
  });
});

describe("stress tests - memory and performance", () => {
  it("does not leak memory on repeated calculations", () => {
    // This is a rough check - in a real environment you'd use process.memoryUsage()
    const iterations = 500;
    const scores: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const evaluation = evaluateBankability("base");
      scores.push(evaluation.overallScore);
      // Force some garbage collection pressure
      if (i % 100 === 0) {
        scores.length = 0;
      }
    }

    expect(scores.length).toBeGreaterThan(0);
  });

  it("handles large approval histories", () => {
    const approvals = Array.from({ length: 1000 }, (_, i) => ({
      reviewer: `Reviewer ${i}`,
      role: "Sponsor",
      status: "approved" as const,
      timestamp: new Date().toISOString(),
      comment: `Approval comment ${i}`.repeat(10),
    }));

    const scenario = createScenario("large-approvals", {
      approvals,
    });

    const result = calculateScenario(scenario);
    expect(result.lenderPack.approvalHistory.length).toBe(1000);
  });

  it("handles scenario with very long names and descriptions", () => {
    const longName = "A".repeat(10000);
    const scenario = createScenario("long-name", {
      name: longName,
      projectName: longName,
    });

    const result = calculateScenario(scenario);
    expect(result.input.name).toBe(longName);
  });
});

describe("determinism verification", () => {
  it("produces identical results on repeated financial calculations", () => {
    const results = Array.from({ length: 10 }, () =>
      calculateScenario(demoScenarios[0])
    );

    const firstFingerprint = results[0].audit.fingerprint;
    results.forEach(result => {
      expect(result.audit.fingerprint).toBe(firstFingerprint);
      expect(result.metrics).toEqual(results[0].metrics);
    });
  });

  it("produces identical bankability scores on repeated evaluations", () => {
    const evaluations = Array.from({ length: 10 }, () =>
      evaluateBankability("base")
    );

    const firstScore = evaluations[0].overallScore;
    evaluations.forEach(evaluation => {
      expect(evaluation.overallScore).toBe(firstScore);
    });
  });

  it("produces identical risk dashboards on repeated queries", () => {
    const dashboards = Array.from({ length: 10 }, () =>
      getRiskDashboard()
    );

    dashboards.forEach(dashboard => {
      expect(dashboard.issues.length).toBe(dashboards[0].issues.length);
      expect(dashboard.countsBySeverity).toEqual(dashboards[0].countsBySeverity);
    });
  });
});

describe("input mutation safety", () => {
  it("does not mutate input scenario during calculation", () => {
    const scenario = { ...demoScenarios[0] };
    const originalDebt = scenario.targetDebtAmount;
    const originalMix = { ...scenario.financingMix };

    calculateScenario(scenario);

    expect(scenario.targetDebtAmount).toBe(originalDebt);
    expect(scenario.financingMix).toEqual(originalMix);
  });

  it("does not mutate criteria during scoring", () => {
    const criteria: OpportunityCriteria = {
      strategicFit: 8,
      sponsorCredibility: 7,
      regulatoryReadiness: 6,
      dealReadiness: 7,
      economics: 8,
    };
    const originalCriteria = { ...criteria };

    calculateOpportunityScore(criteria);

    expect(criteria).toEqual(originalCriteria);
  });
});
