export type MemoryLayer = "identity" | "behavioural" | "service" | "context" | "emotional" | "intentional";
export type MemoryMapData = {
  fingerprint: string;
  /** one point per distinct record text per household; `count` identical records share it */
  points: { id: string; ids: string[]; count: number; person: string; layer: MemoryLayer; type: string; text: string; knownAt: string; x: number; y: number }[];
  /** tonight's context per household per moment, placed in the same space */
  queries: { person: string; revision: number; text: string; x: number; y: number; neighbours: { id: string; similarity: number }[] }[];
  method: string;
};
