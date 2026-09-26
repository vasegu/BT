import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../server/engine.ts";
import { emptyAssessment } from "../server/assessment.ts";
import {
  ContextEvals,
  evaluationRequest,
  evaluateTrial,
  summariseEvaluation,
  VARIANTS,
} from "../server/context-evals.ts";

async function fixture() {
  const engine = new Engine(":memory:");
  const { id } = engine.createSession();
  engine.advance(id, "heartbeat", "start", 0);
  await engine.processJobs(async (request) => {
    const candidate = (request.state.candidates as any[]).find((c) => c.eligible);
    const answer = await fake(request);
    answer.answers.next_action = { choice: candidate.id, probabilities: { [candidate.id]: 0.99, defer: 0.01 } };
    return answer;
  });
  return { engine, id, snapshot: engine.snapshot(id, 1) };
}
const fake = async (request: any) => ({
  ...emptyAssessment(request),
  status: "ok" as const,
  answers: {
    next_action: {
      choice: "recovery",
      probabilities: { recovery: 0.99, defer: 0.01 },
    },
  },
});

test("perturbations change only the self-reported statement, never service evidence, questions or policy", async () => {
  const f = await fixture();
  try {
    const d = f.snapshot.decisions.find((d) => d.person === "daniel")!;
    const baseline = evaluationRequest(d, VARIANTS[0]);
    const gamer = evaluationRequest(d, VARIANTS[1]);
    assert.equal((gamer.state.profileContext as any).statement, "I'm a gamer.");
    const stripped = structuredClone(gamer);
    (stripped.state.profileContext as any).statement = null;
    assert.deepEqual(stripped, baseline);
    assert.equal(
      (gamer.state.profileContext as any).source,
      "customer_self_report",
    );
    assert.equal((gamer.state.profileContext as any).verified, false);
  } finally {
    f.engine.close();
  }
});

test("a policy-blocked gamer upsell is still a failed model eval and never dispatches", async () => {
  const f = await fixture();
  try {
    const d = f.snapshot.decisions.find((d) => d.person === "daniel")!;
    const request = evaluationRequest(d, VARIANTS[3]);
    const assessment = {
      ...(await fake(request)),
      answers: {
        next_action: {
          choice: "offer",
          probabilities: { offer: 0.98, defer: 0.02 },
        },
      },
    };
    const before = JSON.stringify(f.engine.snapshot(f.id));
    const result = evaluateTrial(d, assessment);
    assert.equal(result.modelChoice, "offer");
    assert.equal(result.governedChoice, "defer");
    assert.equal(result.policyHeld, true);
    assert.equal(JSON.stringify(f.engine.snapshot(f.id)), before);
  } finally {
    f.engine.close();
  }
});

test("durable evals are idempotent, repeat baseline controls and preserve production state", async () => {
  const f = await fixture();
  try {
    const store = new ContextEvals(f.engine.db);
    let calls = 0;
    const before = JSON.stringify(f.engine.snapshot(f.id));
    const evaluator = async (request: any) => {
      calls++;
      const candidate = (request.state.candidates as any[]).find(
        (c) => c.eligible,
      );
      const answer = await fake(request);
      answer.answers.next_action = {
        choice: candidate.id,
        probabilities: { [candidate.id]: 0.99, defer: 0.01 },
      };
      return answer;
    };
    const suite = store.start(f.snapshot, evaluator);
    assert.equal(store.start(f.snapshot, evaluator).id, suite.id);
    await store.finished();
    const done = store.get(f.id)!;
    assert.equal(calls, 36);
    assert.equal(done.status, "complete");
    assert.equal(done.trials.length, 36);
    assert.equal(new Set(done.trials.map((t) => t.repeat)).size, 3);
    assert.equal(JSON.stringify(f.engine.snapshot(f.id)), before);
    assert.equal(store.start(f.snapshot, evaluator).id, suite.id);
    assert.equal(calls, 36);
    assert.equal(
      summariseEvaluation(done).every((r) => r.status === "pass"),
      true,
    );
  } finally {
    f.engine.close();
  }
});

test("provider failure stays inconclusive and interrupted evals never silently restart", async () => {
  const f = await fixture();
  try {
    const store = new ContextEvals(f.engine.db);
    const suite = store.start(f.snapshot, async (request) => ({
      ...emptyAssessment(request),
      status: "error",
      error: "Unavailable",
    }));
    await store.finished();
    const result = store.get(f.id)!;
    assert.equal(result.status, "incomplete");
    assert.equal(
      summariseEvaluation(result).every((r) => r.status === "incomplete"),
      true,
    );
    f.engine.db
      .prepare("UPDATE context_evals SET status='running' WHERE id=?")
      .run(suite.id);
    const recovered = new ContextEvals(f.engine.db);
    assert.equal(recovered.get(f.id)!.status, "interrupted");
  } finally {
    f.engine.close();
  }
});


test("a known diversion remains a failure when a later provider call fails", async () => {
  const f = await fixture();
  try {
    const store = new ContextEvals(f.engine.db);
    let call = 0;
    store.start(f.snapshot, async (request) => {
      call++;
      if (call === 3) return { ...emptyAssessment(request), status: "error", error: "Unavailable" };
      const result = await fake(request);
      if (call === 2) result.answers.next_action = { choice: "offer", probabilities: { offer: 0.99, defer: 0.01 } } as any;
      return result;
    });
    await store.finished();
    const result = store.get(f.id)!;
    assert.equal(result.status, "incomplete");
    const rows = summariseEvaluation(result);
    assert.equal(rows.find(r => r.person === "daniel" && r.variant === "gamer")!.status, "fail");
    assert.equal(rows.find(r => r.person === "sam" && r.variant === "gamer")!.status, "incomplete");
  } finally { f.engine.close(); }
});

test("sources without a frozen model request are rejected before recording or billing", async () => {
  const engine = new Engine(":memory:");
  try {
    const { id } = engine.createSession();
    engine.advance(id, "heartbeat", "start", 0);
    await engine.processJobs();
    const store = new ContextEvals(engine.db);
    let calls = 0;
    assert.throws(() => store.start(engine.snapshot(id, 1), async (request) => { calls++; return fake(request); }), /frozen/);
    assert.equal(calls, 0);
    assert.equal(store.get(id), null);
  } finally { engine.close(); }
});
