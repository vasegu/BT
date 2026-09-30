import { test } from "node:test";
import assert from "node:assert/strict";
import { daypart, formatDateTime, lifecycle, sameLondonDay } from "../src/time.ts";
import { hasRecordedApproval } from "../src/governance-status.ts";
import { learningLoops } from "../src/learning.ts";
import type { Decision, Household, SourceEvent } from "../src/types.ts";

test("London replay dates preserve BST/GMT and day boundaries independently of host timezone", () => {
  assert.match(formatDateTime("2026-09-26T07:30:00Z"), /08:30 BST/);
  assert.match(formatDateTime("2026-11-06T19:00:00Z"), /19:00 GMT/);
  assert.equal(daypart("2026-09-26T07:30:00Z"), "morning");
  assert.equal(daypart("2026-11-06T19:00:00Z"), "evening");
  assert.equal(sameLondonDay("2026-09-25T23:30:00Z", "2026-09-26T07:30:00Z"), true);
  assert.equal(sameLondonDay("2026-11-05T23:30:00Z", "2026-11-06T07:30:00Z"), false);
});

test("observed activation progresses through first connection and onboarding into established usage", () => {
  const h = { activation: "Delivered, activation unconfirmed", evidence: [] } as unknown as Household;
  assert.equal(lifecycle(h, "2026-09-25T19:45:00Z"), "unconnected");
  h.firstUseObserved = true;
  h.evidence = [{ type: "activation.first_use_observed", occurredAt: "2026-09-25T20:18:00Z" }] as SourceEvent[];
  assert.equal(lifecycle(h, "2026-09-25T20:18:00Z"), "first connected");
  assert.equal(lifecycle(h, "2026-09-26T07:30:00Z"), "onboarding");
  assert.equal(lifecycle(h, "2026-11-06T19:00:00Z"), "established usage");
});

test("a selected offer has authority only with a passed gate and approval available at its decision time", () => {
  const d = { time: "2026-11-06T19:00:00Z", trace: { selectedId: "offer", candidates: [{ id: "offer", checks: [{ id: "commercial", state: "pass", evidenceIds: ["approval"] }] }] } } as unknown as Decision;
  const approval = { id: "approval", type: "policy.offer_approved", receivedAt: "2026-11-05T12:00:00Z" } as SourceEvent;
  assert.equal(hasRecordedApproval(d, [approval]), true);
  assert.equal(hasRecordedApproval(d, []), false);
  assert.equal(hasRecordedApproval(d, [{ ...approval, receivedAt: "2026-11-07T12:00:00Z" }]), false);
  d.trace!.candidates[0].checks[0].state = "unknown";
  assert.equal(hasRecordedApproval(d, [approval]), false);
});

test("the final guide comparison is unavailable during the September replay", () => {
  const available = (clock: string) => learningLoops().filter((l) => Date.parse(l.availableFrom) <= Date.parse(clock)).map((l) => l.id);
  assert.ok(!available("2026-09-28T07:30:00Z").includes("early-life-guide"));
  assert.ok(available("2026-11-06T19:00:00Z").includes("early-life-guide"));
});
