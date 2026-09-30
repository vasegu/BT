// The learning loop: outcomes feed back into policy, within governance. Measured on a synthetic
// cohort of 1,000 homes with a fixed seed, so the numbers are reproducible and illustrative:
// they show the mechanism, not BT's results.

export type LoopArm = { label: string; homes: number; outcome: number; rate: number };
export type LearningLoop = {
  id: string;
  question: string;
  metric: string;
  arms: [LoopArm, LoopArm];
  finding: string;
  change: { what: string; kind: "adopted" | "kept" | "expanded"; approver: string; on: string };
  linkedTo: string;
  availableFrom: string;
  observationWindow: string;
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296);
}
/** Simulate `homes` homes where each has probability `p` of the outcome. */
function arm(label: string, homes: number, p: number, random: () => number): LoopArm {
  let outcome = 0;
  for (let i = 0; i < homes; i++) if (random() < p) outcome++;
  return { label, homes, outcome, rate: outcome / homes };
}

export function learningLoops(): LearningLoop[] {
  const random = rng(20260926);
  const note = arm("Told in the morning", 500, 0.022, random),
    silent = arm("Fixed, not told", 500, 0.108, random);
  const within = arm("Dropped again within 72 hours", 1000, 0.09, random),
    after = arm("Dropped again in days 4 to 7", 1000, 0.015, random);
  const guided = arm("Guided in week one", 312, 0.81, random),
    unguided = arm("Not guided", 298, 0.43, random);
  return [
    {
      id: "quiet-fix-note",
      availableFrom: "2026-09-12T00:00:00Z",
      observationWindow: "Illustrative seven-day follow-up per synthetic home",
      question: "After a fix the customer didn’t notice, does telling them help?",
      metric: "Contacted us again within 7 days",
      arms: [note, silent],
      finding: `Homes told about an overnight fix contacted us again ${pct(note.rate)} of the time, against ${pct(silent.rate)} when we fixed it silently. These sampled outcomes illustrate an assumed association; cost and causal effect were not measured.`,
      change: { what: "A morning note after any overnight fix is now the default", kind: "adopted", approver: "AgentOps lead", on: "2026-09-12" },
      linkedTo: "maya",
    },
    {
      id: "monitoring-window",
      availableFrom: "2026-09-19T00:00:00Z",
      observationWindow: "Illustrative days 1–3 and 4–7 after a remote fix",
      question: "After a remote line fix, how long should we watch closely?",
      metric: "Share of re-profiled lines that dropped again",
      arms: [within, after],
      finding: `${pct(within.rate)} of re-profiled lines dropped again within 72 hours, and only ${pct(after.rate)} in the four days after. The sampling assumptions place more repeat faults in the first 72 hours; this is illustrative, not measured policy efficacy.`,
      change: { what: "Heightened monitoring stays at 72 hours", kind: "kept", approver: "AgentOps lead", on: "2026-09-19" },
      linkedTo: "daniel",
    },
    {
      id: "early-life-guide",
      availableFrom: "2026-11-05T00:00:00Z",
      observationWindow: "Illustrative 14-day follow-up per synthetic household",
      question: "Does guiding new customers get them using what they bought?",
      metric: "Using every included product by day 14",
      arms: [guided, unguided],
      finding: `${pct(guided.rate)} of households guided in week one were using everything by day 14, against ${pct(unguided.rate)} without the guide. Churn and causal effect were not measured.`,
      change: { what: "The guide now also covers linked mobile setup", kind: "expanded", approver: "Chief Customer Officer", on: "2026-11-05" },
      linkedTo: "sam",
    },
  ];
}
export const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
