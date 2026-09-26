import type { Sql } from "postgres";
import { randomUUID } from "node:crypto";
import {
  generateHistory,
  stableId,
} from "../../scripts/generate-bt-history.ts";
import {
  importHistory,
  domainTables,
} from "../../scripts/import-bt-history.ts";
import { clocks, steps, DomainError, projectOperations } from "./engine.ts";
import { buildContext, type ContextBundle } from "./context.ts";
import { availableEvents, hash } from "./memory.ts";
import { enrichContext } from "./memory-repository.ts";
import { arbitrate, serviceMessage } from "./arbiter.ts";
import {
  buildAssessmentRequest,
  emptyAssessment,
  applyAssessment,
  type Evaluator,
} from "./assessment.ts";
import { contractsFor, verifyOutcome } from "./outcomes.ts";
import type { HouseholdFixture, Row } from "./data-model.ts";
import type {
  Snapshot,
  SourceEvent,
  PersonId,
  Decision,
  DemoAction,
  OutcomeContract,
} from "../src/types.ts";

const normal = (date: Date | string) =>
  new Date(date).toISOString().replace(".000Z", "Z");
export class PostgresRepository {
  db: Sql;
  private processing = false;
  private processingDone: Promise<void> = Promise.resolve();
  private closing = false;
  private fixtures = new Map<string, Promise<HouseholdFixture>>();
  constructor(db: Sql) {
    this.db = db;
  }
  async createSession(variant = "canonical") {
    const id = randomUUID();
    const fixture = generateHistory({ variant });
    await importHistory(fixture, id, this.db);
    this.fixtures.set(id, Promise.resolve(fixture));
    return this.session(id);
  }
  async session(id: string): Promise<Snapshot["session"]> {
    const [s] = await this.db`select * from runtime.sessions where id=${id}`;
    if (!s)
      throw new DomainError("Session not found in the selected store", 404);
    return {
      id: s.id,
      seedVersion: s.dataset_id,
      step: s.step,
      revision: s.revision,
      createdAt: normal(s.created_at),
    };
  }
  async fixture(id: string): Promise<HouseholdFixture> {
    if (!this.fixtures.has(id)) {
      if (this.fixtures.size >= 24)
        this.fixtures.delete(this.fixtures.keys().next().value!);
      this.fixtures.set(
        id,
        (async () => {
          // One snapshot-consistent round trip; table names come only from the import allowlist.
          const tables = domainTables
            .map((table) => {
              const shared =
                table === "ingestion.sources" ||
                table === "operations.products";
              return `'${table}', coalesce((select jsonb_agg(to_jsonb(t)-'session_id') from ${table} t ${shared ? "" : "where t.session_id=s.id"}), '[]'::jsonb)`;
            })
            .join(",");
          const [row] = await this.db.unsafe(
            `select jsonb_build_object(
            'datasetVersion', d.manifest->>'datasetVersion', 'seed', d.seed,
            'variant', d.manifest->>'variant', 'scenarioStart', d.manifest->>'scenarioStart',
            'timeZone', 'Europe/London', 'tables', jsonb_build_object(${tables}),
            'events', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
              'id',e.id,'source',e.source_id,'sourceEventId',e.source_event_id,'type',e.event_type,
              'occurredAt',e.occurred_at,'knownAt',e.known_at,'personId',e.person_id,
              'serviceId',e.service_id,'caseId',e.case_id,'description',e.description,
              'payload',e.payload,'supersedesId',e.supersedes_id,'correlationId',e.correlation_id
            )) order by e.known_at,e.occurred_at,e.source_event_id) from ingestion.events e where e.session_id=s.id),'[]'::jsonb)
          ) fixture from runtime.sessions s join runtime.datasets d on d.id=s.dataset_id where s.id=$1`,
            [id],
          );
          if (!row) throw new DomainError("Session not found", 404);
          const fixture = row.fixture as HouseholdFixture;
          fixture.seed = Number(fixture.seed);
          fixture.events = fixture.events.map((e) => ({
            ...e,
            personId: e.personId ?? null,
            serviceId: e.serviceId ?? null,
            caseId: e.caseId ?? null,
            occurredAt: normal(e.occurredAt),
            knownAt: normal(e.knownAt),
          }));
          return fixture;
        })().catch((e) => {
          this.fixtures.delete(id);
          throw e;
        }),
      );
    }
    return this.fixtures.get(id)!;
  }
  async contexts(id: string, at: number) {
    const fixture = await this.fixture(id);
    return Promise.all(
      ["daniel", "sam", "maya"].map(async (alias) =>
        enrichContext(
          buildContext({
            fixture,
            sessionId: id,
            personId: fixture.tables["customer.people"].find(
              (p) => p.alias === alias,
            )!.id,
            serviceId: fixture.tables["customer.services"].find(
              (s) => s.reference === `svc_${alias}_broadband`,
            )!.id,
            cutoff: clocks[at],
            purpose: "service",
          }),
        ),
      ),
    );
  }
  async snapshot(id: string, cutoff?: number): Promise<Snapshot> {
    if (
      cutoff !== undefined &&
      (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 5)
    )
      throw new DomainError("Invalid historical cutoff");
    const [[state], fixture] = await Promise.all([
      this.db`select to_jsonb(s) session,
      coalesce((select jsonb_agg(data order by revision,person_id) from runtime.decisions where session_id=s.id and revision<=coalesce(${cutoff ?? null}::int,s.revision)),'[]') decisions,
      coalesce((select jsonb_agg(data order by revision,person_id) from runtime.actions where session_id=s.id and revision<=coalesce(${cutoff ?? null}::int,s.revision)),'[]') actions,
      (select count(*)::int from runtime.jobs where session_id=s.id and revision<=coalesce(${cutoff ?? null}::int,s.revision) and state in ('pending','running')) pending,
      (select count(*)::int from runtime.jobs where session_id=s.id and revision<=coalesce(${cutoff ?? null}::int,s.revision) and state='failed') failed,
      coalesce((select jsonb_agg(x) from (select distinct on (e.id) e.data contract,o.data verification from runtime.expectations e join runtime.outcome_observations o on o.session_id=e.session_id and o.expectation_id=e.id where e.session_id=s.id and e.revision<=coalesce(${cutoff ?? null}::int,s.revision) and o.revision<=coalesce(${cutoff ?? null}::int,s.revision) order by e.id,o.revision desc) x),'[]') checks
      from runtime.sessions s where s.id=${id}`,
      this.fixture(id),
    ]);
    if (!state)
      throw new DomainError("Session not found in the selected store", 404);
    const raw = state.session,
      session = {
        id: raw.id,
        seedVersion: raw.dataset_id,
        step: raw.step,
        revision: raw.revision,
        createdAt: normal(raw.created_at),
      },
      at = cutoff ?? raw.revision;
    if (at > session.revision)
      throw new DomainError("Invalid historical cutoff");
    const contexts = await this.contexts(id, at);
    const aliases = new Map(
      fixture.tables["customer.people"].map((p) => [p.id, p.alias]),
    );
    const sources = new Map(
      fixture.tables["ingestion.sources"].map((s) => [s.id, s.name]),
    );
    const events: SourceEvent[] = availableEvents(
      fixture.events,
      clocks[at],
    ).map((e) => ({
      id: e.id,
      sessionId: id,
      serviceId: e.serviceId,
      revision: Math.max(
        0,
        clocks.findIndex(
          (c) =>
            Date.parse(c) >=
            Math.max(Date.parse(e.occurredAt), Date.parse(e.knownAt)),
        ),
      ),
      occurredAt: normal(e.occurredAt),
      receivedAt: normal(e.knownAt),
      type: e.type,
      subject: e.personId ? (aliases.get(e.personId) as PersonId) : "shared",
      source: String(sources.get(e.source)),
      description: e.description,
      payload: e.payload,
      ...(e.type === "incident.confirmed"
        ? {
            affectedServiceIds: contexts
              .filter((c) =>
                c.evidence.some(
                  (x) =>
                    x.id === e.id &&
                    Array.isArray(x.payload.affected) &&
                    x.payload.affected.includes(c.household.id),
                ),
              )
              .map((c) => c.serviceId),
          }
        : {}),
    }));
    return {
      storage: "supabase",
      session,
      cutoff: at,
      historical: at < session.revision,
      clock: clocks[at],
      pendingJobs: state.pending,
      failedJobs: state.failed,
      households: contexts.map((c) => ({
        ...c.household,
        memory: {
          hash: c.hash,
          items: c.memories.filter((m) => c.retrieval.admitted.includes(m.id)),
        },
      })),
      events,
      decisions: state.decisions,
      actions: state.actions,
      operations: {
        ...projectOperations(events),
        outcomes: state.checks.map((c: any) => ({
          ...c.contract,
          check: c.verification,
        })),
      },
      nextStep: at < session.revision ? null : (steps[session.step] ?? null),
    };
  }
  async advance(id: string, step: string, key: string, revision: number) {
    if (!key || key.length > 100)
      throw new DomainError("Invalid idempotency key");
    await this.db.begin(async (sql) => {
      const [session] =
        await sql`select * from runtime.sessions where id=${id} for update`;
      if (!session) throw new DomainError("Session not found", 404);
      const [existing] =
        await sql`select * from runtime.jobs where session_id=${id} and idempotency_key=${key}`;
      if (existing) {
        if (existing.step !== step)
          throw new DomainError("Idempotency key already used", 409);
        return;
      }
      if (session.revision !== revision || steps[session.step] !== step)
        throw new DomainError("Revision or step changed", 409);
      const [pending] =
        await sql`select 1 from runtime.jobs where session_id=${id} and state<>'complete' limit 1`;
      if (pending)
        throw new DomainError("Wait for the current decision job", 409);
      await sql`update runtime.sessions set step=step+1,revision=revision+1 where id=${id}`;
      await sql`insert into runtime.jobs(session_id,revision,step,idempotency_key) values(${id},${revision + 1},${step},${key})`;
    });
    return this.session(id);
  }
  async claim(sessionId?: string): Promise<{
    id: string;
    session_id: string;
    revision: number;
    token: string;
  } | null> {
    return this.db.begin(async (sql) => {
      const [job] =
        await sql`select * from runtime.jobs where (${sessionId ?? null}::uuid is null or session_id=${sessionId ?? null}::uuid) and (state in ('pending','failed') or (state='running' and lease_until<now())) and attempts<3 order by session_id,revision for update skip locked limit 1`;
      if (!job) return null;
      const token = randomUUID();
      await sql`update runtime.jobs set state='running',lease_token=${token},lease_until=now()+interval '10 minutes',attempts=attempts+1 where session_id=${job.session_id} and id=${job.id}`;
      return {
        id: job.id,
        session_id: job.session_id,
        revision: job.revision,
        token,
      };
    });
  }
  async processJobs(evaluate?: Evaluator, sessionId?: string) {
    if (this.closing) return;
    if (this.processing) return this.processingDone;
    this.processing = true;
    let finished!: () => void;
    this.processingDone = new Promise((resolve) => {
      finished = resolve;
    });
    try {
      // A bounded batch yields to HTTP work. Postgres leases support safe restart/concurrent workers.
      for (let n = 0; n < 6 && !this.closing; n++) {
        const job = await this.claim(sessionId);
        if (!job) break;
        try {
          const [snapshot, before] = await Promise.all([
            this.snapshot(job.session_id, job.revision),
            this.snapshot(job.session_id, job.revision - 1),
          ]);
          const contexts = await this.contexts(job.session_id, job.revision);
          const prepared = await Promise.all(
            contexts.map(async (context) => {
              await enrichContext(context, this.db);
              const h = snapshot.households.find(
                (h) => h.id === context.household.id,
              )!;
              let decision = arbitrate(
                h,
                before.households.find((p) => p.id === h.id)!,
                snapshot,
              );
              const request = buildAssessmentRequest(h, snapshot, decision);
              const inserted = await this
                .db`insert into runtime.assessments(session_id,job_id,person_id,state,context_hash,context,request,data) values(${job.session_id},${job.id},${context.personId},'started',${context.hash},${this.db.json(context as any)},${this.db.json(request as any)},${evaluate ? this.db.json(emptyAssessment(request) as any) : null}) on conflict do nothing returning person_id`;
              const [saved] = await this
                .db`select * from runtime.assessments where session_id=${job.session_id} and job_id=${job.id} and person_id=${context.personId}`;
              if (saved.context_hash !== context.hash)
                throw new Error("Frozen context changed; assessment held");
              let assessment = saved.data;
              if (inserted.length && evaluate) {
                const [lease] = await this
                  .db`select 1 from runtime.jobs where session_id=${job.session_id} and id=${job.id} and lease_token=${job.token} and lease_until>now() and state='running'`;
                if (!lease)
                  throw new Error("Lease expired before provider call");
                try {
                  assessment = await evaluate(request);
                } catch {
                  assessment = {
                    ...emptyAssessment(request),
                    status: "error",
                    error: "Provider attempt failed; no automatic rebilling.",
                  };
                }
              }
              if (assessment) decision = applyAssessment(decision, assessment);
              await this
                .db`update runtime.assessments set state='recorded',data=${assessment ? this.db.json(assessment) : null} where session_id=${job.session_id} and job_id=${job.id} and person_id=${context.personId} and exists(select 1 from runtime.jobs j where j.session_id=${job.session_id} and j.id=${job.id} and j.lease_token=${job.token} and j.lease_until>now() and j.state='running')`;
              return decision;
            }),
          );
          await this.commitJob(job, snapshot, contexts, prepared);
        } catch (error) {
          await this
            .db`update runtime.jobs set state='failed',error=${error instanceof Error ? error.message : "Worker failure"},lease_until=null where session_id=${job.session_id} and id=${job.id} and lease_token=${job.token}`;
        }
      }
    } finally {
      this.processing = false;
      finished();
    }
  }
  private async commitJob(
    job: any,
    snapshot: Snapshot,
    contexts: ContextBundle[],
    decisions: Decision[],
  ) {
    await this.db.begin(async (sql) => {
      const [current] =
        await sql`select * from runtime.jobs where session_id=${job.session_id} and id=${job.id} for update`;
      const [session] =
        await sql`select revision from runtime.sessions where id=${job.session_id} for update`;
      if (
        current.lease_token !== job.token ||
        current.state !== "running" ||
        new Date(current.lease_until).getTime() < Date.now() ||
        session.revision !== job.revision
      )
        throw new Error("Lease or revision changed before commit");
      const writes: any[] = [];
      for (const d of decisions) {
        const c = contexts.find((c) => c.household.id === d.person)!,
          h = c.household;
        for (const e of h.evidence.filter((e) => e.revision === job.revision)) {
          const agent = e.type.startsWith("router.")
            ? "telemetry_observer"
            : e.type.startsWith("incident.")
              ? "incident_observer"
              : "care_observer";
          writes.push(
            sql`insert into runtime.flags(session_id,id,person_id,event_id,revision,agent,observation) values(${job.session_id},${stableId(`${job.id}/${c.personId}/${e.id}`)},${c.personId},${e.id},${job.revision},${agent},${e.description}) on conflict do nothing`,
          );
        }
        const proposed = serviceMessage(h, d);
        const [prior] = proposed
          ? await sql`select id from runtime.actions where session_id=${job.session_id} and person_id=${c.personId} and logical_key=${proposed.key}`
          : [];
        const actionId = randomUUID(),
          receiptId = randomUUID();
        const action: DemoAction | undefined =
          proposed && h.contactAllowed && !prior
            ? {
                id: actionId,
                person: h.id,
                revision: job.revision,
                time: clocks[job.revision],
                kind: "in_app_update",
                title: proposed.title,
                body: proposed.body,
                status: "simulated_delivered",
                decisionId: d.id,
                receiptId,
                provenance: "demo_action",
              }
            : undefined;
        d.trace!.execution.push(
          {
            stage: "Frozen context",
            status: "passed",
            detail: `Source evidence and memory manifest ${c.hash.slice(0, 12)}; both timestamps bounded.`,
          },
          {
            stage: "Atomic commit",
            status: action ? "committed" : prior ? "deduplicated" : "held",
            detail: action
              ? "Decision, action, expectation and simulated receipt in one Postgres transaction."
              : prior
                ? "Logical action already committed."
                : "No new permitted contact.",
            ...(action ? { actionId, receiptId } : {}),
          },
        );
        writes.push(
          sql`insert into runtime.decisions(session_id,id,person_id,job_id,revision,data) values(${job.session_id},${d.id},${c.personId},${job.id},${job.revision},${sql.json(d as any)})`,
        );
        if (action) {
          const expression = {
            version: "bt-service-templates-v1",
            tone: "service-specific, factual",
            commitments: h.promise && !h.promiseFulfilled ? [h.promise] : [],
            channel: "in_app",
            purpose: "service",
            source: "authored_template",
          };
          writes.push(
            sql`insert into runtime.actions(session_id,id,person_id,decision_id,revision,logical_key,intended_expression,data) values(${job.session_id},${actionId},${c.personId},${d.id},${job.revision},${proposed!.key},${sql.json(expression)},${sql.json(action as any)})`,
          );
          writes.push(
            sql`insert into runtime.receipts(session_id,id,action_id,provenance) values(${job.session_id},${receiptId},${actionId},'simulated_delivery')`,
          );
          snapshot.actions.push(action);
        }
        for (const expectation of contractsFor(h, d, snapshot, false))
          writes.push(
            sql`insert into runtime.expectations(session_id,id,person_id,decision_id,scope_id,goal,revision,data) values(${job.session_id},${expectation.id},${c.personId},${d.id},${expectation.scopeId},${expectation.goal},${job.revision},${sql.json(expectation as any)}) on conflict do nothing`,
          );
      }
      await Promise.all(writes);
      const expectations =
        await sql`select id,data from runtime.expectations where session_id=${job.session_id} and revision<=${job.revision}`;
      await Promise.all(
        expectations.map(
          (e) =>
            sql`insert into runtime.outcome_observations(session_id,expectation_id,revision,data) values(${job.session_id},${e.id},${job.revision},${sql.json(verifyOutcome(e.data as OutcomeContract, snapshot) as any)}) on conflict do nothing`,
        ),
      );
      await sql`update runtime.jobs set state='complete',error=null,lease_until=null where session_id=${job.session_id} and id=${job.id}`;
    });
  }
  async saveConversation(
    id: string,
    person: PersonId,
    at: number,
    messages: { role: "user" | "assistant"; content: string }[],
  ) {
    const live = await this.session(id);
    const c = (await this.contexts(id, live.revision)).find(
      (c) => c.household.id === person,
    )!;
    if (!c.household.contactAllowed)
      throw new DomainError("Service contact permission unavailable", 403);
    const time = new Date().toISOString(),
      conversationId = stableId(`${id}/${person}/eve/${hash(messages)}`);
    const fixture = await this.fixture(id),
      source = fixture.tables["ingestion.sources"].find(
        (s) => s.name === "crm_simulator",
      )!.id;
    // Server-verified exchange only; client-supplied assistant history is never persisted as an agent reply.
    await this.db.begin(async (sql) => {
      await sql`insert into operations.conversations(session_id,id,person_id,service_id,channel,started_at,retention_basis) values(${id},${conversationId},${c.personId},${c.serviceId},'in_app',${time},'Local presenter synthetic Eve session; retained for this demonstration') on conflict do nothing`;
      for (const [i, m] of messages.entries()) {
        const eventId = stableId(`${conversationId}/${i}`);
        await sql`insert into ingestion.events(session_id,id,source_id,source_event_id,event_type,occurred_at,known_at,person_id,service_id,description,payload) values(${id},${eventId},${source},${`${conversationId}/${i}`},'conversation.message',${time},${time},${c.personId},${c.serviceId},${m.content},${sql.json({ speakerRole: m.role === "user" ? "customer" : "assistant", conversationId, channel: "in_app", origin: "eve", epistemic: "stated", replayCutoff: clocks[at] })}) on conflict do nothing`;
        await sql`insert into operations.messages(session_id,id,conversation_id,speaker_role,speaker_ref,sent_at,body,source_event_id) values(${id},${eventId},${conversationId},${m.role === "user" ? "customer" : "assistant"},${m.role === "user" ? person : "Eve"},${time},${m.content},${eventId}) on conflict do nothing`;
      }
    });
    this.fixtures.delete(id);
  }
  async close() {
    this.closing = true;
    await this.processingDone;
    await this.db.end();
  }
}
