export const PIPELINE_STAGES = ['Lead', 'Qualified', 'IC Review', 'Shortlist', 'Won', 'Lost'] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type SponsorType = 'Strategic' | 'Financial' | 'Family Office' | 'Government';
export type SignalType = 'news' | 'permit' | 'license' | 'broker' | 'advisor';

export type OpportunityCriteria = {
  strategicFit: number;
  sponsorCredibility: number;
  regulatoryReadiness: number;
  dealReadiness: number;
  economics: number;
};

export type Opportunity = {
  id: string;
  name: string;
  country: string;
  sector: string;
  sponsor: string;
  sponsorType: SponsorType;
  stage: PipelineStage;
  estimatedValueUsd: number;
  probability: number;
  owner: string;
  notes: string;
  relationshipNotes: string[];
  watchlist: boolean;
  targetList: string;
  triageQueue: 'Hot' | 'Warm' | 'Cold';
  icReadiness: number;
  criteria: OpportunityCriteria;
  score: number;
  stageGates: string[];
  externalSignals: Array<{
    id: string;
    type: SignalType;
    source: string;
    headline: string;
    capturedAt: string;
  }>;
  crmSyncStatus: 'pending' | 'synced';
  createdAt: string;
  updatedAt: string;
};

export type OpportunityInput = Omit<Opportunity, 'id' | 'score' | 'createdAt' | 'updatedAt'>;

export type OpportunityFilters = {
  q?: string;
  country?: string;
  sector?: string;
  sponsorType?: SponsorType;
  stage?: PipelineStage;
};
