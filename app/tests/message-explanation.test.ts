import { test } from "node:test";
import assert from "node:assert/strict";
import { messageExplanation, monitoringCheckLines } from "../src/message-explanation.ts";
import type { DemoAction, Snapshot, SourceEvent } from "../src/types.ts";

const event = (id: string, type: string, at: string, payload = {}, subject = "daniel"): SourceEvent => ({ id, type, occurredAt: at, receivedAt: at, payload, subject, description: `${type} recorded`, source: "crm" }) as SourceEvent;
const early = "2026-09-25T20:18:00Z", late = "2026-11-06T19:00:00Z";
const action = { decisionId: "decision", time: early } as DemoAction;
const events = [event("case", "case.opened", "2026-09-25T18:00:00Z", { owner: "Aisha" }), event("activation", "activation.first_use_observed", early)];
const snapshot = { clock: early, events, decisions: [{ id: "decision", time: early, evidenceIds: ["case", "activation"] }] } as Snapshot;

test("historical reasons, sources, accountability and uncited count remain bound to decision time", () => {
  const original = messageExplanation(action, snapshot, "daniel");
  const advanced = { ...snapshot, clock: late, events: [...events, event("closed", "case.closed", late), event("future", "usage.pattern", late), { ...event("delayed", "usage.observed", early), receivedAt: late }] };
  assert.deepEqual(messageExplanation(action, advanced, "daniel"), original);
  assert.equal(original.owner, "Aisha");
  assert.ok(original.sources.includes("Your hub’s status signal"));
  assert.equal(original.held, 0);
});

test("offer motivations precede old service gates and fault/promise copy is historical", () => {
  const offerEvents = [
    ...events, event("incident", "incident.confirmed", early, { affected: ["daniel"] }, "shared"),
    event("cleared", "incident.cleared", early), event("promise", "promise.created", early, { dueAt: early }),
    event("approval", "policy.offer_approved", late), event("usage", "usage.pattern", late), event("optin", "preference.offers_opt_in", late),
  ];
  const offer = { ...snapshot, events: offerEvents, decisions: [{ id: "decision", time: late, evidenceIds: offerEvents.map(e => e.id), trace: { selectedId: "offer" } }] } as Snapshot;
  const explanation = messageExplanation(action, offer, "daniel");
  assert.match(explanation.reasons[0].text, /live sport/);
  assert.match(explanation.reasons[1].text, /relevant offers/);
  assert.match(explanation.reasons[2].text, /approval/);
  assert.ok(explanation.sources.includes("Our network fault register"));
  assert.ok(explanation.reasons.some(r => /was included/.test(r.text)));
  assert.ok(explanation.reasons.every(r => !/still stands|is part of/.test(r.text)));
});

test("monitoring sheet uses the recorded completion and closure dates, including retained versions", () => {
  for (const at of ["2026-09-28T20:15:00Z", "2026-09-28T07:25:00Z"]) {
    const records = [event("completed", "monitoring.completed", "2026-09-28T20:12:00Z"), event("closed", "case.closed", at)];
    const lines = monitoringCheckLines(records, "daniel", late);
    assert.ok(lines.some(l => l.includes(at.includes("20:15") ? "21:15 BST" : "08:25 BST")));
    assert.ok(lines.some(l => l.includes("21:12 BST")));
    assert.deepEqual(monitoringCheckLines(records, "daniel", early), []);
  }
});
