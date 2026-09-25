import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../server/engine.ts";
import { behaviourRuns, projectVectors } from "../server/behaviour.ts";

test("run inputs stay frozen while outcome overlays respect the requested cutoff", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    e.advance(id, "heartbeat", "one", 0);
    await e.processJobs();
    const before = behaviourRuns(e.snapshot(id), (at) => e.snapshot(id, at));
    assert.equal(before.length, 3);
    assert.equal(before.find((r) => r.person === "daniel")?.outcome, "pending");
    for (const [i, step] of [
      "incident",
      "restore",
      "callback",
      "confirm",
    ].entries()) {
      e.advance(id, step as "incident", `next-${i}`, i + 1);
      await e.processJobs();
    }
    const current = behaviourRuns(e.snapshot(id), (at) => e.snapshot(id, at));
    assert.equal(current.length, 15);
    const original = current.find((r) => r.id === before[0].id)!;
    assert.equal(original.input, before[0].input);
    assert.deepEqual(original.evidenceIds, before[0].evidenceIds);
    assert.equal(
      current.find((r) => r.person === "daniel")?.outcome,
      "verified",
    );
    assert.deepEqual(
      behaviourRuns(e.snapshot(id, 1), (at) => e.snapshot(id, at)),
      before,
    );
    assert.ok(before.every((r) => !r.input.includes("INC-017")));
    assert.ok(
      current.some(
        (r) => r.revision === 2 && r.input.includes("Confirmed incident"),
      ),
    );
    assert.equal(
      behaviourRuns(e.snapshot(id, 0), (at) => e.snapshot(id, at)).length,
      0,
    );
  } finally {
    e.close();
  }
});

test("a committed message without a verification contract is not labelled successful", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    e.advance(id, "heartbeat", "one", 0);
    await e.processJobs();
    const s = e.snapshot(id);
    s.operations.outcomes = [];
    assert.ok(
      behaviourRuns(s, (at) => e.snapshot(id, at)).every(
        (r) => r.outcome === "unknown",
      ),
    );
  } finally {
    e.close();
  }
});

test("projection handles empty and repeated vectors without invented coordinates", async () => {
  assert.deepEqual((await projectVectors([])).points, []);
  const duplicate = await projectVectors([
    [1, 0, 0],
    [1, 0, 0],
    [1, 0, 0],
  ]);
  assert.ok(duplicate.points.every((p) => p.position.every((n) => n === 0)));
  assert.equal(duplicate.clusters, 1);
  assert.equal(duplicate.points[0].neighbours[0].similarity, 1);
  assert.deepEqual(duplicate.variance, [0, 0]);
});

test("PCA preserves pairwise distances in a rank-two fixture and neighbours use cosine", async () => {
  const result = await projectVectors([
    [1, 0, 0],
    [0, 1, 0],
    [-1, 0, 0],
    [1, 0, 0],
  ]);
  const distance = Math.hypot(
    ...result.points[0].position.map(
      (v, i) => v - result.points[1].position[i],
    ),
  );
  assert.ok(Math.abs(distance - Math.SQRT2) < 1e-6);
  assert.equal(result.points[0].neighbours[0].index, 3);
  assert.equal(result.points[0].neighbours[0].similarity, 1);
  assert.deepEqual(result.points[0].position, result.points[3].position);
  assert.ok(Math.abs(result.variance.reduce((a, b) => a + b, 0) - 1) < 1e-6);
});
