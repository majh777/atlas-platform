import { describe, expect, it } from 'vitest';
import { calculateScenario, compareScenarios } from '@/lib/finance/calculations';
import { exportScenarioToCsv, importScenarioCsv } from '@/lib/finance/csv';
import { demoScenarios } from '@/lib/finance/demo-data';
import { POST as compareRoute } from '@/app/api/scenarios/compare/route';
import { POST as scenariosRoute } from '@/app/api/scenarios/route';

describe('financial modelling engine', () => {
  it('generates deterministic fingerprints', () => {
    const first = calculateScenario(demoScenarios[0]);
    const second = calculateScenario(demoScenarios[0]);

    expect(first.audit.fingerprint).toBe(second.audit.fingerprint);
    expect(first.metrics.dscr).toBeGreaterThan(1);
    expect(first.sensitivity.length).toBeGreaterThanOrEqual(3);
  });

  it('returns deltas across core metrics', () => {
    const comparison = compareScenarios(demoScenarios[0], demoScenarios[1]);

    expect(comparison.baseId).toBe(demoScenarios[0].id);
    expect(comparison.candidateId).toBe(demoScenarios[1].id);
    expect(Object.keys(comparison.deltas)).toContain('projectIrr');
  });

  it('supports csv export/import compatibility', () => {
    const result = calculateScenario(demoScenarios[0]);
    const csv = exportScenarioToCsv(result);
    const imported = importScenarioCsv(csv);

    expect(imported.scenario_id).toBe(demoScenarios[0].id);
    expect(imported.funding_structure).toBe(demoScenarios[0].fundingStructure);
  });

  it('validates malformed funding mixes through the scenarios API', async () => {
    const invalid = {
      ...demoScenarios[0],
      financingMix: { debt: 0.5, equity: 0.5, leasing: 0.5 },
    };
    const request = new Request('http://localhost/api/scenarios', {
      method: 'POST',
      body: JSON.stringify(invalid),
      headers: { 'content-type': 'application/json' },
    });

    const response = await scenariosRoute(request as never);
    expect(response.status).toBe(400);
  });

  it('returns JSON from the scenario comparison API', async () => {
    const request = new Request('http://localhost/api/scenarios/compare', {
      method: 'POST',
      body: JSON.stringify({ base: demoScenarios[0], candidate: demoScenarios[1] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await compareRoute(request as never);
    const json = await response.json();
    expect(json.baseId).toBe(demoScenarios[0].id);
  });
});
