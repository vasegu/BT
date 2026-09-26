import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Snapshot } from "../src/types.ts";
import type {
  BehaviourRun,
  BehaviourSpaceData,
  ContextContrast,
} from "../src/behaviour-types.ts";

// Geometry uses input facts only. Actions, prompt identity and later outcomes remain separate.
export function behaviourRuns(
  snapshot: Snapshot,
  at: (revision: number) => Snapshot,
): BehaviourRun[] {
  const history = new Map<number, Snapshot>();
  return snapshot.decisions.map((d) => {
    if (!history.has(d.revision)) history.set(d.revision, at(d.revision));
    const s = history.get(d.revision)!;
    const h = s.households.find((p) => p.id === d.person)!;
    const frozen = d.trace?.assessment?.state.facts as
      | Record<string, unknown>
      | undefined;
    const facts = frozen || {
      serviceState: h.serviceState,
      caseStatus: h.caseStatus,
      activation: h.activation,
      statedPreference: h.habit,
      ownerAssigned: !!h.owner,
      callbackDue: h.promise,
      callbackFulfilled: h.promiseFulfilled,
      restartAlreadyTried: h.restartTried,
      technicalRecovery: h.restored,
      customerConfirmed: h.confirmed,
      incidentInScope: h.incident,
    };
    const outcomes = snapshot.operations.outcomes.filter(
      (o) => o.person === d.person && o.revision <= d.revision,
    );
    const met = outcomes.filter((o) => o.check.status === "met").length;
    const outcome: BehaviourRun["outcome"] = !outcomes.length
      ? "unknown"
      : outcomes.some((o) => o.check.status === "contradicted")
        ? "reassess"
        : met === outcomes.length
          ? "verified"
          : met
            ? "mixed"
            : "pending";
    const input = `Customer context: ${Object.entries(facts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}: ${value ?? "none"}`)
      .join("; ")}`;
    const assessment = d.trace?.assessment;
    const probabilities =
      assessment?.status === "ok"
        ? validDistribution(assessment.answers.next_action?.probabilities)
        : null;
    const hash = (value: unknown) =>
      createHash("sha256")
        .update(JSON.stringify(value) ?? "null")
        .digest("hex");
    const candidateState = assessment?.state.candidates as
      | { id: string; eligible: boolean }[]
      | undefined;
    return {
      id: d.id,
      person: d.person,
      revision: d.revision,
      time: d.time,
      title: d.title,
      domain: d.domain,
      disposition: d.disposition,
      reason: d.reason,
      input,
      facts,
      contextParts: Object.fromEntries(
        [
          "clock",
          "records",
          "candidates",
          "recentActions",
          "outcomeMemory",
        ].map((key) => [key, hash(assessment?.state[key])]),
      ),
      promptHash: assessment ? hash(assessment.questions) : null,
      promptVersion: assessment?.promptVersion || null,
      model: assessment?.model || null,
      probabilities,
      modelChoice: probabilities
        ? assessment?.answers.next_action?.choice || null
        : null,
      selectedAction: d.trace?.selectedId || d.domain,
      eligibleActions: candidateState
        ? candidateState.filter((c) => c.eligible).map((c) => c.id)
        : (d.trace?.candidates || [])
            .filter(
              (c) =>
                c.checks.every((check) => check.state === "pass") &&
                c.status !== "merged",
            )
            .map((c) => c.id),
      inputEvidenceIds:
        assessment && Array.isArray(assessment.state.records)
          ? (assessment.state.records as { id: string }[])
              .map((r) => r.id)
              .filter((id) => s.events.some((e) => e.id === id))
          : h.evidence.map((e) => e.id),
      evidenceIds: d.evidenceIds.filter((id) =>
        s.events.some((e) => e.id === id),
      ),
      actionIds: snapshot.actions
        .filter((a) => a.decisionId === d.id)
        .map((a) => a.id),
      outcomeIds: outcomes.map((o) => o.id),
      outcome,
      assessment: d.trace?.assessment
        ? d.trace.assessment.effective === "model"
          ? "Jev + policy gates"
          : "Policy hold"
        : "Deterministic policy",
    };
  });
}

function validDistribution(
  value: Record<string, number> | undefined,
): Record<string, number> | null {
  if (
    !value ||
    !Object.keys(value).length ||
    Object.values(value).some((v) => !Number.isFinite(v) || v < 0 || v > 1)
  )
    return null;
  const sum = Object.values(value).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1) <= 0.02 ? value : null;
}
export function distributionShift(
  a: Record<string, number> | null,
  b: Record<string, number> | null,
): number | null {
  if (!validDistribution(a || undefined) || !validDistribution(b || undefined))
    return null;
  const sumA = Object.values(a!).reduce((x, y) => x + y, 0),
    sumB = Object.values(b!).reduce((x, y) => x + y, 0);
  return (
    [...new Set([...Object.keys(a!), ...Object.keys(b!)])].reduce(
      (sum, key) =>
        sum + Math.abs((a![key] || 0) / sumA - (b![key] || 0) / sumB),
      0,
    ) / 2
  );
}
export function contextContrasts(
  runs: BehaviourRun[],
  vectors: number[][],
): ContextContrast[] {
  // ponytail: O(n²) over at most 15 runs in this replay; use a vector index for a production corpus.
  const pairs: ContextContrast[] = [];
  for (let i = 0; i < runs.length; i++)
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i],
        b = runs[j],
        shift = distributionShift(a.probabilities, b.probabilities);
      if (shift === null || !a.model || a.model !== b.model) continue;
      const cosine = vectors[i].reduce(
        (sum, v, k) => sum + v * vectors[j][k],
        0,
      );
      const facts = [
        ...new Set([...Object.keys(a.facts), ...Object.keys(b.facts)]),
      ]
        .filter(
          (key) =>
            JSON.stringify(a.facts[key]) !== JSON.stringify(b.facts[key]),
        )
        .map((key) => ({
          key,
          before: a.facts[key] ?? null,
          after: b.facts[key] ?? null,
        }));
      pairs.push({
        a: a.id,
        b: b.id,
        similarity: Math.max(-1, Math.min(1, cosine)),
        actionShift: shift,
        rank: Math.max(0, cosine) * shift,
        samePrompt:
          a.promptHash !== null &&
          a.promptHash === b.promptHash &&
          a.promptVersion === b.promptVersion,
        samePerson: a.person === b.person,
        actionChanged: a.selectedAction !== b.selectedAction,
        facts,
        otherChanges: Object.keys(a.contextParts).filter(
          (key) => a.contextParts[key] !== b.contextParts[key],
        ),
        eligibilityChanged: [
          ...new Set([...a.eligibleActions, ...b.eligibleActions]),
        ].filter(
          (key) =>
            a.eligibleActions.includes(key) !== b.eligibleActions.includes(key),
        ),
      });
    }
  return pairs.sort((a, b) => b.rank - a.rank || b.similarity - a.similarity);
}

type Projection = {
  points: {
    position: number[];
    cluster: number;
    neighbours: { index: number; similarity: number }[];
  }[];
  variance: number[];
  clusters: number;
  uniqueInputs: number;
};
const here = dirname(fileURLToPath(import.meta.url));
export function projectVectors(vectors: number[][]): Promise<Projection> {
  return new Promise((resolveResult, reject) => {
    const child = execFile(
      "python3",
      [resolve(here, "project-behaviour.py")],
      { timeout: 15000, maxBuffer: 2_000_000 },
      (error, stdout) => {
        if (error)
          return reject(
            new Error("Local behaviour projection is unavailable."),
          );
        try {
          resolveResult(JSON.parse(stdout));
        } catch {
          reject(new Error("Invalid local projection."));
        }
      },
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end(JSON.stringify(vectors));
  });
}

type Encoder = (
  input: string,
  options: { pooling: string; normalize: boolean },
) => Promise<{ data: Iterable<number> }>;
let encoder: Promise<Encoder> | undefined;
const vectors = new Map<string, Promise<number[]>>();
const model = "Xenova/all-MiniLM-L6-v2";
function localEncoder() {
  if (!encoder)
    encoder = (async () => {
      const runtime =
        process.env.BT_EMBED_RUNTIME ||
        resolve(
          here,
          "../../../SohoHouse/app/node_modules/@xenova/transformers",
        );
      const { pipeline, env } = await import(
        pathToFileURL(resolve(runtime, "src/transformers.js")).href
      );
      env.allowRemoteModels = false;
      env.cacheDir = resolve(runtime, ".cache");
      return (await pipeline("feature-extraction", model, {
        quantized: true,
      })) as Encoder;
    })().catch((error) => {
      encoder = undefined;
      throw error;
    });
  return encoder;
}
async function embed(input: string) {
  const key = createHash("sha256").update(input).digest("hex");
  if (!vectors.has(key)) {
    if (vectors.size >= 128) vectors.delete(vectors.keys().next().value!);
    vectors.set(
      key,
      (async () => {
        const encode = await localEncoder();
        const result = await encode(input, {
          pooling: "mean",
          normalize: true,
        });
        const vector = Array.from(result.data);
        if (vector.length !== 384 || vector.some((v) => !Number.isFinite(v)))
          throw new Error("Invalid local embedding.");
        return vector;
      })().catch((error) => {
        vectors.delete(key);
        throw error;
      }),
    );
  }
  return vectors.get(key)!;
}
export async function behaviourSpace(
  snapshot: Snapshot,
  at: (revision: number) => Snapshot,
): Promise<BehaviourSpaceData> {
  const runs = behaviourRuns(snapshot, at),
    encoded: number[][] = [];
  for (const run of runs) encoded.push(await embed(run.input));
  const projection = await projectVectors(encoded);
  return {
    contrasts: contextContrasts(runs, encoded),
    runs: runs.map((run, i) => ({
      ...run,
      ...projection.points[i],
      neighbours: projection.points[i].neighbours.map((n) => ({
        id: runs[n.index].id,
        similarity: n.similarity,
      })),
    })),
    manifest: {
      model,
      dimensions: 384,
      projection: "PCA / SVD",
      variance: projection.variance,
      clusters: projection.clusters,
      uniqueInputs: projection.uniqueInputs,
      fit: "Input facts only, excluding selected actions, decision explanations and later outcomes. Prompt fingerprints and other retrieved context are compared separately. PCA is refitted at each cutoff. Neighbours use original 384D cosine similarity.",
    },
  };
}
