import type { EvaluationCase, EvaluationResult, EvaluationSummary, SearchResponse } from '@/lib/ai/types';

const evaluationCases: EvaluationCase[] = [
  {
    id: 'search-citations',
    capability: 'search',
    prompt: 'Find permit execution risk and cite evidence',
    expectedSignals: ['[1]', 'evidence', 'risk'],
  },
  {
    id: 'diligence-missing-data',
    capability: 'diligence',
    prompt: 'Spot missing annexes and unresolved issues',
    expectedSignals: ['missing', 'issue', 'follow-up'],
  },
];

function extractSignals(text: string): string[] {
  return Array.from(new Set(text.toLowerCase().match(/[a-z0-9\[\]-]+/g) ?? []));
}

export function getEvaluationCases() {
  return evaluationCases;
}

export function evaluateSearchLikeOutput(capability: 'search' | 'diligence', response: SearchResponse | { summary: string }): EvaluationResult[] {
  const text = capability === 'search' ? response.answer : response.summary;
  const signals = extractSignals(text);

  return evaluationCases
    .filter((entry) => entry.capability === capability)
    .map((entry) => {
      const missingSignals = entry.expectedSignals.filter((signal) => !signals.some((token) => token.includes(signal.replace(/[^a-z0-9]/g, '')) || text.toLowerCase().includes(signal.toLowerCase())));
      return {
        id: entry.id,
        capability,
        passed: missingSignals.length === 0,
        observedSignals: signals.slice(0, 20),
        missingSignals,
      };
    });
}

export function summarizeEvaluation(results: EvaluationResult[]): EvaluationSummary {
  return {
    results,
    passed: results.filter((entry) => entry.passed).length,
    failed: results.filter((entry) => !entry.passed).length,
  };
}
