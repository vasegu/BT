import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateHistory } from "../../scripts/generate-bt-history.ts";
import { buildMemoryMap, layerOf } from "../server/memory-map.ts";
import { clocks } from "../server/engine.ts";

test("memory map gives each person their own space and places tonight's signal in it", { timeout: 300000 }, async () => {
  const m = await buildMemoryMap(generateHistory({ variant: "canonical" }));
  for (const p of [...m.points, ...m.queries]) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1);
  for (const p of m.points) {
    assert.equal(layerOf({ type: p.type, payload: { speakerRole: "customer" } } as never), p.layer);
    assert.equal(p.count, p.ids.length);
  }
  assert.equal(m.queries.length, (clocks.length - 1) * 3);
  const byKey = new Map(m.points.map((p) => [`${p.person}/${p.id}`, p]));
  for (const q of m.queries) {
    assert.ok(q.neighbours.length > 0 && q.neighbours.length <= 5);
    // Neighbours come from the same person's memory, held before this moment.
    for (const n of q.neighbours) assert.ok(byKey.get(`${q.person}/${n.id}`), "neighbours come from the same household");
  }
  // The same 21:00 signal reminds us of something different in each home.
  const first = (person: string) => byKey.get(`${person}/${m.queries.find((q) => q.person === person && q.revision === 1)!.neighbours[0].id}`)!.type;
  assert.equal(first("daniel"), "case.opened");
  assert.equal(first("sam"), "order.delivered");
  assert.equal(first("maya"), "router.heartbeat_received");
  const baked = JSON.parse(readFileSync(new URL("../public/memory-map.json", import.meta.url), "utf8"));
  assert.equal(baked.fingerprint, m.fingerprint, "public/memory-map.json is stale: run npm run build:memory");
  assert.deepEqual(baked.queries.map((q: { neighbours: unknown }) => q.neighbours), m.queries.map((q) => q.neighbours));
});
