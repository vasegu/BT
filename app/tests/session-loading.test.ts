import { test } from "node:test";
import assert from "node:assert/strict";
import { PostgresRepository } from "../server/postgres-repository.ts";
import {
  generateHistory,
  fixtureHash,
} from "../../scripts/generate-bt-history.ts";
import {
  readSnapshot,
  cachedSnapshot,
  invalidateSnapshot,
} from "../src/snapshot-client.ts";

test("sessions share one hash-checked baseline; each session costs one small overlay read", async () => {
  const fixture = generateHistory();
  const hash = fixtureHash(fixture),
    datasetId = `${fixture.datasetVersion}/${fixture.variant}/${fixture.seed}`;
  const reads: string[] = [];
  const db = Object.assign(
    async (parts: TemplateStringsArray) => {
      const text = parts.join("?");
      if (text.includes("exists(select 1 from runtime.sessions")) {
        reads.push("baseline");
        return [{ hash, ready: true }];
      }
      if (text.includes("payload->>'origin'='eve'")) {
        reads.push("overlay");
        return [
          {
            variant: "canonical",
            dataset_id: datasetId,
            content_hash: hash,
            events: [],
            conversations: [],
            messages: [],
          },
        ];
      }
      throw Error("Unexpected extra database read");
    },
    {
      unsafe: async () => {
        throw Error("The full per-session history should not be read");
      },
    },
  );
  const repo = new PostgresRepository(db as any);
  const [a, b] = await Promise.all([repo.fixture("one"), repo.fixture("one")]);
  assert.equal(a, b);
  assert.equal(a.events.length, fixture.events.length);
  assert.deepEqual(reads.sort(), ["baseline", "overlay"]);
  const c = await repo.fixture("two");
  assert.equal(c, a, "an unchanged session reuses the baseline object");
  assert.deepEqual(reads.sort(), ["baseline", "overlay", "overlay"]);
});

test("session reads deduplicate, preserve a loaded chapter, and invalidate after a write", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let calls = 0;
  let revision = 1;
  globalThis.fetch = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return Response.json({
      session: { id: "loading-test", revision },
      cutoff: revision,
      pendingJobs: 0,
      failedJobs: 0,
    });
  };
  const [a, b] = await Promise.all([
    readSnapshot("loading-test", 1),
    readSnapshot("loading-test", 1),
  ]);
  assert.equal(a, b);
  assert.equal(calls, 1);
  assert.equal(cachedSnapshot("loading-test", 1), a);
  assert.equal(cachedSnapshot("another-session", 1), null);
  await readSnapshot("loading-test", 1);
  assert.equal(calls, 1);
  invalidateSnapshot("loading-test");
  revision = 2;
  assert.equal((await readSnapshot("loading-test")).cutoff, 2);
  assert.equal(calls, 2);
});

test("pending work is never treated as a settled cached response, and errors do not poison retries", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? Response.json({ error: "Temporary failure" }, { status: 503 })
      : Response.json({
          session: { id: "pending-test" },
          cutoff: 1,
          pendingJobs: calls === 2 ? 1 : 0,
          failedJobs: 0,
        });
  };
  await assert.rejects(readSnapshot("pending-test"), /Temporary failure/);
  assert.equal((await readSnapshot("pending-test")).pendingJobs, 1);
  assert.equal((await readSnapshot("pending-test")).pendingJobs, 0);
  assert.equal(calls, 3);
});

test("a write cannot reuse an earlier in-flight read or let it overwrite the new cache", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let finish!: (r: Response) => void;
  let calls = 0;
  globalThis.fetch = async () =>
    ++calls === 1
      ? new Promise((r) => {
          finish = r;
        })
      : Response.json({
          session: { id: "write-race" },
          cutoff: 2,
          pendingJobs: 0,
        });
  const old = readSnapshot("write-race");
  invalidateSnapshot("write-race");
  const next = readSnapshot("write-race");
  finish(
    Response.json({ session: { id: "write-race" }, cutoff: 1, pendingJobs: 0 }),
  );
  assert.equal((await next).cutoff, 2);
  await old;
  assert.equal(cachedSnapshot("write-race")?.cutoff, 2);
});

test("a later job does not put an already-recorded chapter back into pending", async () => {
  const { Engine } = await import("../server/engine.ts");
  const engine = new Engine(":memory:");
  try {
    const s = engine.createSession();
    engine.advance(s.id, "heartbeat", "first", 0);
    await engine.processJobs();
    engine.advance(s.id, "incident", "next", 1);
    assert.equal(engine.snapshot(s.id).pendingJobs, 1);
    assert.equal(engine.snapshot(s.id, 1).pendingJobs, 0);
  } finally {
    engine.close();
  }
});

test("shutdown waits for the active worker before closing its database connection", async () => {
  let release!: (value: null) => void,
    closed = false;
  const repo = new PostgresRepository({
    end: async () => {
      closed = true;
    },
  } as any);
  repo.claim = async () =>
    new Promise((r) => {
      release = r;
    });
  const running = repo.processJobs();
  const closing = repo.close();
  await Promise.resolve();
  assert.equal(closed, false);
  release(null);
  await Promise.all([running, closing]);
  assert.equal(closed, true);
});

test("a dataset snapshot preserves the original profile after the generator moves on", async () => {
  const original = generateHistory();
  original.datasetVersion = "historical-A";
  original.tables["profile.members"][0].historicalMarker = "original profile";
  const db = async () => [{
    variant: original.variant,
    dataset_id: `historical-A/${original.variant}/${original.seed}`,
    content_hash: fixtureHash(original),
    fixture_snapshot: JSON.parse(JSON.stringify(original)),
    events: [], conversations: [], messages: [],
  }];
  const repo = new PostgresRepository(db as any);
  repo.baseline = async () => { throw Error("Historical snapshots must not load today's generator"); };
  assert.deepEqual(await repo.fixture("old-session"), original);
});

test("a corrupted stored snapshot cannot silently rewrite historical profiles", async () => {
  const original = generateHistory();
  const db = async () => [{fixture_snapshot: original, content_hash: "wrong-hash", events: []}];
  const repo = new PostgresRepository(db as any);
  repo.baseline = async () => { throw Error("Unexpected current baseline"); };
  await assert.rejects(repo.fixture("corrupt-session"), /snapshot.*hash/i);
});

test("Eve exchanges use the selected replay beat with separate wall-clock audit metadata", async () => {
  const { clocks } = await import("../server/engine.ts");
  const writes: {text: string; values: any[]}[] = [];
  const sql = Object.assign(async (parts: TemplateStringsArray, ...values: any[]) => {
    writes.push({text: parts.join("?"), values});
    return [];
  }, {json: (value: unknown) => value});
  const repo = new PostgresRepository({begin: async (fn: any) => fn(sql)} as any);
  repo.session = async () => ({revision: 8}) as any;
  repo.contexts = async () => [{household: {id: "daniel", contactAllowed: true}, personId: "person", serviceId: "service"}] as any;
  repo.fixture = async () => generateHistory();
  await repo.saveConversation("session", "daniel", 2, [{role: "user", content: "Test"}]);
  const event = writes.find(w => w.text.includes("insert into ingestion.events"))!;
  assert.equal(event.values[4], clocks[2]);
  assert.equal(event.values[5], clocks[2]);
  const payload = event.values.at(-1);
  assert.equal(payload.replayCutoff, clocks[2]);
  assert.equal(payload.replayBeat, 2);
  assert.ok(Number.isFinite(Date.parse(payload.recordedAt)));
});
