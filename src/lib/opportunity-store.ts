import type { Opportunity, OpportunityFilters, OpportunityInput, SignalType } from '@/types/opportunity';
import {
  calculateOpportunityScore,
  deriveICReadiness,
  deriveTriageQueue,
  inferProbability,
} from '@/lib/scoring';

const now = () => new Date().toISOString();
const makeId = () => Math.random().toString(36).slice(2, 10);

function hydrateOpportunity(input: OpportunityInput, id = makeId()): Opportunity {
  const score = calculateOpportunityScore(input.criteria);
  return {
    ...input,
    id,
    score,
    probability: input.probability || inferProbability(input.stage, score),
    triageQueue: deriveTriageQueue(score),
    icReadiness: deriveICReadiness(input.stage, score),
    crmSyncStatus: 'pending',
    createdAt: now(),
    updatedAt: now(),
  };
}

const seed: Opportunity[] = [
  hydrateOpportunity({
    name: 'Cameroon Bauxite Corridor',
    country: 'Cameroon',
    sector: 'Mining Infrastructure',
    sponsor: 'Panthera Logistics',
    sponsorType: 'Strategic',
    stage: 'IC Review',
    estimatedValueUsd: 180000000,
    probability: 62,
    owner: 'Origination Team',
    notes: 'Integrated rail-port corridor with sovereign counterpart interest.',
    relationshipNotes: ['Advisor to transport ministry engaged', 'Local EPC sponsor receptive to JV structure'],
    watchlist: true,
    targetList: 'Central Africa Priority',
    triageQueue: 'Hot',
    icReadiness: 80,
    criteria: {
      strategicFit: 9,
      sponsorCredibility: 8,
      regulatoryReadiness: 6,
      dealReadiness: 7,
      economics: 9,
    },
    stageGates: ['Mandate letter', 'Sovereign diligence pack', 'Base-case model'],
    externalSignals: [
      {
        id: makeId(),
        type: 'news',
        source: 'Regional Infra Bulletin',
        headline: 'Cabinet revives multi-modal mining corridor feasibility work',
        capturedAt: now(),
      },
    ],
    crmSyncStatus: 'pending',
  }),
  hydrateOpportunity({
    name: 'Gabon Manganese Upgrade',
    country: 'Gabon',
    sector: 'Metals Processing',
    sponsor: 'Ngondo Capital',
    sponsorType: 'Financial',
    stage: 'Qualified',
    estimatedValueUsd: 95000000,
    probability: 38,
    owner: 'Coverage Desk',
    notes: 'Processing plant expansion with export optimization angle.',
    relationshipNotes: ['Sponsor met in Paris roadshow', 'Requires environmental comfort before data room'],
    watchlist: false,
    targetList: 'Processing Platform',
    triageQueue: 'Warm',
    icReadiness: 58,
    criteria: {
      strategicFit: 7,
      sponsorCredibility: 7,
      regulatoryReadiness: 5,
      dealReadiness: 6,
      economics: 8,
    },
    stageGates: ['Management presentation', 'Indicative valuation range'],
    externalSignals: [],
    crmSyncStatus: 'pending',
  }),
];

class OpportunityStore {
  private opportunities = seed;

  list(filters: OpportunityFilters = {}) {
    return this.opportunities.filter((opportunity) => {
      const q = filters.q?.toLowerCase();
      const matchesQuery =
        !q ||
        [opportunity.name, opportunity.country, opportunity.sector, opportunity.sponsor]
          .join(' ')
          .toLowerCase()
          .includes(q);

      return (
        matchesQuery &&
        (!filters.country || opportunity.country === filters.country) &&
        (!filters.sector || opportunity.sector === filters.sector) &&
        (!filters.sponsorType || opportunity.sponsorType === filters.sponsorType) &&
        (!filters.stage || opportunity.stage === filters.stage)
      );
    });
  }

  get(id: string) {
    return this.opportunities.find((opportunity) => opportunity.id === id) ?? null;
  }

  create(input: OpportunityInput) {
    const opportunity = hydrateOpportunity(input);
    this.opportunities = [opportunity, ...this.opportunities];
    return opportunity;
  }

  update(id: string, patch: Partial<OpportunityInput>) {
    const current = this.get(id);
    if (!current) return null;

    const mergedInput: OpportunityInput = {
      ...current,
      ...patch,
      relationshipNotes: patch.relationshipNotes ?? current.relationshipNotes,
      stageGates: patch.stageGates ?? current.stageGates,
      externalSignals: patch.externalSignals ?? current.externalSignals,
      criteria: {
        ...current.criteria,
        ...patch.criteria,
      },
    };

    const score = calculateOpportunityScore(mergedInput.criteria);
    const updated: Opportunity = {
      ...current,
      ...mergedInput,
      score,
      triageQueue: deriveTriageQueue(score),
      icReadiness: deriveICReadiness(mergedInput.stage, score),
      probability: patch.probability ?? inferProbability(mergedInput.stage, score),
      crmSyncStatus: 'pending',
      updatedAt: now(),
    };

    this.opportunities = this.opportunities.map((opportunity) => (opportunity.id === id ? updated : opportunity));
    return updated;
  }

  remove(id: string) {
    const exists = this.get(id);
    if (!exists) return false;
    this.opportunities = this.opportunities.filter((opportunity) => opportunity.id !== id);
    return true;
  }

  ingestSignal(input: {
    name: string;
    country: string;
    sector: string;
    sponsor: string;
    sponsorType: Opportunity['sponsorType'];
    source: string;
    headline: string;
    type: SignalType;
  }) {
    const existing = this.opportunities.find((opportunity) => opportunity.name === input.name);
    const signal = { id: makeId(), type: input.type, source: input.source, headline: input.headline, capturedAt: now() };

    if (existing) {
      return this.update(existing.id, { externalSignals: [signal, ...existing.externalSignals] });
    }

    return this.create({
      name: input.name,
      country: input.country,
      sector: input.sector,
      sponsor: input.sponsor,
      sponsorType: input.sponsorType,
      stage: 'Lead',
      estimatedValueUsd: 50000000,
      probability: 0,
      owner: 'Signals Desk',
      notes: 'Auto-created from external signal ingestion.',
      relationshipNotes: [],
      watchlist: true,
      targetList: 'Signals Queue',
      triageQueue: 'Warm',
      icReadiness: 25,
      criteria: {
        strategicFit: 6,
        sponsorCredibility: 6,
        regulatoryReadiness: 4,
        dealReadiness: 3,
        economics: 5,
      },
      stageGates: ['Analyst triage', 'Intro outreach'],
      externalSignals: [signal],
      crmSyncStatus: 'pending',
    });
  }
}

export const opportunityStore = new OpportunityStore();

export function buildCommitteePack(opportunity: Opportunity) {
  return `# ${opportunity.name}\n\n- Stage: ${opportunity.stage}\n- Country: ${opportunity.country}\n- Sector: ${opportunity.sector}\n- Sponsor: ${opportunity.sponsor} (${opportunity.sponsorType})\n- Score: ${opportunity.score}/100\n- Probability: ${opportunity.probability}%\n\n## Rationale\n${opportunity.notes}\n\n## Stage gates\n${opportunity.stageGates.map((gate) => `- ${gate}`).join('\n')}\n\n## Relationship notes\n${opportunity.relationshipNotes.length ? opportunity.relationshipNotes.map((note) => `- ${note}`).join('\n') : '- None yet'}\n\n## External signals\n${opportunity.externalSignals.length ? opportunity.externalSignals.map((signal) => `- [${signal.type}] ${signal.headline} — ${signal.source}`).join('\n') : '- None'}\n`;
}

export function getCrmSyncHooks(opportunity: Opportunity) {
  return [
    `crm.opportunity.upsert:${opportunity.id}`,
    `crm.activity.sync:${opportunity.stage.toLowerCase().replace(/\s+/g, '-')}`,
    `crm.relationship.notes:${opportunity.relationshipNotes.length}`,
  ];
}
