import { embed } from "./encoder.ts";
import { projectVectors } from "./behaviour.ts";
import type { ContextBundle } from "./context.ts";
import type { SourceEvent } from "../src/types.ts";
const cache = new Map<string, Promise<unknown>>();
export function memoryAtlas(c: ContextBundle, events: SourceEvent[]) {
  if (cache.has(c.hash)) return cache.get(c.hash)!;
  const task = (async () => {
    const items = c.memories;
    if (!items.length)
      throw new Error("No eligible memory episodes at this cutoff");
    const vectors = await Promise.all(items.map((m) => embed(m.text)));
    const text = `Current service: ${c.household.serviceState}. ${c.household.caseStatus === "open" ? "Previous diagnostics and customer support, existing callback commitments." : "Customer contact preference and observed overnight routine."}`;
    const query = await embed(text),
      projection = await projectVectors([...vectors, query], 3);
    const colors = ["#6d4aaf", "#3f7f8b", "#b4784f"];
    const groups = [
      ...new Set(
        projection.points.slice(0, items.length).map((p) => p.cluster),
      ),
    ];
    return {
      manifest: {
        projection: { explainedVariance: projection.variance },
        clustering: {
          method:
            "Spherical k-means of actual memory vectors; geometric PCA axes",
          cosineSilhouette: null,
        },
      },
      episodes: items.map((m, i) => ({
        id: m.id,
        title: m.text.length > 95 ? m.text.slice(0, 92) + "…" : m.text,
        text: m.text,
        category: m.epistemic,
        vector: vectors[i],
        position: projection.points[i].position,
        clusterId: String(projection.points[i].cluster),
        recordIds: m.evidenceIds,
      })),
      clusters: groups.map((id) => ({
        id: String(id),
        label: `Semantic group ${id + 1}`,
        color: colors[id % colors.length],
        size: projection.points
          .slice(0, items.length)
          .filter((p) => p.cluster === id).length,
      })),
      records: events.map((e) => ({
        id: e.id,
        text: `${e.occurredAt} · ${e.source} · ${e.description}`,
      })),
      queries: [
        {
          id: "current",
          text,
          vector: query,
          position: projection.points.at(-1)!.position,
        },
      ],
    };
  })().catch((e) => {
    cache.delete(c.hash);
    throw e;
  });
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  cache.set(c.hash, task);
  return task;
}
