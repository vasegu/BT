import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../server/engine.ts";
import { buildAssessmentRequest } from "../server/assessment.ts";
import { arbitrate } from "../server/arbiter.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Step } from "../src/types.ts";
const step = async (e: Engine, id: string, kind: Step) => {
  e.advance(id, kind, kind, e.session(id).revision);
  await e.processJobs();
  return e.snapshot(id);
};
const episode = (s: any, person: string, goal: string) =>
  s.operations.outcomes.find(
    (x: any) => x.person === person && x.goal === goal,
  );

test("delivery opens immutable expectations; separate observations close only their own targets", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    const first = await step(e, id, "heartbeat");
    assert.ok(
      (first.operations as any).outcomes,
      "outcome contracts must be visible",
    );
    const original = episode(first, "daniel", "callback");
    assert.equal(original.check.status, "waiting");
    assert.equal(original.dueAt, "2026-09-25T20:15:00Z");
    assert.ok(original.actionId);
    assert.equal(first.actions.length, 2);
    assert.equal(episode(first, "maya", "watch").actionId, null);
    await step(e, id, "incident");
    const restored = await step(e, id, "restore");
    assert.equal(episode(restored, "daniel", "service").check.status, "met");
    assert.equal(
      episode(restored, "daniel", "callback").check.status,
      "waiting",
    );
    assert.equal(
      episode(restored, "daniel", "confirmation").check.status,
      "waiting",
    );
    assert.equal(
      episode(restored, "sam", "activation").check.status,
      "waiting",
    );
    assert.equal(episode(restored, "maya", "watch").check.status, "met");
    const callback = await step(e, id, "callback");
    assert.equal(episode(callback, "daniel", "callback").check.status, "met");
    assert.equal(
      episode(callback, "daniel", "confirmation").check.status,
      "waiting",
    );
    const done = await step(e, id, "confirm");
    assert.equal(episode(done, "daniel", "confirmation").check.status, "met");
    assert.equal(episode(done, "sam", "activation").check.status, "waiting");
    assert.equal(episode(done, "daniel", "callback").id, original.id);
    assert.equal(episode(done, "daniel", "callback").dueAt, original.dueAt);
    assert.deepEqual(
      e.snapshot(id, 1).operations.outcomes,
      first.operations.outcomes,
    );
    await e.processJobs();
    assert.deepEqual(
      e.snapshot(id).operations.outcomes,
      done.operations.outcomes,
    );
  } finally {
    e.close();
  }
});

test("a due watch without proof is unverified; a late-arriving same-person observation resolves it only when known", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    await step(e, id, "heartbeat");
    await step(e, id, "incident");
    e.advance(id, "restore", "restore", 2);
    e.db
      .prepare(
        "UPDATE events SET received_at='2026-09-25T20:15:00Z' WHERE session_id=? AND type='router.heartbeat_received'",
      )
      .run(id);
    await e.processJobs();
    const at3 = e.snapshot(id);
    assert.equal(episode(at3, "maya", "watch").check.status, "unverified");
    assert.equal(episode(at3, "maya", "watch").check.evidenceIds.length, 0);
    const at4 = await step(e, id, "callback");
    assert.equal(episode(at4, "maya", "watch").check.status, "met");
    assert.equal(episode(at4, "maya", "watch").check.onTime, true);
    assert.equal(
      episode(e.snapshot(id, 3), "maya", "watch").check.status,
      "unverified",
    );
  } finally {
    e.close();
  }
});

test("stored outcome memory survives reopen and is scoped into the next arbiter request", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bt-outcomes-"));
  let e = new Engine(join(dir, "test.sqlite"));
  try {
    const { id } = e.createSession();
    await step(e, id, "heartbeat");
    await step(e, id, "incident");
    const before = await step(e, id, "restore");
    e.close();
    e = new Engine(join(dir, "test.sqlite"));
    const s = e.snapshot(id);
    assert.deepEqual(s.operations.outcomes, before.operations.outcomes);
    const h = s.households[0];
    const req = buildAssessmentRequest(h, s, arbitrate(h, h, s));
    const memory = req.state.outcomeMemory as any[];
    assert.ok(memory?.length, "Jev must see verification results");
    assert.ok(memory.some((x) => x.goal === "service" && x.status === "met"));
    assert.ok(
      memory.some((x) => x.goal === "callback" && x.status === "waiting"),
    );
    assert.ok(!JSON.stringify(memory).includes("maya"));
    assert.ok(
      !memory.some((x) => x.goal === "activation" || x.goal === "watch"),
    );
  } finally {
    e.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verification uses the latest observation within the original case and never borrows a later case failure", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    await step(e, id, "heartbeat");
    e.advance(id, "incident", "incident", 1);
    for (const [minute, type] of [
      [1, "service.restored_observed"],
      [2, "service.failure_observed"],
      [3, "service.restored_observed"],
    ] as const)
      e.append(id, 2, {
        type,
        subject: "daniel",
        source: "diagnostics_simulator",
        description: type,
        payload: {
          lineTest: type === "service.restored_observed" ? "passed" : "failed",
        },
        occurredAt: `2026-09-25T20:0${minute}:00Z`,
      });
    await e.processJobs();
    assert.equal(
      episode(e.snapshot(id), "daniel", "service").check.status,
      "met",
    );
    e.advance(id, "restore", "restore", 2);
    e.append(id, 3, {
      type: "case.opened",
      subject: "daniel",
      source: "crm_simulator",
      description: "A new fault case",
      payload: { owner: "Aisha", caseId: "DR-NEW" },
      occurredAt: "2026-09-25T20:10:00Z",
    });
    e.append(id, 3, {
      type: "service.failure_observed",
      subject: "daniel",
      source: "diagnostics_simulator",
      description: "Failure in the new case",
      payload: { lineTest: "failed" },
      occurredAt: "2026-09-25T20:11:00Z",
    });
    await e.processJobs();
    const original = e
      .snapshot(id)
      .operations.outcomes.find(
        (o) => o.goal === "service" && o.revision === 1,
      )!;
    assert.equal(original.check.status, "met");
    assert.equal(original.check.observedAt, "2026-09-25T20:03:00Z");
  } finally {
    e.close();
  }
});

test("wrong-person restoration and an unrelated promise receipt cannot satisfy a target", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    await step(e, id, "heartbeat");
    e.advance(id, "incident", "incident", 1);
    e.append(id, 2, {
      type: "service.restored_observed",
      subject: "sam",
      source: "diagnostics_simulator",
      description: "Sam line passed",
      payload: { lineTest: "passed" },
    });
    e.append(id, 2, {
      type: "promise.fulfilled",
      subject: "daniel",
      source: "adviser_simulator",
      description: "A different callback",
      payload: { promiseTime: "22:15" },
    });
    await e.processJobs();
    const s = e.snapshot(id);
    assert.equal(episode(s, "daniel", "service").check.status, "waiting");
    assert.equal(episode(s, "daniel", "callback").check.status, "waiting");
    assert.equal(
      s.households.find((h) => h.id === "daniel")!.promiseFulfilled,
      false,
    );
    assert.equal(episode(s, "sam", "activation").check.status, "waiting");
  } finally {
    e.close();
  }
});

test("fresh contrary evidence wins over earlier recovery within the same episode", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    await step(e, id, "heartbeat");
    await step(e, id, "incident");
    await step(e, id, "restore");
    e.advance(id, "callback", "callback", 3);
    e.append(id, 4, {
      type: "service.failure_observed",
      subject: "daniel",
      source: "diagnostics_simulator",
      description: "Line test failed again",
      payload: { lineTest: "failed" },
    });
    await e.processJobs();
    assert.equal(
      episode(e.snapshot(id), "daniel", "service").check.status,
      "contradicted",
    );
    assert.equal(
      e.snapshot(id).households.find((h) => h.id === "daniel")!.restored,
      false,
    );
    assert.equal(
      episode(e.snapshot(id, 3), "daniel", "service").check.status,
      "met",
    );
  } finally {
    e.close();
  }
});

test("a newer scoped incident overrides both an older personal fault and an intervening heartbeat", async () => {
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    await step(e, id, "heartbeat");
    e.advance(id, "incident", "incident", 1);
    e.append(id, 2, {
      type: "case.opened",
      subject: "maya",
      source: "crm_simulator",
      description: "Maya reports a problem",
      payload: { caseId: "M-1" },
      occurredAt: "2026-09-25T20:01:00Z",
    });
    e.append(id, 2, {
      type: "router.heartbeat_received",
      subject: "maya",
      source: "router_simulator",
      description: "A heartbeat returned",
      payload: { status: "received" },
      occurredAt: "2026-09-25T20:02:00Z",
    });
    e.append(id, 2, {
      type: "incident.confirmed",
      subject: "shared",
      source: "incident_simulator",
      description: "Fresh incident scope includes Maya",
      payload: { incidentId: "INC-M", affected: ["maya"] },
    });
    await e.processJobs();
    const watch = episode(e.snapshot(id), "maya", "watch");
    assert.equal(watch.check.status, "contradicted");
    assert.equal(watch.check.observedAt, "2026-09-25T20:03:00Z");
  } finally {
    e.close();
  }
});

test("an unrelated service failure cannot contradict broadband recovery", async () => {
  const { verifyOutcome } = await import("../server/outcomes.ts");
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    await step(e, id, "heartbeat");
    await step(e, id, "incident");
    const s = await step(e, id, "restore");
    const outcome = episode(s, "daniel", "service");
    const anchor = s.events.find((x) => x.id === outcome.scopeId)!;
    anchor.serviceId = "broadband";
    for (const event of s.events)
      if (event.subject === "daniel") event.serviceId = "broadband";
    s.events.push({
      ...anchor,
      id: "mobile-fault",
      serviceId: "mobile",
      type: "service.failure_observed",
      payload: { lineTest: "failed" },
      occurredAt: s.clock,
      receivedAt: s.clock,
      revision: s.cutoff,
    });
    assert.equal(verifyOutcome(outcome, s).status, "met");
  } finally {
    e.close();
  }
});

test("a shared incident on another service cannot contradict a broadband watch", async () => {
  const { verifyOutcome } = await import("../server/outcomes.ts");
  const e = new Engine(":memory:");
  try {
    const { id } = e.createSession();
    const s = await step(e, id, "heartbeat");
    const watch = episode(s, "maya", "watch");
    const anchor = s.events.find((x) => x.id === watch.scopeId)!;
    anchor.serviceId = "broadband";
    s.events.push({
      ...anchor,
      id: "mobile-incident",
      subject: "shared",
      type: "incident.confirmed",
      payload: { affected: ["maya"] },
      affectedServiceIds: ["mobile"],
    } as any);
    assert.equal(verifyOutcome(watch, s).status, "waiting");
    (s.events.at(-1) as any).affectedServiceIds = ["broadband"];
    assert.equal(verifyOutcome(watch, s).status, "contradicted");
  } finally {
    e.close();
  }
});
