import { describe, expect, it } from "vitest";
import {
  calculateOpportunityScore,
  deriveICReadiness,
  deriveTriageQueue,
  inferProbability,
  probabilityWeightedValue,
} from "@/lib/scoring";
import type { OpportunityCriteria, PipelineStage } from "@/types/opportunity";

describe("adversarial scoring engine - edge cases", () => {
  // ===================== NEGATIVE INPUTS =====================
  describe("negative input handling", () => {
    it("handles negative criteria scores", () => {
      const criteria: OpportunityCriteria = {
        strategicFit: -10,
        sponsorCredibility: -5,
        regulatoryReadiness: -3,
        dealReadiness: -8,
        economics: -2,
      };
      const score = calculateOpportunityScore(criteria);
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeLessThan(0);
    });

    it("handles mixed positive and negative criteria", () => {
      const criteria: OpportunityCriteria = {
        strategicFit: 10,
        sponsorCredibility: -5,
        regulatoryReadiness: 7,
        dealReadiness: -3,
        economics: 8,
      };
      const score = calculateOpportunityScore(criteria);
      expect(Number.isFinite(score)).toBe(true);
    });

    it("handles negative estimated value for probability weighting", () => {
      const result = probabilityWeightedValue(-100_000_000, 50);
      expect(result).toBe(-50_000_000);
    });

    it("handles negative probability", () => {
      const result = probabilityWeightedValue(100_000_000, -25);
      expect(result).toBe(-25_000_000);
    });

    it("handles negative score for IC readiness", () => {
      const result = deriveICReadiness("Lead", -50);
      expect(result).toBe(0); // Should clamp to 0
    });

    it("handles negative score for triage queue", () => {
      const result = deriveTriageQueue(-100);
      expect(result).toBe("Cold"); // Very negative should be Cold
    });
  });

  // ===================== EXTREME VALUES =====================
  describe("extreme value handling", () => {
    it("handles maximum criteria scores", () => {
      const criteria: OpportunityCriteria = {
        strategicFit: Number.MAX_SAFE_INTEGER,
        sponsorCredibility: Number.MAX_SAFE_INTEGER,
        regulatoryReadiness: Number.MAX_SAFE_INTEGER,
        dealReadiness: Number.MAX_SAFE_INTEGER,
        economics: Number.MAX_SAFE_INTEGER,
      };
      const score = calculateOpportunityScore(criteria);
      expect(Number.isFinite(score)).toBe(true);
    });

    it("handles minimum safe integer criteria", () => {
      const criteria: OpportunityCriteria = {
        strategicFit: Number.MIN_SAFE_INTEGER,
        sponsorCredibility: Number.MIN_SAFE_INTEGER,
        regulatoryReadiness: Number.MIN_SAFE_INTEGER,
        dealReadiness: Number.MIN_SAFE_INTEGER,
        economics: Number.MIN_SAFE_INTEGER,
      };
      const score = calculateOpportunityScore(criteria);
      expect(Number.isFinite(score)).toBe(true);
    });

    it("handles trillion-dollar valuations", () => {
      const result = probabilityWeightedValue(1_000_000_000_000, 75);
      expect(result).toBe(750_000_000_000);
    });

    it("handles probability over 100%", () => {
      const result = probabilityWeightedValue(100_000_000, 150);
      expect(result).toBe(150_000_000);
    });

    it("handles very high score for IC readiness clamping", () => {
      const result = deriveICReadiness("IC Review", 200);
      expect(result).toBe(100); // Should clamp to 100
    });
  });

  // ===================== BOUNDARY CONDITIONS =====================
  describe("boundary conditions", () => {
    it("handles exact Hot threshold (75)", () => {
      expect(deriveTriageQueue(75)).toBe("Hot");
    });

    it("handles just below Hot threshold (74)", () => {
      expect(deriveTriageQueue(74)).toBe("Warm");
    });

    it("handles exact Warm threshold (55)", () => {
      expect(deriveTriageQueue(55)).toBe("Warm");
    });

    it("handles just below Warm threshold (54)", () => {
      expect(deriveTriageQueue(54)).toBe("Cold");
    });

    it("handles zero score", () => {
      expect(deriveTriageQueue(0)).toBe("Cold");
    });

    it("handles exact 100 score", () => {
      expect(deriveTriageQueue(100)).toBe("Hot");
    });

    it("handles IC readiness at exact 100 before gate bias", () => {
      const result = deriveICReadiness("IC Review", 80);
      expect(result).toBe(100); // 80 + 20 gate bias = 100
    });

    it("handles IC readiness that would exceed 100 with gate bias", () => {
      const result = deriveICReadiness("Shortlist", 90);
      expect(result).toBe(100); // Should clamp
    });

    it("handles IC readiness at zero", () => {
      const result = deriveICReadiness("Lead", 0);
      expect(result).toBe(0);
    });
  });

  // ===================== ZERO VALUES =====================
  describe("zero value handling", () => {
    it("handles all zero criteria", () => {
      const criteria: OpportunityCriteria = {
        strategicFit: 0,
        sponsorCredibility: 0,
        regulatoryReadiness: 0,
        dealReadiness: 0,
        economics: 0,
      };
      const score = calculateOpportunityScore(criteria);
      expect(score).toBe(0);
    });

    it("handles zero estimated value", () => {
      const result = probabilityWeightedValue(0, 75);
      expect(result).toBe(0);
    });

    it("handles zero probability", () => {
      const result = probabilityWeightedValue(100_000_000, 0);
      expect(result).toBe(0);
    });

    it("handles zero score for IC readiness", () => {
      const result = deriveICReadiness("Lead", 0);
      expect(result).toBe(0);
    });
  });

  // ===================== STAGE TRANSITIONS =====================
  describe("pipeline stage probability", () => {
    const stages: PipelineStage[] = ["Lead", "Qualified", "IC Review", "Shortlist", "Won", "Lost"];
    
    it("probability increases through pipeline (except Lost)", () => {
      const score = 50;
      const leadProb = inferProbability("Lead", score);
      const qualifiedProb = inferProbability("Qualified", score);
      const icReviewProb = inferProbability("IC Review", score);
      const shortlistProb = inferProbability("Shortlist", score);
      const wonProb = inferProbability("Won", score);
      
      expect(qualifiedProb).toBeGreaterThan(leadProb);
      expect(icReviewProb).toBeGreaterThan(qualifiedProb);
      expect(shortlistProb).toBeGreaterThan(icReviewProb);
      expect(wonProb).toBeGreaterThan(shortlistProb);
    });

    it("Lost stage always returns 0", () => {
      expect(inferProbability("Lost", 100)).toBe(0);
      expect(inferProbability("Lost", 0)).toBe(0);
      expect(inferProbability("Lost", 50)).toBe(0);
    });

    it("Won stage returns 100 with high score", () => {
      const result = inferProbability("Won", 50);
      expect(result).toBe(100); // Base 100 + 0 adjustment
    });

    it("probability never goes negative", () => {
      stages.forEach(stage => {
        const result = inferProbability(stage, -1000);
        expect(result).toBeGreaterThanOrEqual(0);
      });
    });

    it("probability never exceeds 100", () => {
      stages.forEach(stage => {
        const result = inferProbability(stage, 1000);
        expect(result).toBeLessThanOrEqual(100);
      });
    });
  });

  // ===================== DECIMAL PRECISION =====================
  describe("decimal precision", () => {
    it("handles fractional criteria values", () => {
      const criteria: OpportunityCriteria = {
        strategicFit: 8.5,
        sponsorCredibility: 7.3,
        regulatoryReadiness: 6.9,
        dealReadiness: 8.1,
        economics: 7.7,
      };
      const score = calculateOpportunityScore(criteria);
      expect(Number.isInteger(score)).toBe(true); // Should round
    });

    it("handles very small fractional differences", () => {
      const criteria1: OpportunityCriteria = {
        strategicFit: 8.0000001,
        sponsorCredibility: 7,
        regulatoryReadiness: 6,
        dealReadiness: 7,
        economics: 8,
      };
      const criteria2: OpportunityCriteria = {
        strategicFit: 8.0000002,
        sponsorCredibility: 7,
        regulatoryReadiness: 6,
        dealReadiness: 7,
        economics: 8,
      };
      const score1 = calculateOpportunityScore(criteria1);
      const score2 = calculateOpportunityScore(criteria2);
      // Tiny differences should produce same rounded result
      expect(score1).toBe(score2);
    });

    it("handles probability weighting with cents precision", () => {
      const result = probabilityWeightedValue(100_000_000.99, 62.5);
      expect(Number.isInteger(result)).toBe(true); // Should round
    });
  });

  // ===================== WEIGHT VALIDATION =====================
  describe("weight consistency", () => {
    it("all criteria equally weighted produces expected result", () => {
      // With weights: strategicFit=0.3, sponsorCredibility=0.2, regulatoryReadiness=0.15, 
      // dealReadiness=0.15, economics=0.2
      // Total = 1.0 (100%)
      const criteria: OpportunityCriteria = {
        strategicFit: 10,
        sponsorCredibility: 10,
        regulatoryReadiness: 10,
        dealReadiness: 10,
        economics: 10,
      };
      const score = calculateOpportunityScore(criteria);
      // 10 * 1.0 * 10 (multiplied by 10 in function) = 100
      expect(score).toBe(100);
    });

    it("single criteria contribution is proportional to weight", () => {
      // strategicFit has weight 0.3
      const criteria: OpportunityCriteria = {
        strategicFit: 10,
        sponsorCredibility: 0,
        regulatoryReadiness: 0,
        dealReadiness: 0,
        economics: 0,
      };
      const score = calculateOpportunityScore(criteria);
      expect(score).toBe(30); // 10 * 0.3 * 10 = 30
    });
  });

  // ===================== ROUNDING BEHAVIOR =====================
  describe("rounding behavior", () => {
    it("rounds up at .5", () => {
      const criteria: OpportunityCriteria = {
        strategicFit: 7.5,
        sponsorCredibility: 7.5,
        regulatoryReadiness: 7.5,
        dealReadiness: 7.5,
        economics: 7.5,
      };
      const score = calculateOpportunityScore(criteria);
      // 7.5 * (0.3+0.2+0.15+0.15+0.2) * 10 = 75
      expect(score).toBe(75);
    });

    it("handles epsilon near boundary", () => {
      // Test Number.EPSILON handling
      const criteria: OpportunityCriteria = {
        strategicFit: 7.5 + Number.EPSILON,
        sponsorCredibility: 7.5,
        regulatoryReadiness: 7.5,
        dealReadiness: 7.5,
        economics: 7.5,
      };
      const score = calculateOpportunityScore(criteria);
      expect(Number.isInteger(score)).toBe(true);
    });
  });
});
