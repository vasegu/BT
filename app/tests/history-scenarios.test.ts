import { test } from "node:test";
import assert from "node:assert/strict";
import { generateHistory } from "../../scripts/generate-bt-history.ts";
import { buildContext } from "../server/context.ts";
import { clocks } from "../server/engine.ts";
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
