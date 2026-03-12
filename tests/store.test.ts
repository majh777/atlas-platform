import { describe, expect, it } from 'vitest';
import { buildCommitteePack, getCrmSyncHooks, opportunityStore } from '@/lib/opportunity-store';

describe('opportunity store', () => {
  it('creates and retrieves an opportunity', () => {
    const created = opportunityStore.create({
      name: 'Guinea Green Iron Platform',
      country: 'Guinea',
      sector: 'Steel & Mining',
      sponsor: 'Simandou Partners',
      sponsorType: 'Strategic',
      stage: 'Lead',
      estimatedValueUsd: 120_000_000,
      probability: 0,
      owner: 'Origination Desk',
      notes: 'Green steel linked opportunity.',
      relationshipNotes: ['Met sponsor adviser in Dubai'],
      watchlist: true,
      targetList: 'West Africa Metals',
      triageQueue: 'Warm',
      icReadiness: 0,
      criteria: {
        strategicFit: 8,
        sponsorCredibility: 7,
        regulatoryReadiness: 5,
        dealReadiness: 5,
        economics: 8,
      },
      stageGates: ['Initial screening'],
      externalSignals: [],
      crmSyncStatus: 'pending',
    });

    expect(opportunityStore.get(created.id)?.name).toBe('Guinea Green Iron Platform');
    expect(created.score).toBeGreaterThan(0);
    expect(created.triageQueue).toBe('Warm');
  });

  it('filters and updates opportunities', () => {
    const filtered = opportunityStore.list({ country: 'Cameroon' });
    expect(filtered.length).toBeGreaterThan(0);

    const target = filtered[0];
    const updated = opportunityStore.update(target.id, { stage: 'Shortlist' });
    expect(updated?.stage).toBe('Shortlist');
    expect(updated?.probability).toBeGreaterThanOrEqual(75);
  });

  it('generates committee packs and crm hooks', () => {
    const opportunity = opportunityStore.list()[0];
    expect(buildCommitteePack(opportunity)).toContain(opportunity.name);
    expect(getCrmSyncHooks(opportunity)).toHaveLength(3);
  });

  it('ingests external signals into the queue', () => {
    const created = opportunityStore.ingestSignal({
      name: 'Congo Logistics Spur',
      country: 'Republic of the Congo',
      sector: 'Logistics',
      sponsor: 'Corridor Holdings',
      sponsorType: 'Financial',
      source: 'Broker channel',
      headline: 'New logistics spur mandated for prefeasibility review',
      type: 'broker',
    });

    expect(created?.externalSignals[0].headline).toContain('prefeasibility');
    expect(created?.watchlist).toBe(true);
  });
});
