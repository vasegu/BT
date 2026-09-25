import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Snapshot } from "../src/types.ts";
import type {
  BehaviourRun,
  BehaviourSpaceData,
} from "../src/behaviour-types.ts";

// Decision-time inputs are frozen; outcome colour is a separate as-of-cutoff overlay.
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
    const selected = d.trace?.candidates.find(
      (c) => c.id === d.trace?.selectedId,
    );
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
    const input = `Context: ${Object.entries(facts)
      .map(([key, value]) => `${key}: ${value ?? "none"}`)
      .join(
        "; ",
      )}. Decision: ${d.title}. ${d.reason} Effect: ${selected?.effect || d.disposition}`;
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
      fit: "Distinct context + selected-action vectors through this cutoff. Refit when new runs arrive. Cosine clusters in 384D; later outcomes do not enter embeddings.",
    },
  };
}
