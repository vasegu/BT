import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine, steps } from "../server/engine.ts";
import { momentView, moments, householdOutcome } from "../src/presentation.ts";
import { clocks } from "../server/engine.ts";
import type { Snapshot } from "../src/types.ts";
async function replay() {
  const engine = new Engine(":memory:");
  try {
    const session = engine.createSession();
    const result = [engine.snapshot(session.id)];
    for (const [i, step] of steps.entries()) {
      engine.advance(session.id, step, `present-${i}`, i);
      await engine.processJobs();
      result.push(engine.snapshot(session.id));
    }
    return result;
  } finally {
    engine.close();
  }
}
test("the spine's clock labels match the engine's recorded clocks", () => {
  assert.equal(moments.length, clocks.length);
  // Tonight's labels are the time; later chapters add the day, or give the date when weeks pass.
  clocks.forEach((iso, i) => {
    const d = new Date(iso);
    const hm = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
    const date = d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
    const weekday = d.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short" });
    assert.ok(
      moments[i].time === hm || moments[i].time === `${weekday} ${hm}` || moments[i].time === date,
      `moment ${i} label "${moments[i].time}" does not match ${iso}`,
    );
  });
});
test("every moment reads all three homes at once from recorded decisions only", async () => {
  for (const s of await replay()) {
    const view = momentView(s);
    assert.deepEqual(
      view.lanes.map((l) => l.person),
      ["daniel", "sam", "maya"],
    );
    for (const lane of view.lanes) {
      if (lane.decision) assert.ok(lane.decision.revision <= s.cutoff);
      if (lane.message) assert.equal(lane.message.revision, s.cutoff);
    }
    for (const e of view.signals) assert.equal(e.revision, s.cutoff);
  }
});
test("the same signal produces different responses: Maya is watched, not messaged", async () => {
  const s = (await replay())[1];
  const view = momentView(s);
  const lane = (p: string) => view.lanes.find((l) => l.person === p)!;
  assert.equal(view.signals.length, 3, "one heartbeat signal per home");
  // Sam is messaged. Daniel is not: Aisha spoke to him minutes ago, so a message would only repeat her.
  assert.ok(lane("sam").message);
  assert.equal(lane("daniel").message, null);
  assert.ok(lane("daniel").decision?.reason.includes("no message that would repeat it"));
  assert.equal(lane("maya").message, null);
  assert.equal(lane("maya").decision?.disposition, "watch");
  assert.ok(lane("maya").panels.includes("arbiter"));
});
test("the incident moment changes the decision and flags the shared context only for homes in scope", async () => {
  const s = (await replay())[2];
  const view = momentView(s);
  const daniel = view.lanes.find((l) => l.person === "daniel")!;
  const maya = view.lanes.find((l) => l.person === "maya")!;
  assert.ok(daniel.changed && daniel.previous);
  assert.notEqual(daniel.previous!.title, daniel.decision!.title);
  assert.ok(daniel.involved && daniel.inIncident);
  assert.equal(maya.inIncident, false);
  assert.equal(maya.involved, false, "outside the incident, nothing new for Maya");
});
test("a pending or failed revision never borrows the previous decision", async () => {
  const s = (await replay())[2];
  for (const status of [
    { pendingJobs: 1, failedJobs: 0 },
    { pendingJobs: 0, failedJobs: 1 },
  ]) {
    const view = momentView({ ...s, ...status });
    assert.notEqual(view.status, "ready");
    assert.ok(view.lanes.every((l) => l.decision === null));
  }
});
test("the final comparison keeps three proof types separate and preserves unresolved legacy activation", async () => {
  const run = await replay();
  assert.match(householdOutcome(run[3], "daniel").detail, /outstanding/);
  assert.match(householdOutcome(run[3], "maya").detail, /0 .*messages/);
  assert.equal(householdOutcome(run[5], "sam").state, "met");
  const legacy = structuredClone(run[5]);
  legacy.households[1].firstUseObserved = false;
  legacy.operations.outcomes = legacy.operations.outcomes.filter(
    (o) => o.person !== "sam",
  );
  assert.equal(householdOutcome(legacy, "sam").state, "waiting");
});


test('the presenter retains all seven sections and marks only material governance changes', async () => {
  const { changeSummary } = await import('../src/presentation.ts');
  const run = await replay();
  for (const s of run) {
    assert.deepEqual(changeSummary(s, 'daniel').map(x => x.panel), ['customer','operations','arbiter','phone','actions','governance','review']);
  }
  const unchanged = structuredClone(run[2]);
  const prior = unchanged.decisions.filter(d => d.person === 'maya' && d.revision === 1).at(-1)!;
  const now = unchanged.decisions.filter(d => d.person === 'maya' && d.revision === 2).at(-1)!;
  now.title = 'A different explanation of the same permitted watch';
  now.trace = structuredClone(prior.trace);
  assert.equal(changeSummary(unchanged,'maya').find(x=>x.panel==='governance')?.changed, false);
});
