import { test } from "node:test";
import assert from "node:assert/strict";
import { generateHistory } from "../../scripts/generate-bt-history.ts";
import { buildContext } from "../server/context.ts";
import { clocks } from "../server/engine.ts";
import { arbitrate, serviceMessage } from "../server/arbiter.ts";
import { changeSummary, momentView } from "../src/presentation.ts";
import type { Snapshot, PersonId } from "../src/types.ts";

const fixture = generateHistory();
const snapshots = clocks.map((clock, cutoff) => {
  const contexts = (["daniel", "sam", "maya"] as PersonId[]).map(alias => buildContext({
    fixture, sessionId: "audit", personId: fixture.tables["customer.people"].find(p => p.alias === alias)!.id,
    serviceId: fixture.tables["customer.services"].find(s => s.reference === `svc_${alias}_broadband`)!.id,
    cutoff: clock, purpose: "service",
  }));
  return { session: { id: "audit", seedVersion: fixture.datasetVersion, revision: cutoff, step: cutoff, createdAt: clocks[0] },
    clock, cutoff, historical: false, pendingJobs: 0, failedJobs: 0, households: contexts.map(c => c.household),
    events: [...new Map(contexts.flatMap(c => c.evidence).map(e => [e.id, e])).values()], decisions: [], actions: [],
    operations: { ...contexts[0].operations, outcomes: [] }, nextStep: null } as Snapshot;
});

test("all 27 canonical states keep confirmation separate from formal case closure", () => {
  for (const s of snapshots) for (const h of s.households) {
    if (h.id === "daniel") {
      assert.equal(h.caseStatus, s.cutoff < 8 ? "open" : "none", `${h.id} at ${s.clock}`);
      assert.equal(h.owner, s.cutoff < 8 ? "Aisha" : null);
      assert.equal(h.confirmed, s.cutoff >= 5);
      if (s.cutoff >= 5 && s.cutoff < 8) assert.equal(h.monitoring, "active");
    }
    for (const d of h.profile?.devices ?? []) assert.ok(Date.parse(d.since) <= Date.parse(s.clock));
  }
});

test("confirmation message acknowledges recovery without claiming formal closure", () => {
  const s = snapshots[5], h = s.households[0];
  const decision = arbitrate(h, snapshots[4].households[0], s);
  assert.equal(decision.trace!.selectedId, "confirmation");
  assert.doesNotMatch(serviceMessage(h, decision)!.body, /case is now closed/i);
});

test("operational changes include the telemetry shown in every canonical panel", () => {
  for (const s of snapshots) for (const h of s.households) {
    const fresh = h.evidence.filter(e => e.subject === h.id && e.revision === s.cutoff && s.cutoff > 0 &&
      /^(router\.(heartbeat_overdue|heartbeat_received|setup_attempted)|service\.(restored_observed|failure_observed|reprofiled)|line\.degradation_detected|monitoring\.)/.test(e.type));
    if (!fresh.length) continue;
    assert.equal(changeSummary(s, h.id).find(r => r.panel === "operations")!.changed, true, `${h.id} ${s.clock}`);
    assert.ok(momentView(s).lanes.find(l => l.person === h.id)!.panels.includes("operations"));
  }
  assert.match(changeSummary(snapshots[7], "daniel")[0].text, /Monitoring checkpoint/);
  assert.doesNotMatch(changeSummary(snapshots[7], "daniel")[0].text, /Overnight/);
});

test("new devices change Maya's customer-memory rail at their first visible moment", () => {
  const row = changeSummary(snapshots[8], "maya")[0];
  assert.equal(row.changed, true);
  assert.match(row.text, /laptop/i);
  assert.match(row.text, /console/i);
  assert.ok(momentView(snapshots[8]).lanes.find(l => l.person === "maya")!.panels.includes("customer"));
  assert.doesNotMatch(changeSummary(snapshots[7], "maya")[0].text, /laptop|console/i);
});

test("monitoring completion alone cannot authorise a case-closed message", () => {
  const s = structuredClone(snapshots[8]), h = s.households[0];
  h.caseStatus = "open";
  h.evidence = h.evidence.filter(e => e.type !== "case.closed");
  s.events = s.events.filter(e => e.type !== "case.closed");
  const candidate = arbitrate(h, snapshots[7].households[0], s).trace!.candidates.find(c => c.id === "monitor-close")!;
  assert.equal(candidate.status, "blocked");
});

test("recovery memory copy distinguishes active checks, kept promises and formal closure", async () => {
  const { recoveryMemoryNote } = await import("../src/presentation.ts");
  for (const s of snapshots) for (const h of s.households) {
    if (h.id !== "daniel" || s.cutoff < 5) continue;
    const note = recoveryMemoryNote(h)!;
    assert.match(note, /callback was kept/i);
    assert.doesNotMatch(note, /line drops|keep.*call|open fault/i);
    if (s.cutoff < 8) assert.match(note, /monitoring continues.*Aisha.*formal closure/);
    else assert.match(note, /case closure.*recorded/);
  }
});

test('story summaries never infer closure, adoption or delivery from the replay position alone', async () => {
 const {householdOutcome}=await import('../src/presentation.ts');
 const s=structuredClone(snapshots[8]);
 const d=s.households.find(h=>h.id==='daniel')!;d.monitoring='active';d.caseStatus='open';
 assert.doesNotMatch(householdOutcome(s,'daniel').title,/retained|closed/);
 const sam=s.households.find(h=>h.id==='sam')!;sam.engaged=false;sam.unused=['TV'];sam.offerSignal='usage';
 assert.doesNotMatch(householdOutcome(s,'sam').title,/Using it all/);
 const m=s.households.find(h=>h.id==='maya')!;m.quietFix='fixed';
 assert.doesNotMatch(householdOutcome(s,'maya').title,/Nothing needed|Told/);
});
