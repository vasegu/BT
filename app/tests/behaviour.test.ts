import { expressionPairs } from "../src/expression-pairs.ts";
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

test("context geometry is unchanged when only the chosen action and its explanation change", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    e.advance(id, "heartbeat", "one", 0);
    await e.processJobs();
    const s = e.snapshot(id),
      before = behaviourRuns(s, (at) => e.snapshot(id, at));
    s.decisions[0].title = "A completely different action";
    s.decisions[0].reason = "Outcome leaked into the explanation";
    s.decisions[0].trace!.selectedId = "offer";
    const after = behaviourRuns(s, (at) => e.snapshot(id, at));
    assert.equal(after[0].input, before[0].input);
    assert.ok(!after[0].input.includes("Decision:"));
    assert.ok(!after[0].input.includes("Effect:"));
  } finally {
    e.close();
  }
});

test("sensitivity measures action distributions independently of factual similarity and flags changed prompts", async () => {
  const { distributionShift, contextContrasts } =
    await import("../server/behaviour.ts");
  assert.equal(distributionShift({ watch: 1 }, { recovery: 1 }), 1);
  assert.equal(
    distributionShift(
      { watch: 0.6, recovery: 0.4 },
      { watch: 0.2, recovery: 0.8 },
    ),
    0.4,
  );
  assert.equal(distributionShift(null, { watch: 1 }), null);
  assert.equal(distributionShift({ watch: 2 }, { watch: 1 }), null);
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    e.advance(id, "heartbeat", "one", 0);
    await e.processJobs();
    const runs = behaviourRuns(e.snapshot(id), (at) => e.snapshot(id, at));
    assert.deepEqual(
      contextContrasts(runs, [
        [1, 0],
        [1, 0],
        [0, 1],
      ]),
      [],
      "Rule outputs must not become model probabilities",
    );
    const a = {
      ...runs[0],
      model: "test-model",
      probabilities: { watch: 1 },
      promptHash: "fixed",
      promptVersion: "v1",
      facts: { habit: "overnight" },
      selectedAction: "watch",
    };
    const b = {
      ...runs[1],
      model: "test-model",
      probabilities: { recovery: 1 },
      promptHash: "fixed",
      promptVersion: "v1",
      facts: { habit: "overnight" },
      selectedAction: "recovery",
    };
    const pair = contextContrasts(
      [a, b],
      [
        [1, 0],
        [1, 0],
      ],
    )[0];
    assert.equal(pair.similarity, 1);
    assert.equal(pair.actionShift, 1);
    assert.equal(pair.samePrompt, true);
    assert.deepEqual(pair.facts, []);
    assert.equal(
      contextContrasts(
        [a, { ...b, promptHash: "edited" }],
        [
          [1, 0],
          [1, 0],
        ],
      )[0].samePrompt,
      false,
    );
    assert.deepEqual(
      contextContrasts(
        [a, { ...b, model: "another-model" }],
        [
          [1, 0],
          [1, 0],
        ],
      ),
      [],
    );
  } finally {
    e.close();
  }
});

test("recorded expressions distinguish wording inside one action without inventing generated tone", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    e.advance(id, "heartbeat", "one", 0); await e.processJobs();
    e.advance(id, "incident", "two", 1); await e.processJobs();
    const s = e.snapshot(id), runs = behaviourRuns(s, at => e.snapshot(id, at));
    const daniel = runs.find(r => r.person === "daniel" && r.revision === 2)!;
    const sam = runs.find(r => r.person === "sam" && r.revision === 2)!;
    assert.equal(daniel.selectedAction, sam.selectedAction);
    const expressions=expressionPairs(runs);
    assert.ok(expressions.some(p=>[p.a,p.b].includes(daniel.id)&&[p.a,p.b].includes(sam.id)));
    assert.ok(expressions.every(p=>p.actionShift===null));
    assert.match(daniel.expression.messages[0].body, /will still call/);
    assert.doesNotMatch(sam.expression.messages[0].body, /will still call/);
    assert.notEqual(daniel.expression.summary, sam.expression.summary);
    assert.match(daniel.expression.provenance, /template/);
    const old = daniel.expression.summary;
    s.actions.find(a => a.decisionId === daniel.id)!.body = "Buy a gaming package instead.";
    const mutated = behaviourRuns(s, at => e.snapshot(id, at)).find(r => r.id === daniel.id)!;
    assert.notEqual(mutated.expression.summary, old, "Changing actual wording must change the behaviour embedding input");
    assert.equal(mutated.input, daniel.input, "Output changes must not contaminate input geometry");
    const watch = runs.find(r => r.person === "maya")!;
    assert.equal(watch.expression.messages.length, 0);
    assert.equal(watch.expression.channel, "No customer contact");
  } finally { e.close(); }
});
