import type { Decision, Proposal } from './types.ts';

/** Show the plan we moved away from, then the strongest live competitor—not array order. */
export function competingProposal(decision: Decision | null | undefined, previousId?: string): Proposal | undefined {
  const candidates = decision?.trace?.candidates.filter(c => c.id !== decision.trace?.selectedId && c.status !== 'merged') ?? [];
  const used = new Set(decision?.evidenceIds ?? []);
  const overlap = (c: Proposal) => (c.evidenceIds ?? []).filter(id => used.has(id)).length;
  return candidates.sort((a, b) =>
    Number(b.id === previousId) - Number(a.id === previousId) ||
    Number(b.status === 'awaiting') - Number(a.status === 'awaiting') ||
    Number(b.checks.every(c => c.state === 'pass')) - Number(a.checks.every(c => c.state === 'pass')) ||
    overlap(b) - overlap(a) ||
    b.priority - a.priority || a.id.localeCompare(b.id),
  )[0];
}

export function importantChecks(checks: Proposal['checks']) {
  return [...checks].sort((a, b) => Number(a.state === 'pass') - Number(b.state === 'pass')).slice(0, 3);
}
