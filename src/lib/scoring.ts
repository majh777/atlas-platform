import type { OpportunityCriteria, PipelineStage } from '@/types/opportunity';

const WEIGHTS: Record<keyof OpportunityCriteria, number> = {
  strategicFit: 0.3,
  sponsorCredibility: 0.2,
  regulatoryReadiness: 0.15,
  dealReadiness: 0.15,
  economics: 0.2,
};

const STAGE_PROBABILITY: Record<PipelineStage, number> = {
  Lead: 0.15,
  Qualified: 0.35,
  'IC Review': 0.55,
  Shortlist: 0.75,
  Won: 1,
  Lost: 0,
};

export function calculateOpportunityScore(criteria: OpportunityCriteria): number {
  const weighted = Object.entries(criteria).reduce((sum, [key, value]) => {
    return sum + value * WEIGHTS[key as keyof OpportunityCriteria];
  }, 0);

  return Math.round((weighted + Number.EPSILON) * 10);
}

export function inferProbability(stage: PipelineStage, score: number): number {
  // Lost deals always have 0% probability regardless of score
  if (stage === 'Lost') return 0;
  
  const base = STAGE_PROBABILITY[stage] * 100;
  const scoreAdjustment = (score - 50) * 0.4;
  return Math.max(0, Math.min(100, Math.round(base + scoreAdjustment)));
}

export function deriveTriageQueue(score: number): 'Hot' | 'Warm' | 'Cold' {
  if (score >= 75) return 'Hot';
  if (score >= 55) return 'Warm';
  return 'Cold';
}

export function deriveICReadiness(stage: PipelineStage, score: number): number {
  const gateBias = stage === 'IC Review' || stage === 'Shortlist' || stage === 'Won' ? 20 : 0;
  return Math.max(0, Math.min(100, score + gateBias));
}

export function probabilityWeightedValue(estimatedValueUsd: number, probability: number): number {
  return Math.round((estimatedValueUsd * probability) / 100);
}
