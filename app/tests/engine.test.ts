import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine } from "../server/engine.ts";

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
function step(engine: Engine, id: string, name: string, key = name) {
  const snapshot = engine.snapshot(id);
  engine.advance(id, name, key, snapshot.session.revision);
  engine.processJobs();
  return engine.snapshot(id);
}

test("the same heartbeat makes three distinct evidence-backed decisions", () => {
  const f = fixture();
  try {
    const session = f.engine.createSession();
    assert.ok(session?.id, "session is persisted");
    const s = step(f.engine, session.id, "heartbeat");
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

test("duplicate submission is idempotent and stale presenters cannot advance", () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    assert.ok(a?.id);
    const receipt = f.engine.advance(a.id, "heartbeat", "same-key", 0);
    const duplicate = f.engine.advance(a.id, "heartbeat", "same-key", 0);
    assert.deepEqual(duplicate, receipt);
    f.engine.processJobs();
    const before = f.engine.snapshot(a.id);
    assert.throws(
      () => f.engine.advance(a.id, "incident", "next", 0),
      /stale|revision/i,
    );
    assert.throws(
      () => f.engine.advance(a.id, "incident", "same-key", 1),
      /idempotency|different/i,
    );
    f.engine.processJobs();
    const after = f.engine.snapshot(a.id);
    assert.deepEqual(after.actions, before.actions);
    assert.equal(after.events.length, before.events.length);
  } finally {
    f.cleanup();
  }
});

test("restoration cannot fulfil a promise; later outcomes stay out of historical reads", () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    assert.ok(a?.id);
    step(f.engine, a.id, "heartbeat");
    step(f.engine, a.id, "incident");
    let s = step(f.engine, a.id, "restore");
    let daniel = s.households.find((p: any) => p.id === "daniel");
    assert.equal(daniel.restored, true);
    assert.equal(daniel.promiseFulfilled, false);
    assert.equal(daniel.confirmed, false);
    assert.equal(daniel.caseStatus, "open");
    step(f.engine, a.id, "callback");
    step(f.engine, a.id, "confirm");
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

test("sessions isolate incident membership, records and actions", () => {
  const f = fixture();
  try {
    const a = f.engine.createSession(),
      b = f.engine.createSession();
    assert.ok(a?.id && b?.id);
    step(f.engine, a.id, "heartbeat");
    const s = step(f.engine, a.id, "incident");
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

test("pending work and receipts survive reopen; retry does not deliver twice", () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    assert.ok(a?.id);
    f.engine.advance(a.id, "heartbeat", "resume-me", 0);
    f.reopen();
    assert.equal(f.engine.snapshot(a.id).pendingJobs, 1);
    f.engine.processJobs();
    const before = f.engine.snapshot(a.id);
    assert.equal(before.pendingJobs, 0);
    assert.equal(before.actions.length, 2);
    f.reopen();
    f.engine.processJobs();
    const after = f.engine.snapshot(a.id);
    assert.deepEqual(after.actions, before.actions);
    assert.deepEqual(after.decisions, before.decisions);
  } finally {
    f.cleanup();
  }
});

test("rejects unsupported steps and out-of-order outcomes without writing events", () => {
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

test("service contact authority comes from a scoped source record", () => {
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

test("a decision cannot claim incident exclusion before the incident exists", () => {
  const f = fixture();
  try {
    const a = f.engine.createSession();
    let s = step(f.engine, a.id, "heartbeat");
    assert.equal(s.operations.incident, null);
    assert.doesNotMatch(
      s.decisions.find((d: any) => d.person === "maya").reason,
      /INC-017/,
    );
    s = step(f.engine, a.id, "incident");
    assert.match(
      s.decisions.filter((d: any) => d.person === "maya").at(-1).reason,
      /outside INC-017/,
    );
  } finally {
    f.cleanup();
  }
});
