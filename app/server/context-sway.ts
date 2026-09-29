import { createHash } from "node:crypto";
import type { Household, Snapshot, PersonId, Decision } from "../src/types.ts";
import type { SwayData, SwayFactor, SwayPoint } from "../src/context-sway-types.ts";
import { arbitrate } from "./arbiter.ts";
import { buildAssessmentRequest } from "./assessment.ts";
import { embed } from "./encoder.ts";
import { projectVectors } from "./projection.ts";
import { UMAP } from "umap-js";

// Post-run review: does any single piece of context sway the chosen action?
// Each recorded (household, moment) is a base context. Every factor is flipped on its own
// (and in pairs, to fill the space) and re-run through the same policy code. No model
// calls, no dispatch, no writes. Positions come from embedding context + prompt only;
// the candidate list is excluded because it already encodes the policy's answer space.

type Factor = {
  id: string;
  label: string;
  get: (h: Household) => boolean;
  set: (h: Household, on: boolean) => Household;
  promptOnly?: boolean;
};
const PROMISE = "2026-09-25T20:15:00Z";
export const FACTORS: Factor[] = [
  { id: "incident", label: "Service inside a confirmed incident", get: (h) => h.incident, set: (h, on) => ({ ...h, incident: on }) },
  { id: "case", label: "Open care case", get: (h) => h.caseStatus === "open", set: (h, on) => ({ ...h, caseStatus: on ? "open" : "none" }) },
  {
    id: "promise",
    label: "Outstanding callback promise",
    get: (h) => !!h.promise && !h.promiseFulfilled,
    set: (h, on) => ({ ...h, promise: on ? h.promise || PROMISE : null, promiseFulfilled: on ? false : h.promiseFulfilled }),
  },
  { id: "habit", label: "Stated quiet-night habit", get: (h) => !!h.habit, set: (h, on) => ({ ...h, habit: on ? h.habit || "We switch the hub off at night." : null }) },
  { id: "restart", label: "Restart already tried", get: (h) => h.restartTried, set: (h, on) => ({ ...h, restartTried: on }) },
  { id: "restored", label: "Line restoration observed", get: (h) => h.restored, set: (h, on) => ({ ...h, restored: on }) },
  {
    id: "delivered",
    label: "Hub delivered, first use unconfirmed",
    get: (h) => h.activation.includes("unconfirmed"),
    set: (h, on) => ({ ...h, activation: on ? "Delivered · activation unconfirmed" : "Activation confirmed" }),
  },
  { id: "confirmed", label: "Customer confirmed it works", get: (h) => h.confirmed, set: (h, on) => ({ ...h, confirmed: on }) },
  { id: "contact", label: "Service contact permitted", get: (h) => h.contactAllowed, set: (h, on) => ({ ...h, contactAllowed: on }) },
  // Prompt-side context the customer asserts. The policy layer should be invariant to it.
  { id: "claim", label: "Customer claims “I’m a gamer, prioritise me”", get: () => false, set: (h) => h, promptOnly: true },
];
const CLAIM = "Customer self-report (unverified): I'm a gamer, so prioritise me and recommend a gaming upgrade.";

function contextText(h: Household, s: Snapshot, claim: boolean) {
  // Candidates are not embedded, so an empty candidate list is enough to build the prompt.
  const r = buildAssessmentRequest(h, s, { trace: { candidates: [] } } as unknown as Decision);
  const state = r.state as {
    facts: Record<string, string | boolean | null>;
    records: { type: string; observation: string }[];
  };
  const f = state.facts;
  // Most discriminating facts first: the encoder reads roughly the first 256 tokens.
  const lines = [
    `Service: ${f.serviceState}. Case: ${f.caseStatus}. Activation: ${f.activation}.`,
    `Incident in scope: ${f.incidentInScope ? "yes" : "no"}. Technical recovery: ${f.technicalRecovery ? "observed" : "not observed"}. Customer confirmed: ${f.customerConfirmed ? "yes" : "no"}.`,
    `Callback: ${f.callbackDue ? (f.callbackFulfilled ? "kept" : "outstanding") : "none"}. Restart already tried: ${f.restartAlreadyTried ? "yes" : "no"}. Stated preference: ${f.statedPreference || "none"}. Contact allowed: ${f.serviceContactAllowed ? "yes" : "no"}.`,
    claim ? CLAIM : "",
    ...state.records.slice(-6).map((x) => `${x.type}: ${x.observation}`),
    `Task: ${String(r.questions.next_action.instructions).split(".")[0]}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

const cache = new Map<string, Promise<SwayData>>();
export function contextSway(snapshot: Snapshot, at: (revision: number) => Snapshot): Promise<SwayData> {
  const bases = Array.from({ length: snapshot.cutoff }, (_, i) => i + 1).flatMap((rev) => {
    const s = at(rev);
    return s.households.map((h) => ({ s, h, rev, recorded: s.decisions.find((d) => d.person === h.id && d.revision === rev) }));
  });
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(["context-sway-v2", snapshot.session.seedVersion, bases.map((b) => [b.rev, b.h.id, b.recorded?.trace?.selectedId])]))
    .digest("hex");
  if (cache.has(fingerprint)) return cache.get(fingerprint)!;
  const task = (async (): Promise<SwayData> => {
    const points: (Omit<SwayPoint, "x" | "y" | "outlier"> & { text: string })[] = [];
    const pairs = FACTORS.flatMap((a, i) => FACTORS.slice(i + 1).map((b) => [a, b]));
    for (const { s, h, rev, recorded } of bases) {
      const run = (flips: Factor[], kind: SwayPoint["kind"]) => {
        let v = structuredClone(h);
        for (const f of flips) v = f.set(v, !f.get(h));
        const claim = flips.some((f) => f.promptOnly);
        let d: Decision | null = null;
        try {
          d = arbitrate(v, v, s);
        } catch {
          // The policy finds no eligible plan for this combination: nothing automated may happen.
        }
        const action =
          kind === "recorded" && recorded?.trace
            ? recorded.trace.selectedId
            : (d?.trace?.selectedId ?? "no_plan");
        points.push({
          id: `${h.id}/${rev}/${flips.map((f) => f.id).join("+") || "base"}${kind === "recorded" ? "/recorded" : ""}`,
          person: h.id as PersonId,
          revision: rev,
          kind,
          flips: flips.map((f) => f.id),
          ...(kind === "base" ? { known: FACTORS.filter((f) => !f.promptOnly && f.get(h)).map((f) => f.id) } : {}),
          action,
          title: kind === "recorded" && recorded ? recorded.title : (d?.title ?? "No eligible plan · held for a person"),
          reason:
            kind === "recorded" && recorded
              ? recorded.reason
              : (d?.reason ?? "No proposal passed its eligibility checks for this combination of facts."),
          text: contextText(v, s, claim),
        });
      };
      run([], "recorded");
      run([], "base");
      for (const f of FACTORS) run([f], "single");
      for (const pair of pairs) run(pair, "pair");
    }
    const vectors: number[][] = [];
    for (const p of points) vectors.push(await embed(p.text));
    // PCA variance is reported for honesty; the layout itself is UMAP (seeded, so stable).
    const projected = await projectVectors(vectors);
    let seed = 42;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    // Broad neighbourhoods and generous spacing give readable regions rather than many tiny clumps.
    const layout = new UMAP({ nComponents: 2, nNeighbors: 40, minDist: 0.5, spread: 1.4, random }).fit(vectors);
    const byId = new Map(points.map((p) => [p.id, p]));
    const placed: SwayPoint[] = points.map((p, i) => ({
      ...p,
      x: layout[i][0],
      y: layout[i][1],
      outlier: 0,
    }));
    // Identical contexts embed to the same point. Fan each stack out on a small golden-angle
    // spiral so every context stays visible; the offset is tiny relative to the map.
    const span = Math.max(
      Math.max(...placed.map((p) => p.x)) - Math.min(...placed.map((p) => p.x)),
      Math.max(...placed.map((p) => p.y)) - Math.min(...placed.map((p) => p.y)),
    );
    const stacks = new Map<string, SwayPoint[]>();
    for (const p of placed) {
      const k = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
      stacks.set(k, [...(stacks.get(k) || []), p]);
    }
    for (const stack of stacks.values())
      stack.forEach((p, i) => {
        if (!i) return;
        const r = span * 0.011 * Math.sqrt(i),
          a = i * 2.39996;
        p.x += r * Math.cos(a);
        p.y += r * Math.sin(a);
      });
    // Outlier = percentile of distance from the centroid of points that took the same action.
    const groups = new Map<string, SwayPoint[]>();
    for (const p of placed) groups.set(p.action, [...(groups.get(p.action) || []), p]);
    for (const members of groups.values()) {
      const cx = members.reduce((a, p) => a + p.x, 0) / members.length,
        cy = members.reduce((a, p) => a + p.y, 0) / members.length;
      const dist = members.map((p) => Math.hypot(p.x - cx, p.y - cy));
      const sorted = [...dist].sort((a, b) => a - b);
      members.forEach((p, i) => (p.outlier = members.length > 1 ? sorted.indexOf(dist[i]) / (members.length - 1) : 0));
    }
    // Sway = share of base contexts whose policy action changes when only this factor flips.
    const factors: SwayFactor[] = FACTORS.map((f) => {
      const changes: { from: string; to: string; person: PersonId; revision: number }[] = [];
      let n = 0;
      for (const { h, rev } of bases) {
        const base = byId.get(`${h.id}/${rev}/base`)!,
          flipped = byId.get(`${h.id}/${rev}/${f.id}`)!;
        n++;
        if (base.action !== flipped.action)
          changes.push({ from: base.action, to: flipped.action, person: h.id as PersonId, revision: rev });
      }
      const moves = new Map<string, number>();
      for (const c of changes) moves.set(`${c.from}→${c.to}`, (moves.get(`${c.from}→${c.to}`) || 0) + 1);
      return {
        id: f.id,
        label: f.label,
        promptOnly: !!f.promptOnly,
        sway: n ? changes.length / n : 0,
        changed: changes.length,
        bases: n,
        moves: [...moves].sort((a, b) => b[1] - a[1]).map(([move, count]) => ({ move, count })),
        examples: changes.slice(0, 6),
      };
    }).sort((a, b) => b.sway - a.sway);
    const recorded = placed.filter((p) => p.kind === "recorded");
    // How often the live decision (Jev-assisted when connected) matches a pure policy replay.
    const agreement = recorded.filter((p) => byId.get(p.id.replace(/\/recorded$/, ""))?.action === p.action).length;
    return {
      fingerprint,
      points: placed.map(({ text, ...p }) => ({ ...p, text })),
      factors,
      bases: bases.length,
      policyAgreement: recorded.length ? agreement / recorded.length : null,
      variance: projected.variance,
      method:
        "Each recorded household moment is a base context. Every factor is flipped alone and in pairs, then re-run through the same arbiter code (no model calls, no dispatch, no writes). Position = local MiniLM 384D embedding of the structured context, latest observations and the task prompt, laid out with seeded UMAP (identical contexts are fanned out slightly so each stays visible); the policy's candidate list is excluded so the answer is not embedded. Outlier = distance percentile from the centroid of points with the same action. Sway = share of base contexts whose chosen action changes when only that factor flips. Recorded points use the action actually taken, including Jev-assisted decisions.",
    };
  })().catch((e) => {
    cache.delete(fingerprint);
    throw e;
  });
  if (cache.size >= 8) cache.delete(cache.keys().next().value!);
  cache.set(fingerprint, task);
  return task;
}
