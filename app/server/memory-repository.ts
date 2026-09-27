import type { Sql } from "postgres";
import { embed, encoderModel, artifactHash } from "./encoder.ts";
import { rankMemories, hash } from "./memory.ts";
import type { ContextBundle } from "./context.ts";
const persisted = new Set<string>();
export async function enrichContext(c: ContextBundle, db?: Sql) {
  const vectors = new Map<string, number[]>();
  try {
    for (const m of c.memories) vectors.set(m.id, await embed(m.text));
    const query = await embed(
      `Current service: ${c.household.serviceState}. ${c.household.caseStatus === "open" ? "Previous diagnostics and customer support, existing callback commitments." : "Customer contact preference and observed overnight routine."}`,
    );
    const ranked = rankMemories(c.memories, vectors, query, 4);
    c.retrieval = {
      admitted: ranked.map((r) => r.item.id),
      rejected: [
        ...c.retrieval.rejected.filter(
          (r) =>
            r.reason !==
            "Eligible; below the four-item semantic retrieval budget",
        ),
        ...c.memories
          .filter((m) => !ranked.some((r) => r.item.id === m.id))
          .map((m) => ({
            id: m.id,
            reason: "Eligible; below the four-item semantic retrieval budget",
          })),
      ],
      method: `${encoderModel} · 384D · cosine after authority/service/time filters · ${artifactHash.slice(0, 12)}`,
    };
  } catch {
    c.retrieval.method =
      "Encoder unavailable; bounded structured memories only, no semantic scores";
    c.retrieval.admitted = c.memories.slice(-4).map((m) => m.id);
  }
  const { hash: previous, ...body } = c;
  c.hash = hash(body);
  const fresh = c.memories.filter((m) => !persisted.has(m.id));
  if (db && fresh.length) {
    const items = fresh.map((m) => ({
      session_id: c.sessionId,
      id: m.id,
      person_id: c.personId,
      service_id: c.serviceId,
      kind: m.kind,
      epistemic: m.epistemic,
      text: m.text,
      available_from: m.availableFrom,
      content_hash: m.contentHash,
      derivation_version: m.derivationVersion,
      measurement: m.measurement ?? null,
    }));
    const evidence = fresh.flatMap((m) =>
      m.evidenceIds.map((id) => ({
        session_id: c.sessionId,
        memory_id: m.id,
        event_id: id,
      })),
    );
    const rows = fresh
      .filter((m) => vectors.has(m.id))
      .map((m) => ({
        session_id: c.sessionId,
        memory_id: m.id,
        model: encoderModel,
        artifact_hash: artifactHash,
        content_hash: m.contentHash,
        vector: JSON.stringify(vectors.get(m.id)),
      }));
    const insert = (table: string, sample: object, n: number) => {
      const cols = Object.keys(sample).join(",");
      return `insert into ${table}(${cols}) select ${cols} from jsonb_populate_recordset(null::${table}, $${n}::jsonb) on conflict do nothing`;
    };
    // Items, evidence links and embeddings in one statement (one round trip).
    await db.unsafe(
      `with i as (${insert("memory.items", items[0], 1)}),
        e as (${evidence.length ? insert("memory.evidence", evidence[0], 2) : "select 1 from (select $2::jsonb) z where false"}),
        v as (${rows.length ? insert("memory.embeddings", rows[0], 3) : "select 1 from (select $3::jsonb) z where false"})
      select 1`,
      [items, evidence, rows] as any[],
    );
  }
  if (db) {
    if (persisted.size > 10000) persisted.clear();
    for (const m of fresh) if (vectors.has(m.id)) persisted.add(m.id);
  }
  return c;
}
