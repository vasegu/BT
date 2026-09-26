import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Snapshot, Decision, Household } from "../src/types.ts";
import type {
  BehaviourRun,
  BehaviourSpaceData,
  ContextContrast,
} from "../src/behaviour-types.ts";

// Describe the recorded execution. This annotates authored message templates; it is not a tone classifier.
function expressionFor(d: Decision, h: Household, snapshot: Snapshot): BehaviourRun["expression"] {
  const messages = snapshot.actions.filter(a => a.decisionId === d.id)
    .map(({ id, title, body, time }) => ({ id, title, body, time }));
  const text = messages.map(m => `${m.title}. ${m.body}`).join(" ");
  const selected = d.trace?.selectedId || d.domain;
  const tone = !messages.length ? "No new wording" : ({ recovery: "Reassuring continuity", incident: "Factual reassurance", activation: "Supportive guidance", restoration: "Positive, awaiting confirmation", confirmation: "Appreciative closure" }[selected] || "Service-focused");
  const evidence = (types: string[]) => h.evidence.filter(e => types.includes(e.type)).map(e => e.id);
  const modifiers = [
    { label: "Tone brief", value: tone, basis: "Authored template intent, not a model-measured score", evidenceIds: [] as string[] },
    { label: "Contact", value: messages.length ? "In-app · service update" : "No customer contact", basis: messages.length ? "Persisted action and simulated receipt" : d.reason, evidenceIds: evidence(["contact.authority_recorded"]) },
    { label: "Commitment", value: /will still call/.test(text) ? "Keep the promised callback" : "No new callback promise in this response", basis: /will still call/.test(text) ? "The recorded wording retains the existing time and owner" : "Read the recorded response, not a reconstructed message", evidenceIds: evidence(["promise.created", "promise.fulfilled"]) },
    { label: "Prior context", value: /earlier restart/.test(text) ? "Do not repeat the failed restart" : /earlier information|start again/.test(text) ? "Carry the previous conversation forward" : /activation/.test(text) ? "Delivery is not first use" : /everything is working/.test(text) ? "Ask for customer confirmation" : /case is now closed/.test(text) ? "Acknowledge confirmed recovery" : "No additional customer wording", basis: "Content present in the persisted response", evidenceIds: evidence(["diagnostic.completed", "activation.delivered", "customer.confirmed_working", "service.restored_observed"]) },
  ];
  let summary = `Plan: ${selected}. Contact: ${messages.length ? "in-app service update" : "none"}. Delivery: ${d.trace?.execution?.at(-1)?.status || d.disposition}. ${messages.length ? `Tone brief: ${tone}. Recorded wording: ${text}` : `Internal decision: ${d.reason}`}`;
  for (const person of snapshot.households) summary = summary.replaceAll(person.name, "Customer").replaceAll(person.name.split(" ")[0], "Customer").replaceAll(person.serviceId, "service");
  if (h.owner) summary = summary.replaceAll(h.owner, "Existing owner");
  return { channel: messages.length ? "In-app" : "No customer contact", provenance: "Authored templates · recorded execution · interpretive tone brief", summary, messages, modifiers };
}

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
      expression: expressionFor(d, h, snapshot),
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

export { projectVectors } from './projection.ts';
import { projectVectors } from './projection.ts';

export { embed } from "./encoder.ts";
import { embed, encoderModel as model } from "./encoder.ts";
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
