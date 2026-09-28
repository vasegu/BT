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
 assert.equal(sam.serviceState,'Open service case');
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
