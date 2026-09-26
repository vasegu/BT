import type { PersonId } from "./types";
export type BehaviourRun = {
  id: string;
  person: PersonId;
  revision: number;
  time: string;
  title: string;
  domain: string;
  disposition: string;
  reason: string;
  input: string;
  expression: {
    channel: string;
    provenance: string;
    summary: string;
    messages: { id: string; title: string; body: string; time: string }[];
    modifiers: { label: string; value: string; basis: string; evidenceIds: string[] }[];
  };
  facts: Record<string, unknown>;
  contextParts: Record<string, string>;
  promptHash: string | null;
  promptVersion: string | null;
  model: string | null;
  probabilities: Record<string, number> | null;
  modelChoice: string | null;
  selectedAction: string;
  eligibleActions: string[];
  inputEvidenceIds: string[];
  evidenceIds: string[];
  actionIds: string[];
  outcomeIds: string[];
  outcome: "verified" | "pending" | "mixed" | "reassess" | "unknown";
  assessment: string;
};
export type ContextContrast = {
  a: string;
  b: string;
  similarity: number;
  actionShift: number;
  rank: number;
  samePrompt: boolean;
  samePerson: boolean;
  actionChanged: boolean;
  facts: { key: string; before: unknown; after: unknown }[];
  otherChanges: string[];
  eligibilityChanged: string[];
};
export type BehaviourSpaceData = {
  contrasts: ContextContrast[];
  runs: (BehaviourRun & {
    position: number[];
    cluster: number;
    neighbours: { id: string; similarity: number }[];
  })[];
  manifest: {
    model: string;
    dimensions: number;
    projection: string;
    variance: number[];
    clusters: number;
    uniqueInputs: number;
    fit: string;
  };
};
