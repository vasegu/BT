import { createHash } from "node:crypto";
import { UMAP } from "umap-js";
import type { HouseholdFixture, FixtureEvent } from "./data-model.ts";
import { buildContext } from "./context.ts";
import { clocks } from "./engine.ts";
import { embed } from "./encoder.ts";
import type { MemoryMapData, MemoryLayer } from "../src/memory-map-types.ts";

// The shape of the three households' memory: every memory-bearing record, classified into the
// six layers of Trust is the Product, embedded (local MiniLM 384D) and laid out per household
// with seeded UMAP. Tonight's context for each home is placed in that home's space with the
// earlier memories it sits closest to. Deterministic → baked to a static file.
const PEOPLE = ["daniel", "sam", "maya"] as const;
const PER_TYPE = 12; // routine telemetry is capped so it doesn't swamp the space

export function layerOf(e: Pick<FixtureEvent, "type" | "payload">): MemoryLayer | null {
  const t = e.type;
  if (t === "contact.authority_recorded" || t === "order.accepted") return "identity";
  if (t === "router.overnight_window" || t === "router.heartbeat_received" || t === "router.observation_window") return "behavioural";
  if (t === "router.heartbeat_overdue" || t === "incident.confirmed") return "context";
  if (t.startsWith("order.") || t.startsWith("activation.") || t.startsWith("case.") || t.startsWith("diagnostic.") || t === "service.restored_observed")
    return "service";
  if (t === "conversation.message") return (e.payload as { speakerRole?: string }).speakerRole === "customer" ? "emotional" : null;
  if (t.startsWith("promise.") || t === "preference.stated" || t === "customer.confirmed_working" || t === "interest.stated") return "intentional";
  return null;
}
const textOf = (e: FixtureEvent) => `${e.type.replace(/[._]/g, " ")}: ${e.description}`;

export async function buildMemoryMap(fixture: HouseholdFixture): Promise<MemoryMapData> {
  const alias = new Map(fixture.tables["customer.people"].map((p) => [String(p.id), String(p.alias)]));
  const service = (a: string) => fixture.tables["customer.services"].find((s) => s.reference === `svc_${a}_broadband`)!;
  const person = (a: string) => fixture.tables["customer.people"].find((p) => p.alias === a)!;
  const concerns = (e: FixtureEvent, a: string) => alias.get(String(e.personId)) === a || (e.type === "incident.confirmed" && !e.personId);
  // One row per distinct record text per household (identical routine records share a meaning).
  type Row = { e: FixtureEvent; ids: string[]; person: string; layer: MemoryLayer };
  const rows: Row[] = [];
  for (const a of PEOPLE) {
    const byType = new Map<string, FixtureEvent[]>();
    for (const e of fixture.events) {
      if (!concerns(e, a) || !layerOf(e)) continue;
      byType.set(e.type, [...(byType.get(e.type) || []), e]);
    }
    const byText = new Map<string, Row>();
    for (const [type, list] of byType)
      for (const e of type.startsWith("router.") ? list.slice(-PER_TYPE) : list) {
        const r = byText.get(e.description);
        if (r) {
          r.ids.push(e.id);
          if (Date.parse(e.knownAt) < Date.parse(r.e.knownAt)) r.e = e; // first known = when the memory existed
        } else byText.set(e.description, { e, ids: [e.id], person: a, layer: layerOf(e)! });
      }
    rows.push(...byText.values());
  }
  // Tonight's context for each household at each moment after the first signal.
  const queries: { person: string; revision: number; text: string }[] = [];
  for (const a of PEOPLE)
    for (let rev = 1; rev < clocks.length; rev++) {
      const h = buildContext({
        fixture,
        sessionId: "memory-map",
        personId: String(person(a).id),
        serviceId: String(service(a).id),
        cutoff: clocks[rev],
        purpose: "service",
      }).household;
      // What just happened for this household, in the records' own words, plus the state that matters.
      const fresh = fixture.events
        .filter((e) => concerns(e, a) && Date.parse(e.knownAt) > Date.parse(clocks[rev - 1]) && Date.parse(e.knownAt) <= Date.parse(clocks[rev]) && layerOf(e))
        .map((e) => e.description);
      queries.push({
        person: a,
        revision: rev,
        text: [
          ...fresh,
          h.caseStatus === "open" ? `Open care case owned by ${h.owner ?? "the care team"}.` : "",
          h.promise ? `Callback ${h.promiseFulfilled ? "kept" : "still outstanding"}.` : "",
          h.habit ? `Stated habit: ${h.habit}.` : "",
          h.activation.includes("unconfirmed") ? "Hub delivered; activation and first use unconfirmed." : "",
        ]
          .filter(Boolean)
          .join(" "),
      });
    }
  const texts = [...rows.map((r) => textOf(r.e)), ...queries.map((q) => q.text)];
  const vectors: number[][] = [];
  for (const t of texts) vectors.push(await embed(t));
  // One space per household: each person's memory is laid out from their own records alone.
  const xy = new Map<number, [number, number]>();
  for (const a of PEOPLE) {
    const idx = [...rows.flatMap((r, i) => (r.person === a ? [i] : [])), ...queries.flatMap((q, j) => (q.person === a ? [rows.length + j] : []))];
    let seed = 7;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const layout = new UMAP({ nComponents: 2, nNeighbors: Math.min(8, idx.length - 1), minDist: 0.5, spread: 1.4, random }).fit(idx.map((i) => vectors[i]));
    // Stretch to a [-1, 1] box (UMAP axes carry no units).
    const fit = (vs: number[]) => {
      const lo = Math.min(...vs),
        hi = Math.max(...vs);
      return (v: number) => Number(((2 * (v - lo)) / (hi - lo || 1) - 1).toFixed(4));
    };
    const fx = fit(layout.map((p) => p[0])),
      fy = fit(layout.map((p) => p[1]));
    idx.forEach((i, k) => xy.set(i, [fx(layout[k][0]), fy(layout[k][1])]));
  }
  const cos = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
  const points = rows.map((r, i) => ({
    id: r.e.id,
    ids: r.ids,
    count: r.ids.length,
    person: r.person,
    layer: r.layer,
    type: r.e.type,
    text: r.e.description,
    knownAt: r.e.knownAt,
    x: xy.get(i)![0],
    y: xy.get(i)![1],
  }));
  const queryPoints = queries.map((q, j) => {
    const v = vectors[rows.length + j];
    // What tonight reminds us of: memories held before this moment, not the moment's own records.
    const known = Date.parse(clocks[q.revision - 1]);
    const neighbours = rows
      .map((r, i) => ({ r, s: cos(v, vectors[i]) }))
      .filter(({ r }) => r.person === q.person && Date.parse(r.e.knownAt) <= known)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map(({ r, s }) => ({ id: r.e.id, similarity: Number(s.toFixed(3)) }));
    return { ...q, x: xy.get(rows.length + j)![0], y: xy.get(rows.length + j)![1], neighbours };
  });
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(["memory-map-v9", fixture.datasetVersion, fixture.seed, texts]))
    .digest("hex");
  return {
    fingerprint,
    points,
    queries: queryPoints,
    method:
      "Every memory-bearing record for the three households (routine telemetry capped to the 12 most recent per type; identical records merged), classified into six memory layers, embedded with local MiniLM 384D and laid out with seeded UMAP, one space per household built from that person’s records alone. Tonight's context for each home is embedded the same way and compared with that home's memories held before the moment; the five closest (cosine) are what it reminds us of. Nearness is similarity of meaning, not permission to act or proof of cause.",
  };
}
