import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import type { ContextEval } from "../src/context-eval-types.ts";
import { embed } from "./behaviour.ts";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const explorerPath = (suite: ContextEval) =>
  resolve(root, ".data/context-evals", suite.id, "explorer.html");
const builds = new Map<string, Promise<void>>();
export function explorerStatus(suite: ContextEval): "ready" | "building" | "unavailable" {
  if (existsSync(explorerPath(suite)) && existsSync(resolve(dirname(explorerPath(suite)), "projection.json"))) return "ready";
  return builds.has(suite.id) ? "building" : "unavailable";
}

export function buildHodoscope(suite: ContextEval): Promise<void> {
  if (explorerStatus(suite) === "ready") return Promise.resolve();
  if (builds.has(suite.id)) return builds.get(suite.id)!;
  const dir = dirname(explorerPath(suite));
  mkdirSync(dir, { recursive: true });
  const statusFile = resolve(dir, "export-status.json");
  const recordStatus = (status: string) => writeFileSync(statusFile, JSON.stringify({ status, at: new Date().toISOString() }));
  recordStatus("building");
  const work = (async () => {
    const python = resolve(root, ".data/hodoscope-venv/bin/python");
    if (!existsSync(python) || suite.status !== "complete")
      throw new Error("Hodoscope runtime or completed eval unavailable");
    const summaries = [];
    for (const trial of suite.trials) {
      if (trial.assessment?.status !== "ok") continue;
      const choices = trial.assessment.questions.next_action.criteria as Record<
        string,
        string
      >;
      // Exact typed actions are already concise: a deterministic summary avoids an extra model inventing behaviour.
      const summary = `Model proposed: ${choices[trial.modelChoice!] || trial.modelChoice}. Governed action: ${choices[trial.governedChoice!] || trial.governedChoice}. ${trial.policyHeld ? "Policy blocked the proposal." : "Policy permitted the selection."}`;
      summaries.push({
        trajectory_id: trial.id,
        turn_id: 0,
        summary,
        action_text: JSON.stringify({
          modelChoice: trial.modelChoice,
          governedChoice: trial.governedChoice,
          probabilities: trial.assessment.answers.next_action.probabilities,
          policyHeld: trial.policyHeld,
        }),
        task_context: JSON.stringify({
          state: trial.assessment.state,
          questions: trial.assessment.questions,
        }),
        embedding: await embed(summary),
        metadata: {
          variant: trial.variant,
          person: trial.person,
          repeat: trial.repeat + 1,
          model: trial.assessment.model,
          expected: suite.sources.find((s) => s.person === trial.person)!
            .expected,
          model_choice: trial.modelChoice,
          governed_choice: trial.governedChoice,
        },
      });
    }
    const input = resolve(dir, "input.json");
    writeFileSync(input, JSON.stringify({ summaries, suiteId: suite.id }));
    await renderHodoscope(input, explorerPath(suite));
    recordStatus("ready");
  })().catch((error) => { recordStatus("unavailable"); throw error; }).finally(() => builds.delete(suite.id));
  builds.set(suite.id, work);
  return work;
}

export function renderHodoscope(input: string, output: string): Promise<void> {
  return new Promise((ok, fail) => execFile(
    resolve(root, ".data/hodoscope-venv/bin/python"),
    [resolve(root, "server/render-hodoscope.py"), input, output],
    { timeout: 120000, maxBuffer: 1_000_000 },
    error => error ? fail(new Error("Local Hodoscope export unavailable; check the isolated Python runtime.")) : ok(),
  ));
}
