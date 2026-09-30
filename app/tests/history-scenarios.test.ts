import { test } from "node:test";
import assert from "node:assert/strict";
import { generateHistory, fixtureHash } from "../../scripts/generate-bt-history.ts";
import { buildContext } from "../server/context.ts";
import { clocks, project } from "../server/engine.ts";
import { arbitrate, serviceMessage } from "../server/arbiter.ts";
import { contractsFor, verifyOutcome } from "../server/outcomes.ts";
import type { Snapshot } from "../src/types.ts";
function replay(variant = "canonical") {
  const f = generateHistory({ variant });
  return clocks.map((clock, at) => {
    const contexts = ["daniel", "sam", "maya"].map((alias) =>
      buildContext({
        fixture: f,
        sessionId: "test",
        personId: f.tables["customer.people"].find((p) => p.alias === alias)!
          .id,
        serviceId: f.tables["customer.services"].find(
          (s) => s.reference === `svc_${alias}_broadband`,
        )!.id,
        cutoff: clock,
        purpose: "service",
      }),
    );
    return {
      session: {
        id: "test",
        seedVersion: f.datasetVersion,
        revision: 5,
        step: 5,
        createdAt: clocks[0],
      },
      clock,
      cutoff: at,
      historical: at < 5,
      pendingJobs: 0,
      failedJobs: 0,
      households: contexts.map((c) => c.household),
      events: [
        ...new Map(
          contexts.flatMap((c) => c.evidence).map((e) => [e.id, e]),
        ).values(),
      ],
      decisions: [],
      actions: [],
      operations: { ...contexts[0].operations, outcomes: [] },
      nextStep: null,
    } as Snapshot;
  });
}
test("eight perturbations preserve obligations and alter only justified decisions", () => {
  const baseline = replay();
  for (const variant of [
    "late-diagnostic",
    "duplicate-delivery",
    "corrected-scope",
    "revoked-contact",
    "slot-conflict",
    "unmet-promise",
    "gamer-claim",
    "recurrent-failure",
  ]) {
    const run = replay(variant);
    for (let i = 1; i < 6; i++)
      for (const h of run[i].households) {
        const d = arbitrate(
          h,
          run[i - 1].households.find((p) => p.id === h.id)!,
          run[i],
        );
        const offer = d.trace!.candidates.find((c) => c.id === "offer");
        assert.notEqual(offer?.status, "selected");
        if (variant === "gamer-claim" || variant === "duplicate-delivery")
          assert.equal(
            d.trace!.selectedId,
            arbitrate(
              baseline[i].households.find((p) => p.id === h.id)!,
              baseline[i - 1].households.find((p) => p.id === h.id)!,
              baseline[i],
            ).trace!.selectedId,
          );
        if (variant === "revoked-contact" && h.id === "daniel")
          assert.equal(serviceMessage(h, d), null);
      }
    if (variant === "corrected-scope")
      assert.equal(run[3].households[2].incident, true);
    if (variant === "unmet-promise")
      assert.equal(run[5].households[0].promiseFulfilled, false);
    if (variant === "recurrent-failure") {
      assert.equal(run[5].households[0].caseStatus, "open");
      assert.notEqual(
        arbitrate(run[5].households[0], run[4].households[0], run[5]).trace!
          .selectedId,
        "confirmation",
      );
    }
  }
});
test("a received heartbeat fulfils its watch; future recovery cannot fulfil a past callback", () => {
  const run = replay(),
    s = run[1],
    h = s.households[2],
    d = arbitrate(h, run[0].households[2], s);
  const watch = contractsFor(h, d, s, false).find((c) => c.goal === "watch")!;
  assert.equal(verifyOutcome(watch, run[3]).status, "met");
  const daniel = s.households[0],
    recovery = arbitrate(daniel, run[0].households[0], s);
  const callback = contractsFor(daniel, recovery, s, false).find(
    (c) => c.goal === "callback",
  )!;
  assert.notEqual(verifyOutcome(callback, run[3]).status, "met");
  assert.equal(verifyOutcome(callback, run[4]).status, "met");
});

test("Sam's first use requires its own observed proof and does not stand in for a customer reply", () => {
  const run = replay();
  const earlier = run[4].households[1], final = run[5].households[1];
  assert.equal(earlier.firstUseObserved, false);
  assert.equal(final.firstUseObserved, true);
  assert.equal(final.confirmed, false);
  const decision = arbitrate(final, earlier, run[5]);
  assert.equal(decision.trace!.selectedId, "first-use");
  assert.equal(serviceMessage(final, decision)?.title, "You’re connected");
  const first = arbitrate(run[1].households[1], run[0].households[1], run[1]);
  const expected = contractsFor(run[1].households[1], first, run[1], false).find(c=>c.goal === "activation")!;
  assert.equal(verifyOutcome(expected, run[4]).status, "waiting");
  const observed = verifyOutcome(expected, run[5]);
  assert.equal(observed.status, "met");
  assert.ok(observed.evidenceIds.some(id=>run[5].events.find(e=>e.id===id)?.type === "activation.first_use_observed"));
});

test("provisioning alone or a later failed test cannot be presented as successful first use", () => {
  const run = replay();
  const h = run[5].households[1];
  const without = h.evidence.filter(e=>e.type!=="activation.first_use_observed");
  const provisional = project({id:"sam",name:h.name}, without);
  assert.equal(provisional.firstUseObserved, false);
  assert.notEqual(arbitrate(provisional, run[4].households[1], run[5]).trace!.selectedId, "first-use");
  const failed = project({id:"sam",name:h.name}, [...h.evidence, {id:"later-failure",sessionId:"test",serviceId:h.serviceId,subject:"sam",revision:5,type:"service.failure_observed",source:"test",occurredAt:"2026-09-25T20:18:00Z",receivedAt:"2026-09-25T20:18:00Z",description:"Fresh test failed",payload:{lineTest:"failed"}}]);
  assert.notEqual(arbitrate(failed, h, run[5]).trace!.selectedId, "first-use");
});

test("v1.1 remains reproducible after adding the v1.2 first-use checkpoint", () => {
  assert.equal(fixtureHash(generateHistory({datasetVersion:"bt-households-v1.1"})), "8a2f245942b0b6eb7a982b9d4441d5897f11d6f28ca20cecfaf13d347a4a2d76");
});

test('an activation case does not inherit the recovery persona’s reported line faults',()=>{
 const sam=replay()[0].households.find(h=>h.id==='sam')!;
 assert.equal(sam.serviceState,'Activation case open');
 assert.match(sam.activation,/unconfirmed/);
});

test("an engineer visit waits for a named sign-off and is withdrawn when the incident explains the fault", () => {
  const run = replay();
  const decide = (at: number, alias: string) => {
    const h = run[at].households.find((x) => x.id === alias)!;
    return arbitrate(h, run[Math.max(0, at - 1)].households.find((x) => x.id === alias)!, run[at] as Snapshot);
  };
  const at2100 = decide(1, "daniel");
  const visit = at2100.trace!.candidates.find((c) => c.id === "engineer")!;
  assert.equal(visit.status, "awaiting");
  assert.equal(visit.authority?.mode, "sign-off");
  assert.notEqual(at2100.trace!.selectedId, "engineer");
  assert.equal(decide(2, "daniel").trace!.candidates.find((c) => c.id === "engineer")!.status, "blocked");
  // Sam's first-week activation and Maya's quiet night never qualify for a visit.
  for (const alias of ["sam", "maya"]) assert.equal(decide(1, alias).trace!.candidates.find((c) => c.id === "engineer")!.status, "blocked");
});

test("routine and load-bearing moments: a named person stays accountable where the customer needs one", () => {
  const run = replay();
  const kind = (at: number, alias: string) =>
    arbitrate(run[at].households.find((x) => x.id === alias)!, run[at].households.find((x) => x.id === alias)!, run[at] as Snapshot).moment!.kind;
  assert.equal(kind(1, "daniel"), "load-bearing");
  assert.equal(kind(1, "sam"), "routine");
  assert.equal(kind(1, "maya"), "routine");
  assert.equal(kind(5, "daniel"), "routine");
});

test("one household, several products: Maya's linked mobile informs the broadband watch without entering its evidence", () => {
  const run = replay();
  const maya = run[1].households.find((x) => x.id === "maya")!;
  assert.ok(!maya.evidence.some((e) => e.type === "mobile.activity_observed"), "broadband evidence stays scoped");
  const recent = maya.linkedServices?.find((s) => s.recent)?.recent;
  assert.ok(recent);
  const d = arbitrate(maya, maya, run[1] as Snapshot);
  assert.equal(d.trace!.selectedId, "watch");
  assert.match(d.reason, /linked mobile/);
  assert.ok(d.evidenceIds.includes(recent.id));
  // Before the mobile signal is known, the watch still holds on the stated habit alone.
  const before = run[0].households.find((x) => x.id === "maya")!;
  assert.ok(!before.linkedServices?.some((s) => s.recent));
});

test("every home starts the evening un-recovered: a routine morning heartbeat is not a restoration", () => {
  const run = replay();
  for (const h of run[0].households) {
    assert.equal(h.restored, false, `${h.id} must not start 20:45 as "connection is back"`);
    assert.equal(h.confirmed, false);
  }
  // Maya's heartbeat returning after tonight's gap is still a restoration.
  const maya = (at: number) => run[at].households.find((x) => x.id === "maya")!;
  assert.equal(maya(1).restored, false);
  assert.equal(maya(3).restored, true);
});

test("Sam's evening follows: setting up, hold off, go ahead, connected", () => {
  const run = replay();
  const sam = (at: number) => run[at].households.find((x) => x.id === "sam")!;
  const step = (at: number) => {
    const d = arbitrate(sam(at), sam(Math.max(0, at - 1)), run[at] as Snapshot);
    return { id: d.trace!.selectedId, message: serviceMessage(sam(at), d) };
  };
  // 21:00 · he switches the hub on for the first time; it can't connect. Not a "quiet router".
  assert.ok(sam(1).evidence.some((e) => e.type === "router.setup_attempted"));
  assert.ok(!sam(1).evidence.some((e) => e.type === "router.heartbeat_overdue"));
  assert.deepEqual([step(1).id, step(1).message?.title], ["activation", "We can see you’re setting up"]);
  // 21:03 · the incident covers his area: hold off.
  assert.deepEqual([step(2).id, step(2).message?.title], ["incident", "Hold off setting up for now"]);
  // 21:12 · the incident clears: tell him to go ahead, as a new message.
  assert.equal(sam(3).incidentCleared, true);
  assert.deepEqual([step(3).id, step(3).message?.key], ["activation", "setup-go"]);
  // 21:18 · first use observed.
  assert.equal(step(5).id, "first-use");
  // Maya is outside the incident: the clear never reaches her evidence.
  assert.ok(!run[3].households.find((x) => x.id === "maya")!.evidence.some((e) => e.type === "incident.cleared"));
});

function followThrough() {
  const run = replay();
  for (let i = 1; i < run.length; i++) {
    run[i].decisions = [...run[i - 1].decisions, ...run[i - 1].households.map(h =>
      arbitrate(h, run[Math.max(0, i - 2)].households.find(p => p.id === h.id)!, run[i - 1]))];
  }
  return run;
}

test("future Maya telemetry preserves unavailable coverage", () => {
  const f = generateHistory();
  const maya = f.tables["customer.people"].find(p => p.alias === "maya")!.id;
  const future = f.events.filter(e => e.personId === maya && e.type === "router.observation_window" && e.occurredAt > clocks[5]);
  assert.ok(future.length > 0);
  assert.ok(future.every(e => e.payload.received === null && e.payload.coverage === "aggregate_unavailable"));
});

test("Monday monitoring remains open and only a covered 72-hour observation completes it", () => {
  const run = followThrough();
  const h = run[6].households[0];
  const d = arbitrate(h, run[5].households[0], run[6]);
  const c = contractsFor(h, d, run[6], false).find(c => c.goal === "monitoring")!;
  assert.ok(c);
  assert.equal(run[7].households[0].monitoring, "active");
  assert.notEqual(run[7].households[0].caseStatus, "none");
  assert.equal(verifyOutcome(c, run[7]).status, "waiting");
  assert.equal(run[8].households[0].monitoring, "complete");
  assert.equal(verifyOutcome(c, run[8]).status, "met");
  const completion = run[8].events.find(e => e.type === "monitoring.completed")!;
  completion.payload.hours = 59;
  assert.notEqual(verifyOutcome(c, run[8]).status, "met");
});

test("verified Maya fix projects recovered service and a notification explanation", () => {
  const run = followThrough(), h = run[6].households[2];
  assert.equal(h.restored, true);
  assert.doesNotMatch(h.serviceState, /falling/);
  const d = arbitrate(h, run[5].households[2], run[6]);
  assert.equal(d.trace!.selectedId, "quiet-fix-note");
  assert.doesNotMatch(d.moment.why, /saying nothing/);
});

test("commercial eligibility rejects a recently closed fault and records new decision facts", () => {
  const run = followThrough(), s = run[8], h = s.households[1];
  const decision = arbitrate(h, run[7].households[1], s);
  assert.equal(decision.trace!.selectedId, "offer");
  assert.ok(decision.trace!.changes.some(c => c.field === "offerSignal"));
  assert.ok(decision.trace!.changes.some(c => c.field === "offerApproved"));
  const template = h.evidence[0];
  h.evidence.push(...[
    { type: "case.opened", occurredAt: "2026-10-20T10:00:00Z" },
    { type: "case.closed", occurredAt: "2026-10-21T10:00:00Z" },
  ].map((e, i) => ({ ...template, ...e, id: `recent-fault-${i}`, subject: h.id, receivedAt: e.occurredAt, payload: { caseId: "recent" } })));
  const rejected = arbitrate(h, run[7].households[1], s).trace!.candidates.find(c => c.id === "offer")!;
  assert.equal(rejected.checks.find(c => c.id === "fault-window")?.state, "fail");
  assert.notEqual(rejected.status, "selected");
});

test("monitoring cannot be completed by early, uncovered or contradicted observations", () => {
  const run = followThrough(), h = run[6].households[0];
  const c = contractsFor(h, arbitrate(h, run[5].households[0], run[6]), run[6], false).find(c => c.goal === "monitoring")!;
  const final = run[8], completion = final.events.find(e => e.type === "monitoring.completed")!;
  const original = structuredClone(completion);
  completion.occurredAt = "2026-09-28T07:20:00Z";
  assert.notEqual(verifyOutcome(c, final).status, "met");
  Object.assign(completion, structuredClone(original));
  completion.payload.coverage = "partial";
  assert.notEqual(verifyOutcome(c, final).status, "met");
  assert.equal(project({ id: "daniel", name: "Daniel" }, final.events).monitoring, "active");
  Object.assign(completion, structuredClone(original));
  final.events.push({ ...completion, id: "drop-during-monitoring", type: "monitoring.checked", occurredAt: "2026-09-27T10:00:00Z", payload: { drops: 1 } });
  assert.notEqual(verifyOutcome(c, final).status, "met");
});

test("commercial fault window checks spanning intervals and rejects missing approval scope", () => {
  const run = followThrough(), s = run[8], h = s.households[1];
  const template = h.evidence.find(e => e.subject === "sam")!;
  const check = () => arbitrate(h, run[7].households[1], s).trace!.candidates.find(c => c.id === "offer")!.checks.find(c => c.id === "fault-window")!;
  h.evidence.push(...[
    { type: "case.opened", occurredAt: "2026-09-30T10:00:00Z" },
    { type: "case.closed", occurredAt: "2026-10-20T10:00:00Z" },
  ].map((e, i) => ({ ...template, ...e, id: `spanning-${i}`, receivedAt: e.occurredAt, payload: { caseId: "spanning" } })));
  assert.equal(check().state, "fail");
  h.evidence.at(-1)!.occurredAt = "2026-10-01T10:00:00Z";
  assert.equal(check().state, "pass");
  delete h.evidence.find(e => e.type === "policy.offer_approved")!.payload.faultFreeDays;
  assert.equal(check().state, "unknown");
});

test("v2.3 remains immutable when v2.4 corrects monitoring and unavailable telemetry", () => {
  assert.equal(fixtureHash(generateHistory({ datasetVersion: "bt-households-v2.3" })),
    "e8f81fb5c51985954706398ba3a218fd1bbaeb34e2d0f1671f66813167f0e276");
});
