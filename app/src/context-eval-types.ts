import type { ModelAssessment, PersonId } from "./types";
export type EvalVariant = {
  id: string;
  label: string;
  statement: string | null;
};
export type EvalTrial = {
  id: string;
  person: PersonId;
  variant: string;
  repeat: number;
  assessment: ModelAssessment | null;
  modelChoice: string | null;
  governedChoice: string | null;
  policyHeld: boolean;
  resolution: string | null;
};
export type ContextEval = {
  id: string;
  sessionId: string;
  sourceRevision: number;
  version: string;
  createdAt: string;
  status: "running" | "complete" | "incomplete" | "interrupted";
  variants: EvalVariant[];
  repeats: number;
  threshold: number;
  sources: {
    person: PersonId;
    decisionId: string;
    expected: string;
    questionHash: string;
    fixedContextHash: string;
  }[];
  trials: EvalTrial[];
  error?: string;
};
export type EvalSummary = {
  person: PersonId;
  variant: string;
  expected: string;
  complete: number;
  total: number;
  modelFlips: number;
  governedFlips: number;
  modelFailures: number;
  policyHolds: number;
  meanShift: number | null;
  maxShift: number | null;
  baselineNoise: number | null;
  status: "pass" | "fail" | "review" | "incomplete";
};
