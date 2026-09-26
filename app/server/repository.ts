import type { Snapshot } from "../src/types.ts";
import type { Evaluator } from "./assessment.ts";
// Both persistence adapters keep this public contract; SQLite remains synchronous internally.
export interface Repository {
  createSession(): Snapshot["session"] | Promise<Snapshot["session"]>;
  snapshot(id: string, cutoff?: number): Snapshot | Promise<Snapshot>;
  advance(id: string, step: string, key: string, revision: number): unknown;
  processJobs(evaluate?: Evaluator): Promise<void>;
  close(): void | Promise<void>;
}
