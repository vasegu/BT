import type { PersonId } from "./types";
export type SwayPoint = {
  id: string;
  person: PersonId;
  revision: number;
  /** recorded = the live decision; base = policy replay of it; single/pair = factor flips */
  kind: "recorded" | "base" | "single" | "pair";
  flips: string[];
  /** base points only: the facts that were true for this household at this moment */
  known?: string[];
  action: string;
  title: string;
  reason: string;
  text: string;
  /** 0–1 percentile distance from the centroid of its action group */
  outlier: number;
  x: number;
  y: number;
};
export type SwayFactor = {
  id: string;
  label: string;
  promptOnly: boolean;
  sway: number;
  changed: number;
  bases: number;
  moves: { move: string; count: number }[];
  examples: { from: string; to: string; person: PersonId; revision: number }[];
};
export type SwayData = {
  fingerprint: string;
  points: SwayPoint[];
  factors: SwayFactor[];
  bases: number;
  policyAgreement: number | null;
  variance: number[];
  method: string;
};
