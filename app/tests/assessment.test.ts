import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../server/engine.ts";
import { arbitrate } from "../server/arbiter.ts";
import {
  buildAssessmentRequest,
  evaluateJev,
  applyAssessment,
} from "../server/assessment.ts";

function fixture() {
  const engine = new Engine(":memory:");
  const { id } = engine.createSession();
  engine.advance(id, "heartbeat", "start", 0);
  const snapshot = engine.snapshot(id);
  const h = snapshot.households[0];
  const decision = arbitrate(h, engine.snapshot(id, 0).households[0], snapshot);
  return {
    engine,
    id,
    snapshot,
    h,
    decision,
    request: buildAssessmentRequest(h, snapshot, decision),
  };
}
const answer = (choice = "recovery", probability = 0.94) => ({
  model: "typesafe-ai/jev",
  answers: {
    interpretation: {
      type: "choice",
      choice: "service_fault",
      probabilities: { service_fault: 0.9, habitual_offline: 0.1 },
    },
    urgency: {
      type: "score",
      score: 2.8,
      probabilities: { "2": 0.2, "3": 0.8 },
    },
    next_action: {
      type: "choice",
      choice,
      probabilities: {
        [choice]: probability,
        [choice === "defer" ? "recovery" : "defer"]: 1 - probability,
      },
    },
  },
  usage: { inputTokens: 500, outputTokens: 70 },
  providerMetadata: {
    gateway: {
      cost: "0.00002",
      generationId: "gen-test",
      routing: { finalProvider: "typesafe-ai" },
    },
  },
});
const mock = (body: unknown, status = 200) =>
  (async () => Response.json(body, { status })) as typeof fetch;

test("Jev receives scoped source context and typed questions without customer identities or baseline scores", () => {
  const f = fixture();
  try {
    const state = JSON.stringify(f.request.state);
    assert.ok(
      !/Maya|Sam Morgan|Daniel Reed|svc_daniel|AI_GATEWAY|bt-context|priority/.test(
        state,
      ),
    );
    assert.ok(state.includes("promise.created"));
    assert.ok(state.includes("diagnostic.completed"));
    assert.equal(f.request.questions.next_action.type, "choice");
    assert.ok(f.request.questions.next_action.criteria.defer);
  } finally {
    f.engine.close();
  }
});

test("a genuine model choice can hold an otherwise eligible outbound plan", async () => {
  const f = fixture();
  try {
    const assessment = await evaluateJev(
      f.request,
      { key: "test-key" },
      mock(answer("defer")),
    );
    const result = applyAssessment(f.decision, assessment);
    assert.equal(result.trace!.selectedId, "defer");
    assert.equal(result.trace!.assessment!.effective, "model");
    assert.equal(result.disposition, "watch");
    assert.equal(assessment.costUsd, 0.00002);
    assert.equal(assessment.inputTokens, 500);
  } finally {
    f.engine.close();
  }
});

test("a model cannot bypass a failed eligibility gate, and uncertainty causes a visible hold", async () => {
  const f = fixture();
  try {
    const invalid = await evaluateJev(
      f.request,
      { key: "test-key" },
      mock(answer("restart")),
    );
    const rejected = applyAssessment(structuredClone(f.decision), invalid);
    assert.equal(rejected.trace!.selectedId, "defer");
    assert.equal(rejected.trace!.assessment!.effective, "policy_hold");
    assert.match(rejected.reason, /eligib|gate/i);
    const uncertain = await evaluateJev(
      f.request,
      { key: "test-key" },
      mock(answer("recovery", 0.55)),
    );
    assert.equal(
      applyAssessment(f.decision, uncertain).trace!.selectedId,
      "defer",
    );
  } finally {
    f.engine.close();
  }
});

test("provider failure and malformed probabilities are retained without fake answers or secret leakage", async () => {
  const f = fixture();
  try {
    let calls = 0;
    const failed = await evaluateJev(
      f.request,
      { key: "never-print-this" },
      (async () => {
        calls++;
        return Response.json(
          { error: { message: "never-print-this" } },
          { status: 401 },
        );
      }) as typeof fetch,
    );
    assert.equal(calls, 1);
    assert.equal(failed.status, "error");
    assert.equal(failed.httpStatus, 401);
    assert.ok(!JSON.stringify(failed).includes("never-print-this"));
    assert.equal(
      applyAssessment(f.decision, failed).trace!.selectedId,
      "defer",
    );
    const brokenJson = await evaluateJev(
      f.request,
      { key: "test-key" },
      (async () =>
        new Response("never-print-this", { status: 200 })) as typeof fetch,
    );
    assert.equal(brokenJson.status, "error");
    assert.ok(!JSON.stringify(brokenJson).includes("never-print-this"));
    const malformed = answer();
    malformed.answers.next_action.probabilities = { recovery: 2, defer: -1 };
    const invalid = await evaluateJev(
      f.request,
      { key: "test-key" },
      mock(malformed),
    );
    assert.equal(invalid.status, "error");
    assert.equal(
      invalid.costUsd,
      0.00002,
      "paid but unusable responses retain billing",
    );
  } finally {
    f.engine.close();
  }
});

test("worker persists model assessments once, avoids overlapping runs and reuses them on job retry", async () => {
  const f = fixture();
  let calls = 0;
  try {
    const evaluator = async (
      request: ReturnType<typeof buildAssessmentRequest>,
    ) => {
      calls++;
      return evaluateJev(request, { key: "test-key" }, mock(answer("defer")));
    };
    await Promise.all([
      f.engine.processJobs(evaluator),
      f.engine.processJobs(evaluator),
    ]);
    assert.equal(calls, 3);
    const first = f.engine.snapshot(f.id);
    assert.equal(first.actions.length, 0);
    assert.equal(first.decisions.length, 3);
    assert.ok(
      first.decisions.every((d) => d.trace?.assessment?.status === "ok"),
    );
    f.engine.db.prepare("UPDATE jobs SET state='pending'").run();
    await f.engine.processJobs(evaluator);
    assert.equal(calls, 3);
    assert.equal(f.engine.snapshot(f.id).decisions.length, 3);
  } finally {
    f.engine.close();
  }
});

test("a recorded or interrupted model attempt survives key removal without reverting to automatic rule actions", async () => {
  const f = fixture();
  try {
    const { emptyAssessment } = await import("../server/assessment.ts");
    const job = f.engine.db.prepare("SELECT id FROM jobs").get() as {
      id: string;
    };
    const held = await evaluateJev(
      f.request,
      { key: "test-key" },
      mock(answer("defer")),
    );
    f.engine.db
      .prepare("INSERT INTO model_evaluations VALUES(?,?,?,?)")
      .run(job.id, "daniel", "recorded", JSON.stringify(held));
    const sam = f.snapshot.households[1];
    const pending = emptyAssessment(
      buildAssessmentRequest(
        sam,
        f.snapshot,
        arbitrate(sam, f.engine.snapshot(f.id, 0).households[1], f.snapshot),
      ),
    );
    f.engine.db
      .prepare("INSERT INTO model_evaluations VALUES(?,?,?,?)")
      .run(job.id, "sam", "started", JSON.stringify(pending));
    await f.engine.processJobs();
    const s = f.engine.snapshot(f.id);
    assert.equal(
      s.decisions.find((d) => d.person === "daniel")?.trace?.selectedId,
      "defer",
    );
    assert.equal(
      s.decisions.find((d) => d.person === "sam")?.trace?.assessment?.status,
      "interrupted",
    );
    assert.equal(s.actions.length, 0);
  } finally {
    f.engine.close();
  }
});
