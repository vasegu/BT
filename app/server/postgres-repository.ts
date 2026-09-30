import type { Sql } from "postgres";
import { randomUUID } from "node:crypto";
import {
  generateHistory,
  stableId,
  fixtureHash,
} from "../../scripts/generate-bt-history.ts";
import {
  importHistory,
  domainTables,
} from "../../scripts/import-bt-history.ts";
import { clocks, steps, DomainError, projectOperations } from "./engine.ts";
import { buildContext, type ContextBundle } from "./context.ts";
import { availableEvents, hash } from "./memory.ts";
import { enrichContext } from "./memory-repository.ts";
import { projectNetwork } from "./network.ts";
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
const sessionTables = [
  ...domainTables.filter(
    (t) => t !== "operations.products" && t !== "ingestion.sources",
  ),
  "ingestion.events",
];
type Baseline = { id: string; datasetId: string; hash: string; fixture: HouseholdFixture };
// Every statement below is one network round trip. Supabase is remote (and sometimes
// reached over high-latency links), so each user action is kept to one or two statements.
export class PostgresRepository {
  db: Sql;
  private processing = false;
  private processingDone: Promise<void> = Promise.resolve();
  private closing = false;
  private fixtures = new Map<string, Promise<HouseholdFixture>>();
  private baselines = new Map<string, Promise<Baseline>>();
  private settled = new Map<string, Snapshot>();
  constructor(db: Sql) {
    this.db = db;
  }
  /** The generated dataset is imported once into a hidden baseline session; sessions clone it inside Postgres. */
  baseline(variant = "canonical"): Promise<Baseline> {
    if (!this.baselines.has(variant))
      this.baselines.set(
        variant,
        (async () => {
          const fixture = generateHistory({ variant });
          const hash = fixtureHash(fixture),
            datasetId = `${fixture.datasetVersion}/${fixture.variant}/${fixture.seed}`,
            id = stableId(`baseline/${datasetId}/${hash}`);
          const [row] = await this
            .db`select (select content_hash from runtime.datasets where id=${datasetId}) hash, exists(select 1 from runtime.sessions where id=${id}) ready`;
          if (row.hash && row.hash !== hash)
            throw new Error(
              `Dataset ${datasetId} in Supabase differs from the generator. Increment its version.`,
            );
          if (!row.ready) await importHistory(fixture, id, this.db);
          return { id, datasetId, hash, fixture };
        })().catch((e) => {
          this.baselines.delete(variant);
          throw e;
        }),
      );
    return this.baselines.get(variant)!;
  }
  async createSession(variant = "canonical") {
    const base = await this.baseline(variant),
      id = randomUUID();
    const clones = sessionTables.map(
      (t, i) =>
        `c${i} as (insert into ${t} select (jsonb_populate_record(null::${t}, to_jsonb(x) || jsonb_build_object('session_id', $1::uuid))).* from ${t} x where x.session_id=$2::uuid)`,
    );
    const [row] = await this.db.unsafe(
      `with s as (insert into runtime.sessions(id,dataset_id,variant) values($1,$3,$4) returning created_at), ${clones.join(",")} select created_at from s`,
      [id, base.id, base.datasetId, variant],
    );
    this.fixtures.set(id, Promise.resolve(base.fixture));
    return {
      id,
      seedVersion: base.datasetId,
      step: 0,
      revision: 0,
      createdAt: normal(row.created_at),
    };
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
        this.overlayFixture(id).catch((e) => {
          this.fixtures.delete(id);
          throw e;
        }),
      );
    }
    return this.fixtures.get(id)!;
  }
  /** Baseline history (generated locally, hash-checked against Supabase) plus this session's own Eve records. */
  private async overlayFixture(id: string): Promise<HouseholdFixture> {
    const [row] = await this.db`select s.variant, s.dataset_id, d.content_hash,
      coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',e.id,'source',e.source_id,'sourceEventId',e.source_event_id,'type',e.event_type,
        'occurredAt',e.occurred_at,'knownAt',e.known_at,'personId',e.person_id,
        'serviceId',e.service_id,'caseId',e.case_id,'description',e.description,
        'payload',e.payload,'supersedesId',e.supersedes_id,'correlationId',e.correlation_id
      ))) from ingestion.events e where e.session_id=s.id and e.payload->>'origin'='eve'),'[]') events,
      coalesce((select jsonb_agg(to_jsonb(c)-'session_id') from operations.conversations c where c.session_id=s.id and c.id in (select (e.payload->>'conversationId')::uuid from ingestion.events e where e.session_id=s.id and e.payload->>'origin'='eve')),'[]') conversations,
      coalesce((select jsonb_agg(to_jsonb(m)-'session_id') from operations.messages m where m.session_id=s.id and m.conversation_id in (select (e.payload->>'conversationId')::uuid from ingestion.events e where e.session_id=s.id and e.payload->>'origin'='eve')),'[]') messages
      from runtime.sessions s join runtime.datasets d on d.id=s.dataset_id where s.id=${id}`;
    if (!row)
      throw new DomainError("Session not found in the selected store", 404);
    const base = await this.baseline(row.variant);
    if (row.dataset_id !== base.datasetId || row.content_hash !== base.hash)
      return this.fullFixture(id);
    if (!row.events.length) return base.fixture;
    const f = base.fixture;
    return {
      ...f,
      tables: {
        ...f.tables,
        "operations.conversations": [
          ...f.tables["operations.conversations"],
          ...row.conversations,
        ],
        "operations.messages": [
          ...f.tables["operations.messages"],
          ...row.messages,
        ],
      },
      events: [
        ...f.events,
        ...row.events.map((e: any) => ({
          ...e,
          personId: e.personId ?? null,
          serviceId: e.serviceId ?? null,
          caseId: e.caseId ?? null,
          occurredAt: normal(e.occurredAt),
          knownAt: normal(e.knownAt),
        })),
      ].sort(
        (a, b) =>
          a.knownAt.localeCompare(b.knownAt) ||
          a.occurredAt.localeCompare(b.occurredAt) ||
          a.sourceEventId.localeCompare(b.sourceEventId),
      ),
    };
  }
  /** Sessions from an earlier dataset version: read every row back from Supabase. */
  private async fullFixture(id: string): Promise<HouseholdFixture> {
    // One snapshot-consistent round trip; table names come only from the import allowlist.
    const tables = domainTables
      .map((table) => {
        const shared =
          table === "ingestion.sources" || table === "operations.products";
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
    const settled = cutoff === undefined ? undefined : this.settled.get(`${id}/${cutoff}`);
    if (settled) {
      // A past moment's content never changes, but how far the session has been played does:
      // read the current revision so the clock knows which later moments exist.
      const [now] = await this.db`select revision, step from runtime.sessions where id=${id}`;
      const copy = structuredClone(settled);
      if (now) copy.session = { ...copy.session, revision: now.revision, step: now.step };
      return copy;
    }
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
    const result: Snapshot = {
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
        network: projectNetwork(fixture, clocks[at]),
        outcomes: state.checks.map((c: any) => ({
          ...c.contract,
          check: c.verification,
        })),
      },
      nextStep: at < session.revision ? null : (steps[session.step] ?? null),
    };
    // A past revision with no outstanding jobs can no longer change; keep it in memory.
    if (at < session.revision && !state.pending && !state.failed) {
      if (this.settled.size >= 120)
        this.settled.delete(this.settled.keys().next().value!);
      this.settled.set(`${id}/${at}`, structuredClone(result));
    }
    return result;
  }
  async advance(id: string, step: string, key: string, revision: number) {
    if (!key || key.length > 100)
      throw new DomainError("Invalid idempotency key");
    const index = steps.indexOf(step as (typeof steps)[number]);
    if (index < 0) throw new DomainError("Unsupported scenario step");
    // Checks, step increment and job enqueue in one statement (one round trip).
    const [r] = await this.db`with s as (select id,step,revision,created_at,dataset_id from runtime.sessions where id=${id} for update),
      ex as (select step from runtime.jobs where session_id=${id} and idempotency_key=${key}),
      busy as (select 1 from runtime.jobs where session_id=${id} and state<>'complete' limit 1),
      up as (update runtime.sessions t set step=t.step+1,revision=t.revision+1 from s
        where t.id=s.id and s.revision=${revision} and s.step=${index}
        and not exists(select 1 from ex) and not exists(select 1 from busy)
        returning t.id,t.step,t.revision,t.created_at,t.dataset_id),
      ins as (insert into runtime.jobs(session_id,revision,step,idempotency_key) select id,revision,${step},${key} from up returning 1)
      select (select to_jsonb(s) from s) session,(select step from ex) existing,
        exists(select 1 from busy) busy,(select to_jsonb(up) from up) updated,(select count(*)::int from ins) queued`;
    if (!r.session) throw new DomainError("Session not found", 404);
    const shape = (x: any) => ({
      id: x.id,
      seedVersion: x.dataset_id,
      step: x.step,
      revision: x.revision,
      createdAt: normal(x.created_at),
    });
    if (r.existing) {
      if (r.existing !== step)
        throw new DomainError("Idempotency key already used", 409);
      return shape(r.session);
    }
    if (r.session.revision !== revision || r.session.step !== index)
      throw new DomainError("Revision or step changed", 409);
    if (r.busy) throw new DomainError("Wait for the current decision job", 409);
    if (!r.updated || r.queued !== 1)
      throw new DomainError("Revision or step changed", 409);
    return shape(r.updated);
  }
  async claim(sessionId?: string): Promise<{
    id: string;
    session_id: string;
    revision: number;
    token: string;
  } | null> {
    const token = randomUUID();
    const [job] = await this.db`update runtime.jobs j set state='running',lease_token=${token},lease_until=now()+interval '10 minutes',attempts=j.attempts+1
      from (select session_id,id from runtime.jobs where (${sessionId ?? null}::uuid is null or session_id=${sessionId ?? null}::uuid)
        and (state in ('pending','failed') or (state='running' and lease_until<now())) and attempts<3
        order by session_id,revision for update skip locked limit 1) c
      where j.session_id=c.session_id and j.id=c.id returning j.id,j.session_id,j.revision`;
    return job
      ? { id: job.id, session_id: job.session_id, revision: job.revision, token }
      : null;
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
              // Insert-or-read plus lease check in one round trip.
              const [saved] = await this
                .db`with ins as (insert into runtime.assessments(session_id,job_id,person_id,state,context_hash,context,request,data) values(${job.session_id},${job.id},${context.personId},'started',${context.hash},${this.db.json(context as any)},${this.db.json(request as any)},${evaluate ? this.db.json(emptyAssessment(request) as any) : null}) on conflict do nothing returning context_hash,data)
                  select i.context_hash,i.data,true fresh,exists(select 1 from runtime.jobs where session_id=${job.session_id} and id=${job.id} and lease_token=${job.token} and lease_until>now() and state='running') leased from ins i
                  union all select a.context_hash,a.data,false,true from runtime.assessments a where a.session_id=${job.session_id} and a.job_id=${job.id} and a.person_id=${context.personId} and not exists(select 1 from ins)`;
              if (saved.context_hash !== context.hash)
                throw new Error("Frozen context changed; assessment held");
              let assessment = saved.data;
              if (saved.fresh && evaluate) {
                if (!saved.leased)
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
    const proposals = decisions.map((d) => {
      const c = contexts.find((c) => c.household.id === d.person)!;
      return { d, c, proposed: serviceMessage(c.household, d) };
    });
    const keys = proposals.flatMap((p) => (p.proposed ? [p.proposed.key] : []));
    // Five round trips in total: begin, lock+dedupe read, all inserts, observations+complete, commit.
    await this.db.begin(async (sql) => {
      const [current] = await sql`select j.lease_token,j.state,j.lease_until,s.revision,
        coalesce((select jsonb_agg(jsonb_build_object('person',a.person_id,'key',a.logical_key)) from runtime.actions a
          where a.session_id=j.session_id and a.logical_key = any(${keys}::text[])),'[]') priors
        from runtime.jobs j join runtime.sessions s on s.id=j.session_id
        where j.session_id=${job.session_id} and j.id=${job.id} for update of j, s`;
      if (
        !current ||
        current.lease_token !== job.token ||
        current.state !== "running" ||
        new Date(current.lease_until).getTime() < Date.now() ||
        current.revision !== job.revision
      )
        throw new Error("Lease or revision changed before commit");
      type Insert = Record<string, unknown>;
      const flags: Insert[] = [],
        decisionRows: Insert[] = [],
        actions: Insert[] = [],
        receipts: Insert[] = [],
        expectations: Insert[] = [];
      for (const { d, c, proposed } of proposals) {
        const h = c.household;
        for (const e of h.evidence.filter((e) => e.revision === job.revision))
          flags.push({
            session_id: job.session_id,
            id: stableId(`${job.id}/${c.personId}/${e.id}`),
            person_id: c.personId,
            event_id: e.id,
            revision: job.revision,
            agent: e.type.startsWith("router.")
              ? "telemetry_observer"
              : e.type.startsWith("incident.")
                ? "incident_observer"
                : "care_observer",
            observation: e.description,
          });
        const prior =
          proposed &&
          current.priors.some(
            (p: any) => p.person === c.personId && p.key === proposed.key,
          );
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
        decisionRows.push({
          session_id: job.session_id,
          id: d.id,
          person_id: c.personId,
          job_id: job.id,
          revision: job.revision,
          data: d,
        });
        if (action) {
          actions.push({
            session_id: job.session_id,
            id: actionId,
            person_id: c.personId,
            decision_id: d.id,
            revision: job.revision,
            logical_key: proposed!.key,
            intended_expression: {
              version: "bt-service-templates-v1",
              tone: "service-specific, factual",
              commitments: h.promise && !h.promiseFulfilled ? [h.promise] : [],
              channel: "in_app",
              purpose: "service",
              source: "authored_template",
            },
            data: action,
          });
          receipts.push({
            session_id: job.session_id,
            id: receiptId,
            action_id: actionId,
            provenance: "simulated_delivery",
          });
          snapshot.actions.push(action);
        }
        for (const expectation of contractsFor(h, d, snapshot, false))
          expectations.push({
            session_id: job.session_id,
            id: expectation.id,
            person_id: c.personId,
            decision_id: d.id,
            scope_id: expectation.scopeId,
            goal: expectation.goal,
            revision: job.revision,
            data: expectation,
          });
      }
      const bulk = (table: string, rows: Insert[], n: number, conflict = "") =>
        rows.length
          ? `insert into ${table}(${Object.keys(rows[0]).join(",")}) select ${Object.keys(rows[0]).join(",")} from jsonb_populate_recordset(null::${table}, $${n}::jsonb) ${conflict}`
          : `select 1 from (select $${n}::jsonb) z where false`;
      const [written] = await sql.unsafe(
        `with f as (${bulk("runtime.flags", flags, 1, "on conflict do nothing")}),
          d as (${bulk("runtime.decisions", decisionRows, 2)}),
          a as (${bulk("runtime.actions", actions, 3)}),
          r as (${bulk("runtime.receipts", receipts, 4)}),
          x as (${expectations.length ? `${bulk("runtime.expectations", expectations, 5, "on conflict do nothing")} returning id,data` : "select null::uuid id,null::jsonb data from (select $5::jsonb) z where false"})
        select coalesce((select jsonb_agg(jsonb_build_object('id',id,'data',data)) from (
          select id,data from runtime.expectations where session_id=$6 and revision<=$7
          union all select id,data from x) e),'[]') expectations`,
        [
          flags as any,
          decisionRows as any,
          actions as any,
          receipts as any,
          expectations as any,
          job.session_id,
          job.revision,
        ],
      );
      const observations = written.expectations.map((e: any) => ({
        session_id: job.session_id,
        expectation_id: e.id,
        revision: job.revision,
        data: verifyOutcome(e.data as OutcomeContract, snapshot),
      }));
      await sql.unsafe(
        `with o as (${bulk("runtime.outcome_observations", observations, 1, "on conflict do nothing")})
         update runtime.jobs set state='complete',error=null,lease_until=null where session_id=$2 and id=$3`,
        [observations as any, job.session_id, job.id],
      );
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
