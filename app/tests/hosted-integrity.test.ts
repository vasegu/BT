import { test } from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { database } from "../server/database.ts";
import { PostgresRepository } from "../server/postgres-repository.ts";
test(
  "hosted workers claim exclusively, recover expired leases and keep presenter privileges bounded",
  { skip: process.env.BT_HOSTED_TESTS !== "1", timeout: 120000 },
  async () => {
    const admin = database(true),
      presenter = database(),
      a = new PostgresRepository(admin),
      b = new PostgresRepository(presenter);
    const id = randomUUID(),
      dataset = `worker-test-${id}`;
    try {
      await admin`insert into runtime.datasets(id,seed,content_hash,manifest) values(${dataset},1,'lease-test','{"provenance":"constraint-test"}')`;
      await admin`insert into runtime.sessions(id,dataset_id) values(${id},${dataset})`;
      await admin`insert into runtime.jobs(session_id,revision,step,idempotency_key) values(${id},1,'heartbeat','one')`;
      const [one, two] = await Promise.all([a.claim(id), b.claim(id)]);
      assert.equal([one, two].filter(Boolean).length, 1);
      const first = one || two;
      await admin`update runtime.jobs set lease_until=now()-interval '1 second' where session_id=${id}`;
      const recovered = await b.claim(id);
      assert.ok(recovered);
      assert.notEqual(recovered.token, first!.token);
      const [grants] =
        await admin`select has_table_privilege('bt_runtime','auth.users','select') auth_read, has_table_privilege('bt_runtime','ingestion.events','delete') event_delete, has_table_privilege('anon','customer.people','select') browser_read`;
      assert.equal(grants.auth_read, false);
      assert.equal(grants.event_delete, false);
      assert.equal(grants.browser_read, false);
    } finally {
      await admin`delete from runtime.jobs where session_id=${id}`;
      await admin`delete from runtime.sessions where id=${id}`;
      await admin`delete from runtime.datasets where id=${dataset}`;
      await Promise.all([admin.end(), presenter.end()]);
    }
  },
);

test(
  "interrupted assessments survive a later Eve exchange without another provider call",
  { skip: process.env.BT_HOSTED_TESTS !== "1", timeout: 240000 },
  async () => {
    const { buildAssessmentRequest, emptyAssessment } = await import(
      "../server/assessment.ts"
    );
    const { arbitrate } = await import("../server/arbiter.ts");
    const { enrichContext } = await import("../server/memory-repository.ts");
    const db = database(),
      repo = new PostgresRepository(db);
    try {
      const session = await repo.createSession();
      await repo.advance(session.id, "heartbeat", "interrupted-test", 0);
      const job = await repo.claim(session.id);
      const [current, before, contexts] = await Promise.all([
        repo.snapshot(session.id, 1),
        repo.snapshot(session.id, 0),
        repo.contexts(session.id, 1),
      ]);
      for (const c of contexts) {
        await enrichContext(c, db);
        const h = current.households.find((h) => h.id === c.household.id)!;
        const req = buildAssessmentRequest(
          h,
          current,
          arbitrate(h, before.households.find((p) => p.id === h.id)!, current),
        );
        await db`insert into runtime.assessments(session_id,job_id,person_id,state,context_hash,context,request,data) values(${session.id},${job.id},${c.personId},'started',${c.hash},${db.json(c as any)},${db.json(req as any)},${db.json(emptyAssessment(req) as any)})`;
      }
      await repo.saveConversation(session.id, "daniel", 1, [
        { role: "user", content: "Can you remind me who owns my callback?" },
        {
          role: "assistant",
          content: "The stored promise remains with Aisha.",
        },
      ]);
      await db`update runtime.jobs set lease_until=now()-interval '1 second' where session_id=${session.id}`;
      let calls = 0;
      await repo.processJobs(async (req) => {
        calls++;
        return emptyAssessment(req);
      }, session.id);
      const [jobState] =
        await db`select state,error from runtime.jobs where session_id=${session.id}`;
      assert.equal(jobState.state, "complete", jobState.error);
      assert.equal(
        calls,
        0,
        "a durable started attempt must never be billed again",
      );
      assert.equal((await repo.snapshot(session.id)).decisions.length, 3);
    } finally {
      await repo.close();
    }
  },
);
