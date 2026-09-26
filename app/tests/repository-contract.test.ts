import { test } from "node:test";
import assert from "node:assert/strict";
import { Engine, steps } from "../server/engine.ts";
import { PostgresRepository } from "../server/postgres-repository.ts";
import { database } from "../server/database.ts";
test(
  "hosted replay preserves the SQLite decision contract, deduplication and persisted outcomes",
  { skip: process.env.BT_HOSTED_TESTS !== "1", timeout: 600000 },
  async () => {
    const local = new Engine(":memory:");
    const remote = new PostgresRepository(database(true));
    try {
      const a = local.createSession(),
        b = process.env.BT_TEST_SESSION
          ? await remote.session(process.env.BT_TEST_SESSION)
          : await remote.createSession();
      for (let i = 0; i < 5; i++) {
        local.advance(a.id, steps[i], `step-${i}`, i);
        await remote.advance(b.id, steps[i], `step-${i}`, i);
        await local.processJobs();
        await remote.processJobs(undefined, b.id);
        const x = local.snapshot(a.id),
          y = await remote.snapshot(b.id);
        for (const person of ["daniel", "sam", "maya"]) {
          assert.equal(
            y.decisions.filter((d) => d.person === person).at(-1)?.trace
              ?.selectedId,
            x.decisions.filter((d) => d.person === person).at(-1)?.trace
              ?.selectedId,
            `${person}, revision ${i + 1}`,
          );
        }
        assert.equal(y.failedJobs, 0);
        assert.equal(y.pendingJobs, 0);
        console.log(
          `Hosted parity revision ${i + 1}: three decisions verified`,
        );
      }
      const final = await remote.snapshot(b.id);
      assert.equal(final.decisions.length, 15);
      assert.equal(final.actions.length, 6);
      await remote.advance(b.id, "confirm", "step-4", 4);
      await remote.processJobs(undefined, b.id);
      assert.equal((await remote.snapshot(b.id)).actions.length, 6);
      await assert.rejects(
        remote.advance(b.id, "confirm", "wrong", 0),
        /revision|step/i,
      );
      const reopen = new PostgresRepository(database(true));
      try {
        const s = await reopen.snapshot(b.id);
        assert.equal(s.actions.length, 6);
        assert.ok(s.operations.outcomes.length > 0);
        assert.equal(
          (await reopen.snapshot(b.id, 1)).households[0].restored,
          false,
        );
      } finally {
        await reopen.close();
      }
    } finally {
      local.close();
      await remote.close();
    }
  },
);
