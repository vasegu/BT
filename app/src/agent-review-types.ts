import type { BehaviourRun } from './behaviour-types';
import type { EvalMap } from './EvalActionMap';
export type ReviewRecord = BehaviourRun & { inputText: string; inputSummary: string; responseText: string; inputProvenance: string };
export type ReviewPair = { a: string; b: string; inputSimilarity: number; responseSimilarity: number; rank: number; sameAction: boolean };
export type AgentReviewData = { runs: ReviewRecord[]; pairs: ReviewPair[]; map: EvalMap | null; fingerprint: string; nativeExplorer?: boolean; method: string };
