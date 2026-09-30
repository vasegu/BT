import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine } from "../server/engine.ts";

test("fresh incident scope overrides a remembered quiet habit everywhere", async () => {
  const engine = new Engine(":memory:");
  try {
    const { id } = engine.createSession();
    engine.advance(id, "heartbeat", "start", 0);
    engine.append(id, 1, {
      type: "incident.confirmed",
      subject: "shared",
      source: "incident_simulator",
      description: "Fresh scope includes Maya.",
      payload: { incidentId: "INC-NEW", affected: ["maya"] },
    });
    await engine.processJobs();
    const s = engine.snapshot(id);
    const d = s.decisions.find((d) => d.person === "maya")!;
    assert.equal(d.domain, "network");
    assert.deepEqual(s.operations.incident?.affected, ["maya"]);
    assert.equal(s.operations.incident?.id, "INC-NEW");
    assert.equal(s.actions.filter((a) => a.person === "maya").length, 1);
    assert.ok(!d.reason.includes("outside"));
  } finally {
    engine.close();
  }
});

test("a new case overrides a quiet habit without losing the remembered preference", async () => {
  const engine = new Engine(":memory:");
  try {
    const { id } = engine.createSession();
    engine.advance(id, "heartbeat", "start", 0);
    engine.append(id, 1, {
      type: "case.opened",
      subject: "maya",
      source: "crm_simulator",
      description: "Maya reports a fault tonight.",
      payload: { owner: "Care team", caseId: "M-1" },
    });
    await engine.processJobs();
    const s = engine.snapshot(id);
    assert.equal(
      s.decisions.find((d) => d.person === "maya")?.domain,
      "recovery",
    );
    assert.equal(
      s.households.find((h) => h.id === "maya")?.habit,
      "Router switched off overnight",
    );
    assert.equal(s.actions.filter((a) => a.person === "maya").length, 1);
  } finally {
    engine.close();
  }
});

test("the persisted arbitration trace links the trigger, constraints, memory delta and delivery", async () => {
  const engine = new Engine(":memory:");
  try {
    const { id } = engine.createSession();
    await step(engine, id, "heartbeat");
    const s = await step(engine, id, "incident");
    const d = s.decisions.findLast((d) => d.person === "daniel")!;
    const trace = (d as any).trace;
    assert.ok(trace, "new decisions retain their technical trace");
    assert.equal(trace.triggerIds.length, 1);
    assert.equal(
      s.events.find((e) => e.id === trace.triggerIds[0])?.type,
      "incident.confirmed",
    );
    const selected = trace.candidates.find((c: any) => c.status === "selected");
    assert.equal(selected.id, trace.selectedId);
    assert.equal(selected.id, "incident");
    assert.ok(
      trace.candidates
        .find((c: any) => c.id === "restart")
        .checks.some((c: any) => c.state === "fail"),
    );
    assert.ok(
      trace.changes.some(
        (c: any) => c.field === "incident" && c.after === "true",
      ),
    );
    assert.ok(
      trace.execution.some(
        (e: any) =>
          e.actionId === s.actions.find((a) => a.decisionId === d.id)?.id,
      ),
    );
    const before = engine.snapshot(id, 1);
    assert.ok(
      before.decisions.every(
        (d) => !d.evidenceIds.includes(trace.triggerIds[0]),
      ),
    );
    assert.deepEqual(
      engine.snapshot(id).decisions.find((d2) => d2.id === d.id),
      d,
    );
  } finally {
    engine.close();
  }
});

test("callback capacity is projected from its source and gates new appointments", async () => {
  const engine = new Engine(":memory:");
  try {
    const { id } = engine.createSession();
    engine.advance(id, "heartbeat", "start", 0);
    engine.append(id, 1, {
      type: "capacity.recorded",
      subject: "shared",
      source: "rota_simulator",
      description: "All callback capacity allocated.",
      payload: {
        slots: [
          { time: "21:15", owner: "Aisha", person: "daniel" },
          { time: "21:30", owner: "Care team", person: "sam" },
        ],
      },
    });
    await engine.processJobs();
    const s = engine.snapshot(id);
    assert.equal(s.operations.slots.filter((slot) => !slot.person).length, 0);
    const candidate = (
      s.decisions.find((d) => d.person === "sam") as any
    ).trace.candidates.find((c: any) => c.id === "callback");
    assert.ok(
      candidate.checks.some(
        (c: any) => c.id === "capacity" && c.state === "fail",
      ),
    );
    assert.notEqual(candidate.status, "selected");
  } finally {
    engine.close();
  }
});

test("service authority for another channel cannot authorise an in-app delivery", async () => {
  const engine = new Engine(":memory:");
  try {
    const { id } = engine.createSession();
    engine.advance(id, "heartbeat", "start", 0);
    engine.append(id, 1, {
      type: "contact.authority_recorded",
      subject: "daniel",
      source: "identity_simulator",
      description: "SMS service contact only.",
      payload: {
        role: "account_holder",
        purpose: "service",
        channel: "sms",
        allowed: true,
      },
    });
    await engine.processJobs();
    const s = engine.snapshot(id);
    assert.equal(s.actions.filter((a) => a.person === "daniel").length, 0);
    const d = s.decisions.find((d) => d.person === "daniel")!;
    assert.ok(
      d.trace?.execution.some(
        (e) => e.stage === "Contact authority" && e.status === "held",
      ),
    );
  } finally {
    engine.close();
  }
});

test("an incident-only customer can recover without an existing care case", async () => {
  const engine = new Engine(":memory:");
  try {
    const { id } = engine.createSession();
    await step(engine, id, "heartbeat");
    engine.advance(id, "incident", "incident", 1);
    engine.append(id, 2, {
      type: "incident.confirmed",
      subject: "shared",
      source: "incident_simulator",
      description: "Maya is now in the affected-service register.",
      payload: { incidentId: "INC-017", affected: ["daniel", "sam", "maya"] },
    });
    await engine.processJobs();
    const s = await step(engine, id, "restore");
    assert.equal(s.failedJobs, 0);
    assert.equal(
      s.decisions.filter((d) => d.person === "maya").at(-1)?.trace?.selectedId,
      "restoration",
    );
    assert.ok(
      s.actions.some(
        (a) => a.person === "daniel" && a.title === "Your connection is back",
      ),
    );
  } finally {
    engine.close();
  }
});

test("a later fault report supersedes an earlier recovery observation", async () => {
  const engine = new Engine(":memory:");
  try {
    const { id } = engine.createSession();
    await step(engine, id, "heartbeat");
    await step(engine, id, "incident");
    await step(engine, id, "restore");
    engine.advance(id, "callback", "later", 3);
    engine.append(id, 4, {
      type: "case.opened",
      subject: "maya",
      source: "crm_simulator",
      description: "A new fault after the earlier heartbeat returned.",
      payload: { owner: "Care team", caseId: "M-2" },
    });
    await engine.processJobs();
    const s = engine.snapshot(id);
    assert.equal(s.households.find((h) => h.id === "maya")?.restored, false);
    assert.equal(
      s.decisions.filter((d) => d.person === "maya").at(-1)?.domain,
      "recovery",
    );
    assert.equal(
      engine.snapshot(id, 3).households.find((h) => h.id === "maya")?.restored,
      true,
    );
  } finally {
    engine.close();
  }
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "bt-test-"));
  let engine = new Engine(join(dir, "state.sqlite"));
  return {
    get engine() {
      return engine;
    },
    reopen() {
      engine.close();
      engine = new Engine(join(dir, "state.sqlite"));
    },
    cleanup() {
      engine.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
async function step(engine: Engine, id: string, name: string, key = name) {
  const snapshot = engine.snapshot(id);
  engine.advance(id, name, key, snapshot.session.revision);
  await engine.processJobs();
  return engine.snapshot(id);
}

test("the same heartbeat makes three distinct evidence-backed decisions", async () => {
  const f = fixture();
  try {
    const session = f.engine.createSession();
    assert.ok(session?.id, "session is persisted");
    const s = await step(f.engine, session.id, "heartbeat");
    assert.equal(s.decisions.length, 3);
    assert.equal(
      s.decisions.find((d: any) => d.person === "maya").disposition,
      "watch",
    );
    assert.equal(
      s.decisions.find((d: any) => d.person === "sam").domain,
      "activation",
    );
    assert.equal(
      s.decisions.find((d: any) => d.person === "daniel").domain,
      "recovery",
    );
    assert.equal(s.actions.filter((a: any) => a.person === "maya").length, 0);
    assert.ok(
      s.actions.every(
        (a: any) => a.receiptId && a.status === "simulated_delivered",
      ),
    );
    assert.ok(s.decisions.every((d: any) => d.evidenceIds.length > 1));
  } finally {
    f.cleanup();
  }
});

test("duplicate submission is idempotent and stale presenters cannot advance", async () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    assert.ok(a?.id);
    const receipt = f.engine.advance(a.id, "heartbeat", "same-key", 0);
    const duplicate = f.engine.advance(a.id, "heartbeat", "same-key", 0);
    assert.deepEqual(duplicate, receipt);
    await f.engine.processJobs();
    const before = f.engine.snapshot(a.id);
    assert.throws(
      () => f.engine.advance(a.id, "incident", "next", 0),
      /stale|revision/i,
    );
    assert.throws(
      () => f.engine.advance(a.id, "incident", "same-key", 1),
      /idempotency|different/i,
    );
    await f.engine.processJobs();
    const after = f.engine.snapshot(a.id);
    assert.deepEqual(after.actions, before.actions);
    assert.equal(after.events.length, before.events.length);
  } finally {
    f.cleanup();
  }
});

test("restoration cannot fulfil a promise; later outcomes stay out of historical reads", async () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    assert.ok(a?.id);
    await step(f.engine, a.id, "heartbeat");
    await step(f.engine, a.id, "incident");
    let s = await step(f.engine, a.id, "restore");
    let daniel = s.households.find((p: any) => p.id === "daniel");
    assert.equal(daniel.restored, true);
    assert.equal(daniel.promiseFulfilled, false);
    assert.equal(daniel.confirmed, false);
    assert.equal(daniel.caseStatus, "open");
    await step(f.engine, a.id, "callback");
    await step(f.engine, a.id, "confirm");
    s = f.engine.snapshot(a.id);
    daniel = s.households.find((p: any) => p.id === "daniel");
    assert.equal(daniel.promiseFulfilled, true);
    assert.equal(daniel.confirmed, true);
    assert.equal(daniel.caseStatus, "closed");
    const past = f.engine.snapshot(a.id, 3);
    assert.equal(
      past.households.find((p: any) => p.id === "daniel").promiseFulfilled,
      false,
    );
    assert.ok(past.events.every((e: any) => e.revision <= 3));
    assert.ok(past.decisions.every((d: any) => d.revision <= 3));
    assert.ok(past.actions.every((a: any) => a.revision <= 3));
    assert.equal(past.historical, true);
    assert.equal(past.nextStep, null);
  } finally {
    f.cleanup();
  }
});

test("sessions isolate incident membership, records and actions", async () => {
  const f = fixture();
  try {
    const a = f.engine.createSession(),
      b = f.engine.createSession();
    assert.ok(a?.id && b?.id);
    await step(f.engine, a.id, "heartbeat");
    const s = await step(f.engine, a.id, "incident");
    assert.equal(
      s.households.find((p: any) => p.id === "maya").incident,
      false,
    );
    assert.equal(s.households.find((p: any) => p.id === "sam").incident, true);
    const other = f.engine.snapshot(b.id);
    assert.equal(other.session.step, 0);
    assert.equal(other.operations.incident, null);
    assert.equal(other.actions.length, 0);
    assert.ok(other.events.every((e: any) => e.sessionId === b.id));
    assert.throws(() => f.engine.snapshot("missing"), /not found/i);
  } finally {
    f.cleanup();
  }
});

test("pending work and receipts survive reopen; retry does not deliver twice", async () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    assert.ok(a?.id);
    f.engine.advance(a.id, "heartbeat", "resume-me", 0);
    f.reopen();
    assert.equal(f.engine.snapshot(a.id).pendingJobs, 1);
    await f.engine.processJobs();
    const before = f.engine.snapshot(a.id);
    assert.equal(before.pendingJobs, 0);
    // Only Sam is messaged at 21:00; Daniel's owner has just spoken to him, so his drop goes on the case.
    assert.equal(before.actions.length, 1);
    f.reopen();
    await f.engine.processJobs();
    const after = f.engine.snapshot(a.id);
    assert.deepEqual(after.actions, before.actions);
    assert.deepEqual(after.decisions, before.decisions);
  } finally {
    f.cleanup();
  }
});

test("rejects unsupported steps and out-of-order outcomes without writing events", async () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    assert.ok(a?.id);
    const before = f.engine.snapshot(a.id);
    assert.throws(
      () => f.engine.advance(a.id, "confirm", "skip", 0),
      /next|order/i,
    );
    assert.throws(
      () => f.engine.advance(a.id, "made_up", "wrong", 0),
      /step|unsupported/i,
    );
    assert.throws(() => f.engine.advance(a.id, "heartbeat", "", 0), /key/i);
    assert.throws(() => f.engine.snapshot(a.id, 9), /cutoff/i);
    assert.equal(f.engine.snapshot(a.id).events.length, before.events.length);
  } finally {
    f.cleanup();
  }
});

test("service contact authority comes from a scoped source record", async () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    assert.ok(a?.id);
    const s = f.engine.snapshot(a.id);
    for (const h of s.households) {
      assert.ok(
        h.evidence.some(
          (e: any) =>
            e.type === "contact.authority_recorded" && e.subject === h.id,
        ),
      );
      assert.equal(h.contactAllowed, true);
    }
  } finally {
    f.cleanup();
  }
});

test("a decision cannot claim incident exclusion before the incident exists", async () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    let s = await step(f.engine, a.id, "heartbeat");
    assert.equal(s.operations.incident, null);
    assert.doesNotMatch(
      s.decisions.find((d: any) => d.person === "maya").reason,
      /INC-017/,
    );
    s = await step(f.engine, a.id, "incident");
    assert.match(
      s.decisions.filter((d: any) => d.person === "maya").at(-1).reason,
      /outside INC-017/,
    );
  } finally {
    f.cleanup();
  }
});
