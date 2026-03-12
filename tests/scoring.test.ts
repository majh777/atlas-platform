import { describe, expect, it } from 'vitest';
import {
  calculateOpportunityScore,
  deriveICReadiness,
  deriveTriageQueue,
  inferProbability,
  probabilityWeightedValue,
} from '@/lib/scoring';

describe('scoring engine', () => {
  it('calculates weighted score', () => {
    expect(
      calculateOpportunityScore({
        strategicFit: 9,
        sponsorCredibility: 8,
        regulatoryReadiness: 6,
        dealReadiness: 7,
        economics: 9,
      }),
    ).toBe(80);
  });

  it('maps score to triage queue', () => {
    expect(deriveTriageQueue(80)).toBe('Hot');
    expect(deriveTriageQueue(60)).toBe('Warm');
    expect(deriveTriageQueue(40)).toBe('Cold');
  });

  it('infers stage probability and weighted value', () => {
    expect(inferProbability('Shortlist', 79)).toBeGreaterThan(80);
    expect(probabilityWeightedValue(100_000_000, 62)).toBe(62_000_000);
  });

  it('boosts IC readiness at later stages', () => {
    expect(deriveICReadiness('Lead', 60)).toBe(60);
    expect(deriveICReadiness('IC Review', 60)).toBe(80);
  });
});
