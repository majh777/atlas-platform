/**
 * Integration Tests: Bankability Scoring and Risk Management
 * 
 * Tests the complete bankability evaluation workflow including
 * domain scoring, scenarios, red flags, and committee narratives.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateBankability,
  calculateDomainScores,
  calculateOverallScore,
  buildScenarioResults,
  buildReadinessScorecards,
  buildBenchmarkDeltas,
  buildCommitteeNarrative,
  explainCriterion,
  getRiskDashboard
} from '@/lib/bankability/engine';
import { getAtlasBankabilityContext, scenarios } from '@/lib/bankability/data';

describe('Bankability Scoring Engine - Full Evaluation', () => {
  it('step 1: evaluates complete bankability with all components', () => {
    const evaluation = evaluateBankability('base');

    expect(evaluation).toBeDefined();
    expect(evaluation.project).toBeDefined();
    expect(evaluation.scoringModel).toBeDefined();
    expect(evaluation.overallScore).toBeGreaterThan(0);
    expect(evaluation.overallScore).toBeLessThanOrEqual(100);
  });

  it('step 2: includes all 6 domain scores', () => {
    const evaluation = evaluateBankability('base');
    const domains = ['technical', 'commercial', 'financial', 'regulatory', 'esg', 'execution'];

    expect(evaluation.domainScores).toHaveLength(6);
    
    domains.forEach(domain => {
      const score = evaluation.domainScores.find(d => d.domain === domain);
      expect(score).toBeDefined();
      expect(score?.weightedScore).toBeGreaterThanOrEqual(0);
      expect(score?.weightedScore).toBeLessThanOrEqual(100);
      expect(score?.narrative).toBeTruthy();
    });
  });

  it('step 3: generates scenario comparisons (base/downside/upside)', () => {
    const evaluation = evaluateBankability('base');

    expect(evaluation.scenarios).toHaveLength(3);
    expect(evaluation.scenarios.map(s => s.mode)).toEqual(['base', 'downside', 'upside']);

    const base = evaluation.scenarios.find(s => s.mode === 'base');
    const downside = evaluation.scenarios.find(s => s.mode === 'downside');
    const upside = evaluation.scenarios.find(s => s.mode === 'upside');

    expect(base?.deltaVsBase).toBe(0);
    expect(downside?.overallScore).toBeLessThan(upside!.overallScore);
  });

  it('step 4: identifies red flag rules', () => {
    const evaluation = evaluateBankability('base');

    expect(evaluation.redFlags).toBeDefined();
    expect(Array.isArray(evaluation.redFlags)).toBe(true);
    
    if (evaluation.redFlags.length > 0) {
      const flag = evaluation.redFlags[0];
      expect(flag.id).toBeTruthy();
      expect(flag.label).toBeTruthy();
      expect(['low', 'medium', 'high', 'critical']).toContain(flag.severity);
    }
  });

  it('step 5: generates readiness scorecards', () => {
    const evaluation = evaluateBankability('base');

    expect(evaluation.readiness.length).toBeGreaterThanOrEqual(1);
    
    evaluation.readiness.forEach(card => {
      expect(card.targetId).toBeTruthy();
      expect(card.label).toBeTruthy();
      expect(['ready', 'progressing', 'not-ready']).toContain(card.status);
      expect(card.score).toBeGreaterThanOrEqual(0);
      expect(card.narrative).toBeTruthy();
    });
  });

  it('step 6: calculates benchmark deltas', () => {
    const evaluation = evaluateBankability('base');

    expect(evaluation.benchmarkDeltas).toHaveLength(6);
    
    evaluation.benchmarkDeltas.forEach(delta => {
      expect(delta.domain).toBeTruthy();
      expect(typeof delta.actual).toBe('number');
      expect(typeof delta.benchmark).toBe('number');
      expect(delta.gap).toBe(Number((delta.actual - delta.benchmark).toFixed(1)));
    });
  });

  it('step 7: generates committee narrative with recommendations', () => {
    const evaluation = evaluateBankability('base');

    expect(evaluation.committeeNarrative).toBeDefined();
    expect(evaluation.committeeNarrative.headline).toBeTruthy();
    expect(['support', 'conditional', 'hold']).toContain(evaluation.committeeNarrative.tone);
    expect(evaluation.committeeNarrative.summary).toBeTruthy();
    expect(evaluation.committeeNarrative.strengths.length).toBeGreaterThanOrEqual(1);
    expect(evaluation.committeeNarrative.watchouts.length).toBeGreaterThanOrEqual(1);
    expect(evaluation.committeeNarrative.evidenceLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('step 8: generates export pack for lender presentation', () => {
    const evaluation = evaluateBankability('base');

    expect(evaluation.exportPack).toBeTruthy();
    expect(evaluation.exportPack).toContain('Board / Lender Pack');
    expect(evaluation.exportPack).toContain('Project Snapshot');
    expect(evaluation.exportPack).toContain('Overall Bankability');
    expect(evaluation.exportPack).toContain('Readiness Scorecards');
    expect(evaluation.exportPack).toContain('Scenario Summary');
    expect(evaluation.exportPack).toContain('Benchmark Gaps');
    expect(evaluation.exportPack).toContain('Risk Actions');
  });
});

describe('Bankability Domain Scoring', () => {
  const context = getAtlasBankabilityContext();

  it('step 1: calculates weighted domain scores', () => {
    const domainScores = calculateDomainScores(context, scenarios[0]);

    expect(domainScores).toHaveLength(6);
    
    domainScores.forEach(score => {
      expect(score.weightedScore).toBeGreaterThanOrEqual(0);
      expect(score.weightedScore).toBeLessThanOrEqual(100);
      expect(typeof score.flagged).toBe('boolean');
    });
  });

  it('step 2: calculates evidence coverage per domain', () => {
    const domainScores = calculateDomainScores(context, scenarios[0]);

    domainScores.forEach(score => {
      expect(score.evidenceCoverage).toBeGreaterThanOrEqual(0);
      expect(score.evidenceCoverage).toBeLessThanOrEqual(100);
    });
  });

  it('step 3: identifies flagged domains with active issues', () => {
    const domainScores = calculateDomainScores(context, scenarios[0]);
    const flaggedDomains = domainScores.filter(d => d.flagged);

    flaggedDomains.forEach(flagged => {
      expect(flagged.narrative).toContain('Red-flag conditions remain active');
    });
  });

  it('step 4: calculates overall score from domain weights', () => {
    const domainScores = calculateDomainScores(context, scenarios[0]);
    const overall = calculateOverallScore(domainScores, context);

    expect(overall).toBeGreaterThan(0);
    expect(overall).toBeLessThanOrEqual(100);

    // Verify it's a weighted average
    const manualCalc = domainScores.reduce((sum, score) => {
      return sum + score.weightedScore * context.scoringModel.domainWeights[score.domain];
    }, 0);

    expect(overall).toBeCloseTo(manualCalc, 1);
  });
});

describe('Bankability Scenario Analysis', () => {
  it('step 1: downside scenario reduces scores', () => {
    const downside = evaluateBankability('downside');
    const base = evaluateBankability('base');

    expect(downside.overallScore).toBeLessThan(base.overallScore);
  });

  it('step 2: upside scenario improves scores', () => {
    const upside = evaluateBankability('upside');
    const base = evaluateBankability('base');

    expect(upside.overallScore).toBeGreaterThan(base.overallScore);
  });

  it('step 3: scenario deltas are consistent', () => {
    const context = getAtlasBankabilityContext();
    const results = buildScenarioResults(context);

    expect(results).toHaveLength(3);
    expect(results[0].deltaVsBase).toBe(0); // Base vs base = 0

    const downside = results.find(r => r.mode === 'downside');
    const upside = results.find(r => r.mode === 'upside');

    expect(downside?.deltaVsBase).toBeLessThan(0);
    expect(upside?.deltaVsBase).toBeGreaterThan(0);
  });

  it('step 4: scenarios include narratives', () => {
    const context = getAtlasBankabilityContext();
    const results = buildScenarioResults(context);

    results.forEach(scenario => {
      expect(scenario.narrative).toBeTruthy();
      expect(scenario.narrative).toContain(scenario.mode);
      expect(scenario.narrative).toContain('Overall score');
    });
  });
});

describe('Bankability Criterion Explanation', () => {
  const context = getAtlasBankabilityContext();

  it('step 1: explains criterion with evidence links', () => {
    const explanation = explainCriterion(context, 'fin-dscr');

    expect(explanation).toBeDefined();
    expect(explanation?.criterionId).toBe('fin-dscr');
    expect(explanation?.label).toBeTruthy();
    expect(explanation?.score).toBeGreaterThanOrEqual(0);
    expect(explanation?.threshold).toBeGreaterThan(0);
    expect(explanation?.evidence.length).toBeGreaterThanOrEqual(0);
  });

  it('step 2: identifies gap vs threshold', () => {
    const explanation = explainCriterion(context, 'fin-dscr');

    expect(explanation?.gap).toBeDefined();
    expect(explanation?.gap).toBe(explanation!.score - explanation!.threshold);
  });

  it('step 3: provides remediation guidance for below-threshold', () => {
    // Find a criterion below threshold
    const criterion = context.scoringModel.criteria.find(c => c.score < c.threshold);
    
    if (criterion) {
      const explanation = explainCriterion(context, criterion.id);
      expect(explanation?.explanation).toContain('trails threshold');
      expect(explanation?.explanation).toContain('mitigation');
    }
  });

  it('step 4: returns null for unknown criterion', () => {
    const explanation = explainCriterion(context, 'non-existent-criterion');
    expect(explanation).toBeNull();
  });
});

describe('Risk Dashboard and Mitigation Register', () => {
  it('step 1: builds risk dashboard with issue counts', () => {
    const dashboard = getRiskDashboard();

    expect(dashboard).toBeDefined();
    expect(dashboard.issues.length).toBeGreaterThan(0);
    expect(dashboard.mitigationRegister.length).toBeGreaterThan(0);
  });

  it('step 2: counts issues by severity', () => {
    const dashboard = getRiskDashboard();

    expect(dashboard.countsBySeverity).toBeDefined();
    expect(typeof dashboard.countsBySeverity.low).toBe('number');
    expect(typeof dashboard.countsBySeverity.medium).toBe('number');
    expect(typeof dashboard.countsBySeverity.high).toBe('number');
    expect(typeof dashboard.countsBySeverity.critical).toBe('number');

    const totalBySeverity = Object.values(dashboard.countsBySeverity).reduce((a, b) => a + b, 0);
    expect(totalBySeverity).toBe(dashboard.issues.length);
  });

  it('step 3: counts issues by status', () => {
    const dashboard = getRiskDashboard();

    expect(dashboard.countsByStatus).toBeDefined();
    expect(typeof dashboard.countsByStatus.open).toBe('number');
    expect(typeof dashboard.countsByStatus.mitigating).toBe('number');
    expect(typeof dashboard.countsByStatus.closed).toBe('number');

    const totalByStatus = Object.values(dashboard.countsByStatus).reduce((a, b) => a + b, 0);
    expect(totalByStatus).toBe(dashboard.issues.length);
  });

  it('step 4: mitigation register has required fields', () => {
    const dashboard = getRiskDashboard();

    dashboard.mitigationRegister.forEach(action => {
      expect(action.id).toBeTruthy();
      expect(action.title).toBeTruthy();
      expect(action.owner).toBeTruthy();
      expect(action.status).toBeTruthy();
      expect(action.dueDate).toBeTruthy();
    });
  });

  it('step 5: issues have domain and severity', () => {
    const dashboard = getRiskDashboard();

    dashboard.issues.forEach(issue => {
      expect(issue.id).toBeTruthy();
      expect(issue.domain).toBeTruthy();
      expect(['low', 'medium', 'high', 'critical']).toContain(issue.severity);
      expect(['open', 'mitigating', 'closed']).toContain(issue.status);
    });
  });
});

describe('Bankability Committee Narrative Generation', () => {
  const context = getAtlasBankabilityContext();
  const domainScores = calculateDomainScores(context, scenarios[0]);
  const overallScore = calculateOverallScore(domainScores, context);

  it('step 1: generates headline with bankability posture', () => {
    const narrative = buildCommitteeNarrative(context, overallScore, domainScores);

    expect(narrative.headline).toBeTruthy();
    expect(narrative.headline).toContain(context.project.name);
  });

  it('step 2: sets appropriate tone based on score', () => {
    const narrative = buildCommitteeNarrative(context, overallScore, domainScores);

    if (overallScore >= 75) {
      expect(narrative.tone).toBe('support');
    } else if (overallScore >= 60) {
      expect(narrative.tone).toBe('conditional');
    } else {
      expect(narrative.tone).toBe('hold');
    }
  });

  it('step 3: identifies strengths (top performing domains)', () => {
    const narrative = buildCommitteeNarrative(context, overallScore, domainScores);

    expect(narrative.strengths.length).toBeGreaterThanOrEqual(1);
    narrative.strengths.forEach(strength => {
      expect(strength).toContain('strong');
    });
  });

  it('step 4: identifies watchouts (bottom performing domains)', () => {
    const narrative = buildCommitteeNarrative(context, overallScore, domainScores);

    expect(narrative.watchouts.length).toBeGreaterThanOrEqual(1);
    narrative.watchouts.forEach(watchout => {
      expect(watchout).toContain('below target');
    });
  });

  it('step 5: includes evidence links for supporting documentation', () => {
    const narrative = buildCommitteeNarrative(context, overallScore, domainScores);

    expect(narrative.evidenceLinks.length).toBeGreaterThanOrEqual(1);
    narrative.evidenceLinks.forEach(link => {
      expect(link.id).toBeTruthy();
      expect(['weak', 'moderate', 'strong']).toContain(link.strength);
    });
  });
});

describe('Readiness Scorecards', () => {
  const context = getAtlasBankabilityContext();
  const domainScores = calculateDomainScores(context, scenarios[0]);

  it('step 1: generates scorecards for all targets', () => {
    const scorecards = buildReadinessScorecards(context, domainScores);

    expect(scorecards.length).toBe(context.readinessTargets.length);
    expect(scorecards.length).toBeGreaterThanOrEqual(1);
  });

  it('step 2: assigns correct status based on score', () => {
    const scorecards = buildReadinessScorecards(context, domainScores);

    scorecards.forEach(card => {
      if (card.score >= 75) {
        expect(card.status).toBe('ready');
      } else if (card.score >= 60) {
        expect(card.status).toBe('progressing');
      } else {
        expect(card.status).toBe('not-ready');
      }
    });
  });

  it('step 3: includes target types (project/workstream/counterparty)', () => {
    const scorecards = buildReadinessScorecards(context, domainScores);

    scorecards.forEach(card => {
      expect(card.type).toBeTruthy();
      expect(card.label).toBeTruthy();
    });
  });

  it('step 4: generates narrative for each scorecard', () => {
    const scorecards = buildReadinessScorecards(context, domainScores);

    scorecards.forEach(card => {
      expect(card.narrative).toBeTruthy();
      expect(card.narrative).toContain(card.label);
      expect(card.narrative).toContain(card.status.replace('-', ' '));
    });
  });
});

describe('Benchmark Comparison', () => {
  const context = getAtlasBankabilityContext();
  const domainScores = calculateDomainScores(context, scenarios[0]);

  it('step 1: compares all domains against benchmark', () => {
    const deltas = buildBenchmarkDeltas(context, domainScores);

    expect(deltas).toHaveLength(6);
    expect(deltas.map(d => d.domain)).toEqual([
      'technical', 'commercial', 'financial', 'regulatory', 'esg', 'execution'
    ]);
  });

  it('step 2: calculates gap correctly', () => {
    const deltas = buildBenchmarkDeltas(context, domainScores);

    deltas.forEach(delta => {
      const expectedGap = Number((delta.actual - delta.benchmark).toFixed(1));
      expect(delta.gap).toBe(expectedGap);
    });
  });

  it('step 3: benchmark values come from archetype', () => {
    const deltas = buildBenchmarkDeltas(context, domainScores);

    deltas.forEach(delta => {
      const expectedBenchmark = context.benchmark.expectedDomainScores[delta.domain];
      expect(delta.benchmark).toBe(expectedBenchmark);
    });
  });

  it('step 4: identifies outperforming and underperforming domains', () => {
    const deltas = buildBenchmarkDeltas(context, domainScores);

    const outperforming = deltas.filter(d => d.gap > 0);
    const underperforming = deltas.filter(d => d.gap < 0);

    // Just verify they're identified correctly
    outperforming.forEach(d => expect(d.actual).toBeGreaterThan(d.benchmark));
    underperforming.forEach(d => expect(d.actual).toBeLessThan(d.benchmark));
  });
});

describe('Project Approval Flow Integration', () => {
  it('step 1: full approval flow for bankable project', () => {
    const evaluation = evaluateBankability('base');

    // Simulate approval decision based on score
    const isApprovable = evaluation.overallScore >= 60 && 
                         evaluation.redFlags.filter(f => f.severity === 'critical').length === 0;

    expect(typeof isApprovable).toBe('boolean');

    // Log decision with evidence
    const decisionRecord = {
      projectId: evaluation.project.name,
      overallScore: evaluation.overallScore,
      scenario: 'base',
      redFlagCount: evaluation.redFlags.length,
      criticalFlags: evaluation.redFlags.filter(f => f.severity === 'critical').length,
      recommendation: evaluation.committeeNarrative.tone,
      approvalDecision: isApprovable ? 'conditionally_approved' : 'requires_remediation',
      timestamp: new Date().toISOString()
    };

    expect(decisionRecord.overallScore).toBeGreaterThan(0);
    expect(decisionRecord.recommendation).toBeTruthy();
  });

  it('step 2: stress test with downside scenario', () => {
    const downside = evaluateBankability('downside');
    const base = evaluateBankability('base');

    // Calculate cushion
    const cushion = base.overallScore - downside.overallScore;

    expect(cushion).toBeGreaterThan(0);
    expect(downside.committeeNarrative.tone).toBeDefined();
  });

  it('step 3: generates lender-ready export', () => {
    const evaluation = evaluateBankability('base');

    // Verify export contains all required sections
    const requiredSections = [
      'Project Snapshot',
      'Overall Bankability',
      'Readiness Scorecards',
      'Scenario Summary',
      'Benchmark Gaps',
      'Risk Actions'
    ];

    requiredSections.forEach(section => {
      expect(evaluation.exportPack).toContain(section);
    });

    // Verify project metadata in export
    expect(evaluation.exportPack).toContain(evaluation.project.sector);
    expect(evaluation.exportPack).toContain(evaluation.project.sponsor);
    expect(evaluation.exportPack).toContain(String(evaluation.project.debtAskUsdM));
  });
});
