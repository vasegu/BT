import { test } from "node:test";
import assert from "node:assert/strict";
import { generateHistory } from "../../scripts/generate-bt-history.ts";
import { buildContext } from "../server/context.ts";
const f = generateHistory();
const person = (alias: string) =>
  String(f.tables["customer.people"].find((p) => p.alias === alias)!.id);
const service = (alias: string) =>
  String(
    f.tables["customer.services"].find(
      (p) => p.reference === `svc_${alias}_broadband`,
    )!.id,
  );
const ctx = (alias: string, cutoff = "2026-09-25T20:00:00Z", fixture = f) =>
  buildContext({
    fixture,
    sessionId: "one",
    personId: person(alias),
    serviceId: service(alias),
    cutoff,
    purpose: "service",
  });
test("Maya routine is derived from 28 observable nights, not an authored tally", () => {
  const c = ctx("maya");
  const m = c.memories.find((x) => x.kind === "pattern")!;
  assert.equal(m.measurement?.sample, 28);
  assert.equal(m.measurement?.returns, 26);
  assert.equal(m.epistemic, "derived");
  assert.ok(m.evidenceIds.length >= 28);
  assert.ok(m.evidenceIds.every((id) => f.events.some((e) => e.id === id)));
  assert.equal(c.household.restored, false);
  assert.equal(c.household.caseStatus, "none");
});
test("historical contexts exclude future promises, late diagnostics and unavailable summaries", () => {
  assert.equal(ctx("daniel", "2026-09-25T19:30:00Z").household.promise, null);
  const late = generateHistory({ variant: "late-diagnostic" });
  assert.equal(ctx("daniel", undefined, late).household.restartTried, false);
  assert.equal(
    ctx("daniel", "2026-09-25T20:12:00Z", late).household.restartTried,
    true,
  );
  assert.equal(
    ctx("maya", "2026-03-28T08:00:00Z").memories.some(
      (m) => m.kind === "pattern",
    ),
    false,
  );
});
test("account authority is required; a household member and an unrelated service are rejected", () => {
  assert.throws(
    () =>
      buildContext({
        fixture: f,
        sessionId: "one",
        personId: person("maya_guest"),
        serviceId: service("maya"),
        cutoff: "2026-09-25T20:00:00Z",
        purpose: "service",
      }),
    /authority/,
  );
  assert.throws(
    () =>
      buildContext({
        fixture: f,
        sessionId: "one",
        personId: person("daniel"),
        serviceId: service("sam"),
        cutoff: "2026-09-25T20:00:00Z",
        purpose: "service",
      }),
    /authority/,
  );
  const c = ctx(
    "daniel",
    undefined,
    generateHistory({ variant: "revoked-contact" }),
  );
  assert.equal(c.household.contactAllowed, false);
});
test("corrections only supersede when known; fresh failure remains unresolved despite a contradictory reply", () => {
  const f = generateHistory({ variant: "corrected-scope" });
  assert.equal(
    ctx("maya", "2026-09-25T20:03:00Z", f).household.incident,
    false,
  );
  assert.equal(ctx("maya", "2026-09-25T20:12:00Z", f).household.incident, true);
  const c = ctx(
    "daniel",
    "2026-09-25T20:18:00Z",
    generateHistory({ variant: "recurrent-failure" }),
  );
  assert.equal(c.household.restored, false);
  assert.equal(c.household.caseStatus, "open");
  assert.equal(
    ctx("sam").household.activation,
    "Delivered · activation unconfirmed",
  );
});

test("late permission withdrawal does not rewrite an earlier authorised context", () => {
  const f = generateHistory({ variant: "revoked-contact" });
  f.events.find((e) => e.sourceEventId === "daniel-withdrawal")!.knownAt =
    "2026-09-25T20:12:00Z";
  assert.equal(
    ctx("daniel", "2026-09-25T20:00:00Z", f).household.contactAllowed,
    true,
  );
  assert.equal(
    ctx("daniel", "2026-09-25T20:12:00Z", f).household.contactAllowed,
    false,
  );
});
test("incident membership for a second product cannot affect broadband", async () => {
  const { stableId } = await import("../../scripts/generate-bt-history.ts");
  const { validateFixture } = await import("../server/data-model.ts");
  const f = generateHistory(),
    original = f.events.find((e) => e.type === "incident.confirmed")!;
  const mobile = f.tables["customer.services"].find(
    (s) => s.reference === "svc_maya_mobile",
  )!;
  const incident = {
    ...original,
    id: stableId("test-mobile-incident-event"),
    sourceEventId: "test-mobile-incident",
    payload: { incidentId: "INC-MOBILE", affected: ["maya"] },
    occurredAt: "2026-09-25T20:04:00Z",
    knownAt: "2026-09-25T20:04:00Z",
  };
  f.events.push(incident);
  const row = {
    ...f.tables["operations.incidents"][0],
    id: stableId("test-mobile-incident"),
    reference: "INC-MOBILE",
    source_event_id: incident.id,
    opened_at: incident.occurredAt,
  };
  f.tables["operations.incidents"].push(row);
  f.tables["operations.incident_services"].push({
    id: stableId("test-mobile-membership"),
    incident_id: row.id,
    service_id: mobile.id,
    membership: "affected",
    valid_from: incident.occurredAt,
    valid_to: null,
    source_event_id: incident.id,
  });
  assert.deepEqual(validateFixture(f), []);
  assert.equal(
    ctx("maya", "2026-09-25T20:06:00Z", f).household.incident,
    false,
  );
  assert.equal(
    buildContext({
      fixture: f,
      sessionId: "one",
      personId: person("maya"),
      serviceId: String(mobile.id),
      cutoff: "2026-09-25T20:06:00Z",
      purpose: "service",
    }).household.incident,
    true,
  );
});
test("future conversation records cannot change the frozen historical context hash", () => {
  const f = generateHistory(),
    before = ctx("daniel", undefined, f);
  const source = f.events.find(
    (e) => e.personId === person("daniel") && e.type === "conversation.message",
  )!;
  f.events.push({
    ...source,
    id: "future-eve-test",
    sourceEventId: "future-eve-test",
    occurredAt: "2026-09-26T20:00:00Z",
    knownAt: "2026-09-26T20:00:00Z",
    description: "Future Eve conversation",
  });
  const after = ctx("daniel", undefined, f);
  assert.deepEqual(after.evidence, before.evidence);
  assert.equal(after.hash, before.hash);
});
