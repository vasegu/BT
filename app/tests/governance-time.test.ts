import { test } from "node:test";
import assert from "node:assert/strict";
import { recordedContactPermission } from "../src/governance-status.ts";
import { nextLondonBatch, formatDateTime } from "../src/time.ts";
import type { Decision, SourceEvent } from "../src/types.ts";

const decision = { person: "daniel", revision: 2, time: "2026-09-25T20:03:00Z" } as Decision;
const authority = (allowed: boolean, occurredAt = "2026-09-25T19:00:00Z", receivedAt = occurredAt, revision = 0): SourceEvent => ({
  id: `${allowed}-${occurredAt}`, subject: "daniel", type: "contact.authority_recorded", occurredAt, receivedAt, revision,
  payload: { allowed, role: "account_holder", purpose: "service", channel: "in_app" },
} as SourceEvent);

test("historical contact audit ignores later grants and revocations", () => {
  for (const allowed of [true, false]) {
    const earlier = authority(allowed);
    const later = authority(!allowed, "2026-09-26T08:00:00Z", undefined, 3);
    assert.equal(recordedContactPermission(decision, [earlier, later]), allowed);
    assert.equal(recordedContactPermission(decision, [earlier, authority(!allowed, "2026-09-25T19:30:00Z", "2026-09-26T08:00:00Z")]), allowed);
  }
  assert.equal(recordedContactPermission(decision, []), null);
  assert.equal(recordedContactPermission(undefined, [authority(true)]), null);
  assert.equal(recordedContactPermission(decision, [{ ...authority(true), payload: { allowed: true, purpose: "commercial", channel: "in_app" } }]), null);
});

test("nightly batch stays at London 02:00 across winter and DST transitions", () => {
  for (const [signal, expected] of [
    ["2026-09-25T20:00:00Z", "2026-09-26T01:00:00Z"],
    ["2026-11-06T20:00:00Z", "2026-11-07T02:00:00Z"],
    ["2026-10-24T20:00:00Z", "2026-10-25T02:00:00Z"],
    ["2026-03-28T20:00:00Z", "2026-03-29T01:00:00Z"],
    ["2026-11-06T02:00:00Z", "2026-11-07T02:00:00Z"],
  ]) assert.equal(nextLondonBatch(signal), Date.parse(expected));
});

test("outcome dates distinguish same-clock deadlines on different days", () => {
  assert.match(formatDateTime("2026-09-25T20:12:00Z"), /25 Sept.*21:12/);
  assert.match(formatDateTime("2026-09-28T20:12:00Z"), /28 Sept.*21:12/);
});
