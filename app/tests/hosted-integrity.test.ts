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
