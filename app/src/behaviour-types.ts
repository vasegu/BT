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
  evidenceIds: string[];
  actionIds: string[];
  outcomeIds: string[];
  outcome: "verified" | "pending" | "mixed" | "reassess" | "unknown";
  assessment: string;
};
export type BehaviourSpaceData = {
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
