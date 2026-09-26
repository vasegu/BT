import type { BehaviourRun } from "./behaviour-types";
export function expressionPairs(runs: BehaviourRun[]) {
  return runs.flatMap((a, i) =>
    runs
      .slice(i + 1)
      .filter(
        (b) =>
          a.selectedAction === b.selectedAction &&
          a.expression.messages.length > 0 &&
          b.expression.messages.length > 0 &&
          a.expression.summary !== b.expression.summary,
      )
      .map((b) => ({
        a: a.id,
        b: b.id,
        samePerson: a.person === b.person,
        samePrompt: a.promptHash !== null && a.promptHash === b.promptHash,
        similarity: null,
        actionShift: null,
      })),
  );
}
