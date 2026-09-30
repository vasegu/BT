import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine, steps } from "../server/engine.ts";
import { readFileSync } from "node:fs";
import { contextSway, FACTORS } from "../server/context-sway.ts";

test("context sway replays every recorded moment with each fact flipped, without leaking the answer", { timeout: 300000 }, async () => {
  const engine = new Engine(":memory:");
  try {
    const s = engine.createSession();
    for (const [i, step] of steps.entries()) {
      engine.advance(s.id, step, `sway-${i}`, i);
      await engine.processJobs();
    }
    const snap = engine.snapshot(s.id);
    const before = JSON.stringify(snap);
    const r = await contextSway(snap, (at) => engine.snapshot(s.id, at));
    assert.equal(JSON.stringify(snap), before, "read-only: the snapshot is not mutated");
    assert.equal(r.bases, steps.length * 3);
    const pairs = (FACTORS.length * (FACTORS.length - 1)) / 2;
    assert.equal(r.points.length, r.bases * (2 + FACTORS.length + pairs));
    assert.equal(r.points.filter((p) => p.kind === "recorded").length, steps.length * 3);
    // Rules-only replay: the live decision and the policy replay must agree.
    assert.equal(r.policyAgreement, 1);
    // The policy must not be moved by an unverified customer claim in the prompt.
    assert.equal(r.factors.find((f) => f.id === "claim")!.sway, 0);
    // A confirmed incident does change the plan for some homes.
    assert.ok(r.factors.find((f) => f.id === "incident")!.sway > 0);
    // Sway is a proportion of base contexts and sorted descending.
    for (const f of r.factors) assert.ok(f.sway >= 0 && f.sway <= 1 && f.changed <= f.bases);
    assert.deepEqual(r.factors.map((f) => f.sway), [...r.factors.map((f) => f.sway)].sort((a, b) => b - a));
    // The embedded context is what the agent saw, not the policy's candidate list.
    const titles = new Set(r.points.map((p) => p.title));
    // Only the policy's candidate list is excluded; state strings (e.g. an activation status)
    // legitimately share wording with some plan titles, so the facts lines are skipped.
    for (const p of r.points.filter((p) => p.kind === "base")) {
      const observations = p.text.split("\n").slice(3).join("\n");
      for (const t of titles) assert.ok(!observations.includes(t), `candidate title leaked: ${t}`);
    }
    for (const p of r.points) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    // The shipped all-customer review must match what today's dataset + policy produce.
    const baked = JSON.parse(readFileSync(new URL("../public/context-sway.json", import.meta.url), "utf8"));
    assert.equal(baked.provenance?.scope, "global-static-fixture");
    assert.equal(baked.provenance.datasetVersion, snap.session.seedVersion);
    assert.deepEqual(baked.provenance.policyVersions, [...new Set(snap.decisions.map(d => d.policyVersion))].sort());
    assert.ok(Number.isFinite(Date.parse(baked.provenance.builtAt)));
    assert.match(baked.provenance.sourceHash, /^[a-f0-9]{64}$/);
    assert.equal(baked.fingerprint, r.fingerprint, "public/context-sway.json is stale: run npm run build:sway");
    assert.deepEqual(
      baked.factors.map((f: { id: string; sway: number }) => [f.id, f.sway]),
      r.factors.map((f) => [f.id, f.sway]),
    );
    assert.deepEqual(baked.points.map((p: { id: string; action: string }) => [p.id, p.action]), r.points.map((p) => [p.id, p.action]));
  } finally {
    engine.close();
  }
});
