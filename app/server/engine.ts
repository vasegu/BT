import { DatabaseSync } from "node:sqlite";
import { contractsFor, verifyOutcome } from "./outcomes.ts";
import { randomUUID } from "node:crypto";
import { arbitrate, serviceMessage } from "./arbiter.ts";
import {
  buildAssessmentRequest,
  emptyAssessment,
  applyAssessment,
  type Evaluator,
} from "./assessment.ts";
import type {
  Snapshot,
  SourceEvent,
  Household,
  Decision,
  DemoAction,
  PersonId,
  Step,
  OutcomeContract,
  OutcomeCheck,
} from "../src/types.ts";

export const steps: Step[] = [
  "heartbeat",
  "incident",
  "restore",
  "callback",
  "confirm",
];
export const clocks = [
  "2026-09-25T19:45:00Z",
  "2026-09-25T20:00:00Z",
  "2026-09-25T20:03:00Z",
  "2026-09-25T20:12:00Z",
  "2026-09-25T20:15:00Z",
  "2026-09-25T20:18:00Z",
];
const people = [
  { id: "daniel", name: "Daniel Reed" },
  { id: "sam", name: "Sam Morgan" },
  { id: "maya", name: "Maya Patel" },
] as const;
type EventInput = {
  type: string;
  subject: PersonId | "shared";
  description: string;
  payload: Record<string, unknown>;
  source: string;
  occurredAt?: string;
};
type Session = Snapshot["session"];
export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function project(
  person: { id: PersonId; name: string },
  events: SourceEvent[],
): Household {
  const evidence = events.filter(
    (e) => e.subject === person.id || e.subject === "shared",
  );
  const h: Household = {
    ...person,
    serviceId: `svc_${person.id}_broadband`,
    owner: null,
    caseStatus: "none",
    promise: null,
    promiseFulfilled: false,
    serviceState: "No current observation",
    activation: "unknown",
    firstUseObserved: false,
    habit: null,
    restartTried: false,
    restored: false,
    confirmed: false,
    incident: false,
    incidentCleared: false,
    contactAllowed: false,
    evidence,
  };
  // A returning heartbeat is a restoration only if we saw the gap open. A routine morning
  // return after a household's usual overnight switch-off is normal, not a recovery.
  let gapOpen = false;
  for (const e of evidence) {
    switch (e.type) {
      case "contact.authority_recorded":
        h.contactAllowed =
          e.payload.allowed === true &&
          e.payload.purpose === "service" &&
          e.payload.channel === "in_app" &&
          e.payload.role === "account_holder";
        break;
      case "case.opened":
        h.caseStatus = "open";
        h.restored = false;
        h.confirmed = false;
        h.owner = typeof e.payload.owner === "string" ? e.payload.owner : null;
        h.serviceState = h.owner === "Activation team" ? "Activation case open" : "Open service case";
        break;
      case "diagnostic.completed":
        if (e.payload.test === "restart") h.restartTried = true;
        break;
      case "promise.created":
        h.promise = String(e.payload.dueAt);
        h.promiseFulfilled = false;
        break;
      case "promise.fulfilled":
        if (
          h.promise &&
          (e.payload.dueAt === h.promise ||
            e.payload.promiseTime ===
              new Date(h.promise).toLocaleTimeString("en-GB", {
                timeZone: "Europe/London",
                hour: "2-digit",
                minute: "2-digit",
              }))
        )
          h.promiseFulfilled = true;
        break;
      case "order.delivered":
        h.activation = "Delivered · activation unconfirmed";
        h.owner = "Activation team";
        h.caseStatus = "open";
        break;
      case "activation.confirmed":
        h.activation = "Activation confirmed";
        break;
      case "activation.first_use_observed":
        if (e.payload.successful === true) {
          h.firstUseObserved = true;
          h.activation = "Successful first use observed";
          h.serviceState = "First use observed";
          h.restored = true;
          h.caseStatus = "closed";
        }
        break;
      case "case.closed":
        h.caseStatus = "none"; h.owner = null;
        break;
      case "preference.stated":
        h.habit = String(e.payload.statement);
        break;
      case "router.heartbeat_overdue":
        h.serviceState = "Heartbeat overdue · cause unknown";
        h.restored = false; h.confirmed = false;
        gapOpen = true;
        break;
      case "router.heartbeat_received":
        h.serviceState = "Heartbeat observed";
        if (gapOpen) h.restored = true;
        gapOpen = false;
        break;
      case "router.setup_attempted":
        h.serviceState = "Hub switched on · not connected yet";
        break;
      case "incident.cleared":
        if (h.incident) {
          h.incidentCleared = true;
          // A line already observed working keeps that state; the clear is only news if not.
          if (!h.restored) h.serviceState = `${String(e.payload.incidentId)} cleared · own line not yet confirmed`;
        }
        break;
      case "incident.confirmed":
        h.incident =
          Array.isArray(e.payload.affected) &&
          e.payload.affected.includes(person.id);
        if (h.incident)
          h.serviceState = `Confirmed incident · ${String(e.payload.incidentId)}`;
        break;
      case "service.restored_observed":
        if (e.payload.lineTest === "passed") {
          h.restored = true;
          h.serviceState = "Restoration observed";
        }
        break;
      case "service.failure_observed":
        h.restored = false;
        h.confirmed = false;
        h.serviceState = "Fresh line test failed";
        break;
      case "customer.confirmed_working":
        h.confirmed = true;
        h.serviceState = "Working · confirmed by the customer";
        if (h.restored) h.caseStatus = "closed";
        break;
    }
  }
  return h;
}

export function projectOperations(
  events: SourceEvent[],
): Omit<Snapshot["operations"], "outcomes"> {
  const incident = events.filter((e) => e.type === "incident.confirmed").at(-1);
  const capacity = events
    .filter((e) => e.type === "capacity.recorded")
    .at(-1)?.payload;
  // Read the previous seed shape too, so existing local sessions remain usable.
  const slots =
    capacity && Array.isArray(capacity.slots)
      ? (capacity.slots as Snapshot["operations"]["slots"])
      : capacity
        ? [
            {
              time: "21:15",
              owner: String(capacity.owner),
              person: capacity.held as PersonId,
            },
            ...(capacity.available
              ? [
                  {
                    time: String(capacity.available),
                    owner: null,
                    person: null,
                  },
                ]
              : []),
          ]
        : [];
  return {
    incident: incident
      ? {
          id: String(incident.payload.incidentId),
          affected: Array.isArray(incident.payload.affected)
            ? incident.payload.affected.filter((id): id is PersonId =>
                people.some((p) => p.id === id),
              )
            : [],
          status: events.some((e) => e.type === "incident.cleared")
            ? "Cleared · each customer’s line confirmed separately"
            : "Open · service restoration tracked separately",
        }
      : null,
    slots,
  };
}

export class Engine {
  db: DatabaseSync;
  private processing = false;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,seed_version TEXT NOT NULL,step INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS customers(session_id TEXT NOT NULL REFERENCES sessions(id),id TEXT NOT NULL,name TEXT NOT NULL,PRIMARY KEY(session_id,id));
      CREATE TABLE IF NOT EXISTS services(session_id TEXT NOT NULL, id TEXT NOT NULL,customer_id TEXT NOT NULL,PRIMARY KEY(session_id,id),FOREIGN KEY(session_id,customer_id) REFERENCES customers(session_id,id));
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id),revision INTEGER NOT NULL,occurred_at TEXT NOT NULL,received_at TEXT NOT NULL,source TEXT NOT NULL,type TEXT NOT NULL,subject TEXT NOT NULL,description TEXT NOT NULL,payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_session_time ON events(session_id,revision,occurred_at,received_at);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id),revision INTEGER NOT NULL,step TEXT NOT NULL,idempotency_key TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,error TEXT,UNIQUE(session_id,idempotency_key));
      CREATE TABLE IF NOT EXISTS decisions(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,person TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,FOREIGN KEY(session_id,person) REFERENCES customers(session_id,id),UNIQUE(session_id,person,revision));
      CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,person TEXT NOT NULL,revision INTEGER NOT NULL,logical_key TEXT NOT NULL,decision_id TEXT NOT NULL REFERENCES decisions(id),data TEXT NOT NULL,FOREIGN KEY(session_id,person) REFERENCES customers(session_id,id),UNIQUE(session_id,person,logical_key));
      CREATE TABLE IF NOT EXISTS model_evaluations(job_id TEXT NOT NULL REFERENCES jobs(id),person TEXT NOT NULL,state TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(job_id,person));
      CREATE TABLE IF NOT EXISTS outcome_contracts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id),person TEXT NOT NULL,goal TEXT NOT NULL,scope_id TEXT NOT NULL,revision INTEGER NOT NULL,decision_id TEXT NOT NULL REFERENCES decisions(id),data TEXT NOT NULL,UNIQUE(session_id,person,goal,scope_id));
      CREATE TABLE IF NOT EXISTS outcome_checks(contract_id TEXT NOT NULL REFERENCES outcome_contracts(id),revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(contract_id,revision));
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,action_id TEXT NOT NULL UNIQUE REFERENCES actions(id),provenance TEXT NOT NULL CHECK(provenance='simulated_delivery'),created_at TEXT NOT NULL);
    `);
    // Existing sessions predate verification contracts. Reconstruction is insert-only and explicitly labelled.
    const revisions = this.db
      .prepare(
        "SELECT DISTINCT session_id,revision FROM decisions ORDER BY revision",
      )
      .all() as { session_id: string; revision: number }[];
    for (const r of revisions)
      this.transaction(() =>
        this.recordOutcomes(r.session_id, r.revision, true),
      );
  }
  recordOutcomes(id: string, revision: number, reconstructed = false) {
    const s = this.snapshot(id, revision);
    for (const d of s.decisions.filter((d) => d.revision === revision)) {
      const h = s.households.find((h) => h.id === d.person)!;
      for (const c of contractsFor(h, d, s, reconstructed))
        this.db
          .prepare(
            "INSERT OR IGNORE INTO outcome_contracts VALUES(?,?,?,?,?,?,?,?)",
          )
          .run(
            c.id,
            id,
            c.person,
            c.goal,
            c.scopeId,
            c.revision,
            c.decisionId,
            JSON.stringify(c),
          );
    }
    const contracts = this.db
      .prepare(
        "SELECT data FROM outcome_contracts WHERE session_id=? AND revision<=?",
      )
      .all(id, revision) as { data: string }[];
    for (const row of contracts) {
      const c = JSON.parse(row.data) as OutcomeContract;
      this.db
        .prepare("INSERT OR IGNORE INTO outcome_checks VALUES(?,?,?)")
        .run(c.id, revision, JSON.stringify(verifyOutcome(c, s)));
    }
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  session(id: string): Session {
    const row = this.db
      .prepare(
        "SELECT id,seed_version AS seedVersion,step,revision,created_at AS createdAt FROM sessions WHERE id=?",
      )
      .get(id) as Session | undefined;
    if (!row) throw new DomainError("Session not found", 404);
    return row;
  }
  append(sessionId: string, revision: number, e: EventInput) {
    const time = e.occurredAt ?? clocks[revision];
    this.db
      .prepare("INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        sessionId,
        revision,
        time,
        revision === 0 ? time : clocks[revision],
        e.source,
        e.type,
        e.subject,
        e.description,
        JSON.stringify(e.payload),
      );
  }
  createSession(): Session {
    return this.transaction(() => {
      const id = randomUUID();
      this.db
        .prepare(
          "INSERT INTO sessions(id,seed_version,created_at) VALUES(?,?,?)",
        )
        .run(id, "bt-three-routers-v3", new Date().toISOString());
      for (const p of people) {
        this.db
          .prepare("INSERT INTO customers VALUES(?,?,?)")
          .run(id, p.id, p.name);
        this.db
          .prepare("INSERT INTO services VALUES(?,?,?)")
          .run(id, `svc_${p.id}_broadband`, p.id);
      }
      for (const p of people)
        this.append(id, 0, {
          type: "contact.authority_recorded",
          subject: p.id,
          source: "identity_simulator",
          description:
            "Verified account holder. Service updates allowed in the demo app.",
          payload: {
            role: "account_holder",
            purpose: "service",
            channel: "in_app",
            allowed: true,
          },
          occurredAt: "2026-09-18T10:00:00Z",
        });
      const seeds: EventInput[] = [
        {
          type: "case.opened",
          subject: "daniel",
          source: "crm_simulator",
          description:
            "Two connection drops reported. Aisha owns case DR-2041.",
          payload: { owner: "Aisha", caseId: "DR-2041" },
          occurredAt: "2026-09-24T17:10:00Z",
        },
        {
          type: "diagnostic.completed",
          subject: "daniel",
          source: "diagnostics_simulator",
          description: "Restart attempted at 20:20. The issue persisted.",
          payload: { test: "restart", result: "not_resolved" },
          occurredAt: "2026-09-25T19:20:00Z",
        },
        {
          type: "promise.created",
          subject: "daniel",
          source: "crm_simulator",
          description: "Aisha promised a callback at 21:15.",
          payload: { owner: "Aisha", dueAt: "2026-09-25T20:15:00Z" },
          occurredAt: "2026-09-25T19:45:00Z",
        },
        {
          type: "order.delivered",
          subject: "sam",
          source: "order_simulator",
          description:
            "Hub delivered. Activation and first use are unconfirmed.",
          payload: { order: "ORD-SAM-31", activation: "unconfirmed" },
          occurredAt: "2026-09-22T12:00:00Z",
        },
        {
          type: "preference.stated",
          subject: "maya",
          source: "contact_note_simulator",
          description: "“We switch the hub off at night.”",
          payload: { statement: "Router switched off overnight" },
          occurredAt: "2026-09-18T14:00:00Z",
        },
        {
          type: "pattern.recorded",
          subject: "maya",
          source: "synthetic_history_summary",
          description:
            "26 observed overnight gaps were followed by recovery. Authored synthetic history summary.",
          payload: { sampleSize: 26, provenance: "authored_synthetic_summary" },
          occurredAt: "2026-09-25T08:00:00Z",
        },
        {
          type: "capacity.recorded",
          subject: "shared",
          source: "rota_simulator",
          description: "21:15 held for Aisha / Daniel; 21:30 available.",
          payload: {
            slots: [
              { time: "21:15", owner: "Aisha", person: "daniel" },
              { time: "21:30", owner: null, person: null },
            ],
          },
          occurredAt: "2026-09-25T19:45:00Z",
        },
      ];
      for (const e of seeds) this.append(id, 0, e);
      return this.session(id);
    });
  }
  advance(id: string, step: string, key: string, revision: number) {
    if (typeof key !== "string" || !key.trim() || key.length > 120)
      throw new DomainError("A bounded idempotency key is required");
    if (!steps.includes(step as Step))
      throw new DomainError("Unsupported scenario step");
    if (!Number.isInteger(revision) || revision < 0)
      throw new DomainError("Invalid revision");
    return this.transaction(() => {
      const session = this.session(id);
      const existing = this.db
        .prepare(
          "SELECT id,revision,step FROM jobs WHERE session_id=? AND idempotency_key=?",
        )
        .get(id, key) as
        | { id: string; revision: number; step: string }
        | undefined;
      if (existing) {
        if (existing.step !== step)
          throw new DomainError(
            "Idempotency key used for a different step",
            409,
          );
        return { jobId: existing.id, revision: existing.revision };
      }
      if (session.revision !== revision)
        throw new DomainError(
          "Stale session revision; refresh before advancing",
          409,
        );
      if (steps[session.step] !== step)
        throw new DomainError(
          "This is not the next event in the scenario order",
          409,
        );
      if (
        this.db
          .prepare(
            "SELECT id FROM jobs WHERE session_id=? AND state!='complete'",
          )
          .get(id)
      )
        throw new DomainError("The previous job is still pending", 409);
      const rev = revision + 1,
        inputs: EventInput[] = [];
      if (step === "heartbeat")
        for (const p of people)
          inputs.push(
            p.id === "sam"
              ? {
                  // A hub that has never been online cannot go quiet: Sam is switching it on.
                  type: "router.setup_attempted",
                  subject: p.id,
                  source: "router_simulator",
                  description: "Hub switched on for the first time. It has not connected to the network.",
                  payload: { firstPowerOn: true, lineSyncStatus: "no_sync" },
                  occurredAt: "2026-09-25T19:58:00Z",
                }
              : {
                  type: "router.heartbeat_overdue",
                  subject: p.id,
                  source: "router_simulator",
                  description:
                    "No heartbeat received in the expected window. Line state and cause remain unknown.",
                  payload: { overdueSeconds: 240, lineSyncStatus: "unknown" },
                },
          );
      if (step === "incident")
        inputs.push({
          type: "incident.confirmed",
          subject: "shared",
          source: "incident_simulator",
          description:
            "INC-017 confirmed. Affected-service register explicitly includes Daniel and Sam; Maya is outside scope.",
          payload: { incidentId: "INC-017", affected: ["daniel", "sam"] },
        });
      if (step === "restore")
        inputs.push(
          {
            type: "incident.cleared",
            subject: "shared",
            source: "incident_simulator",
            description:
              "INC-017 cleared: the network is restored across the affected area. Each customer’s own line is confirmed separately.",
            payload: { incidentId: "INC-017", affected: ["daniel", "sam"] },
          },
          {
            type: "service.restored_observed",
            subject: "daniel",
            source: "diagnostics_simulator",
            description:
              "Fresh line test observes service restoration. Callback and customer confirmation remain separate.",
            payload: { lineTest: "passed" },
          },
          {
            type: "router.heartbeat_received",
            subject: "maya",
            source: "router_simulator",
            description:
              "Heartbeat returned at 21:10. Quiet observation ends without a customer message.",
            payload: { status: "received" },
            occurredAt: "2026-09-25T20:10:00Z",
          },
        );
      if (step === "callback")
        inputs.push({
          type: "promise.fulfilled",
          subject: "daniel",
          source: "adviser_simulator",
          description: "Aisha completed the promised 21:15 callback.",
          payload: { owner: "Aisha", promiseTime: "21:15" },
        });
      if (step === "confirm")
        inputs.push({
          type: "customer.confirmed_working",
          subject: "daniel",
          source: "customer_phone_simulator",
          description: "Daniel confirms: “It’s working again, thank you.”",
          payload: { statement: "It’s working again, thank you." },
        });
      if (step === "confirm" && session.seedVersion === "bt-three-routers-v3")
        inputs.push({
          type: "activation.confirmed", subject: "sam", source: "provisioning_simulator",
          occurredAt: "2026-09-25T20:16:00Z",
          description: "Provisioning completed. Successful first use still requires a separate observation.", payload: {},
        }, {
          type: "activation.first_use_observed", subject: "sam", source: "router_simulator",
          occurredAt: "2026-09-25T20:17:00Z",
          description: "Successful authenticated broadband use observed for Sam’s service. This does not establish that outreach caused activation.",
          payload: { successful: true },
        });
      for (const e of inputs) this.append(id, rev, e);
      const jobId = randomUUID();
      this.db
        .prepare(
          "INSERT INTO jobs(id,session_id,revision,step,idempotency_key) VALUES(?,?,?,?,?)",
        )
        .run(jobId, id, rev, step, key);
      this.db
        .prepare("UPDATE sessions SET step=step+1,revision=? WHERE id=?")
        .run(rev, id);
      return { jobId, revision: rev };
    });
  }
  async processJobs(evaluate?: Evaluator) {
    if (this.processing) return;
    this.processing = true;
    // ponytail: one local worker. Provider calls stay outside SQLite transactions.
    // Durable attempt records prevent automatic rebilling after a crash; use leases for multiple workers.
    try {
      const ids = this.db
        .prepare(
          "SELECT id FROM jobs WHERE state IN ('pending','failed') AND attempts<3 ORDER BY rowid LIMIT 12",
        )
        .all() as { id: string }[];
      for (const { id } of ids) {
        try {
          const job = this.db
            .prepare("SELECT * FROM jobs WHERE id=? AND state!='complete'")
            .get(id) as
            | { id: string; session_id: string; revision: number }
            | undefined;
          if (!job) continue;
          this.transaction(() =>
            this.recordOutcomes(job.session_id, job.revision),
          );
          const snapshot = this.snapshot(job.session_id, job.revision);
          const before = this.snapshot(job.session_id, job.revision - 1);
          const prepared: Decision[] = [];
          const modeledJob =
            !!evaluate ||
            !!this.db
              .prepare("SELECT 1 FROM model_evaluations WHERE job_id=? LIMIT 1")
              .get(job.id);
          for (const h of snapshot.households) {
            if (
              snapshot.decisions.some(
                (d) => d.person === h.id && d.revision === job.revision,
              )
            )
              continue;
            let d = arbitrate(
              h,
              before.households.find((p) => p.id === h.id)!,
              snapshot,
            );
            if (modeledJob) {
              const request = buildAssessmentRequest(h, snapshot, d);
              const saved = this.db
                .prepare(
                  "SELECT data FROM model_evaluations WHERE job_id=? AND person=?",
                )
                .get(job.id, h.id) as { data: string } | undefined;
              let assessment = saved
                ? JSON.parse(saved.data)
                : emptyAssessment(request);
              if (!saved) {
                this.db
                  .prepare("INSERT INTO model_evaluations VALUES(?,?,?,?)")
                  .run(job.id, h.id, "started", JSON.stringify(assessment));
                try {
                  if (evaluate) assessment = await evaluate(request);
                  else {
                    assessment.status = "error";
                    assessment.error =
                      "Model key unavailable while recovering this job. New actions remain held.";
                  }
                } catch {
                  assessment.error =
                    "Provider attempt failed without a usable result. No automatic retry.";
                }
                this.db
                  .prepare(
                    "UPDATE model_evaluations SET state='recorded',data=? WHERE job_id=? AND person=?",
                  )
                  .run(JSON.stringify(assessment), job.id, h.id);
              }
              d = applyAssessment(d, assessment);
            }
            prepared.push(d);
          }
          this.transaction(() => {
            for (const d of prepared) {
              const h = snapshot.households.find((p) => p.id === d.person)!;
              this.db
                .prepare("INSERT OR IGNORE INTO decisions VALUES(?,?,?,?,?)")
                .run(
                  d.id,
                  job.session_id,
                  h.id,
                  job.revision,
                  JSON.stringify(d),
                );
              const proposed = serviceMessage(h, d);
              const priorAction = proposed
                ? (this.db
                    .prepare(
                      "SELECT id FROM actions WHERE session_id=? AND person=? AND logical_key=?",
                    )
                    .get(job.session_id, h.id, proposed.key) as
                    | { id: string }
                    | undefined)
                : undefined;
              d.trace!.execution.push(
                {
                  stage: "Context read",
                  status: "passed",
                  detail: `Revision ${job.revision}; occurred and received timestamps bounded by ${clocks[job.revision]}.`,
                },
                {
                  stage: "Policy evaluated",
                  status: "passed",
                  detail: d.trace!.assessment
                    ? d.trace!.assessment.resolution!
                    : `${d.trace!.candidates.length} proposals; hard eligibility gates applied before priority ranking.`,
                },
                {
                  stage: "Contact authority",
                  status: h.contactAllowed ? "passed" : "held",
                  detail: h.contactAllowed
                    ? "Service / in-app authority verified from the source record."
                    : "No permitted service contact; outbound action withheld.",
                },
              );
              if (d.trace!.assessment)
                d.trace!.execution.splice(1, 0, {
                  stage: "Jev evaluation",
                  status:
                    d.trace!.assessment.status === "ok" ? "passed" : "held",
                  detail: `${d.trace!.assessment.model} · ${d.trace!.assessment.latencyMs}ms · ${d.trace!.assessment.status}. ${d.trace!.assessment.error || "Typed answers recorded; policy gates enforced."}`,
                });
              if (!proposed)
                d.trace!.execution.push({
                  stage: "Channel held",
                  status: "held",
                  detail: h.contactAllowed
                    ? d.trace!.assessment?.effective === "policy_hold"
                      ? d.trace!.assessment.resolution!
                      : "Internal observation only; no customer message proposed."
                    : "No message committed without contact authority.",
                });
              else if (priorAction)
                d.trace!.execution.push({
                  stage: "Duplicate prevented",
                  status: "deduplicated",
                  detail: `Logical action ${proposed.key} already exists in this session.`,
                  actionId: priorAction.id,
                });
              if (proposed && h.contactAllowed && !priorAction) {
                const actionId = randomUUID(),
                  receiptId = randomUUID();
                const action: DemoAction = {
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
                };
                d.trace!.execution.push(
                  {
                    stage: "Action committed",
                    status: "committed",
                    detail:
                      "Decision and in-app action committed in one SQLite transaction.",
                    actionId,
                  },
                  {
                    stage: "Demo delivery",
                    status: "committed",
                    detail:
                      "Simulated in-app delivery receipt; no external send.",
                    actionId,
                    receiptId,
                  },
                );
                this.db
                  .prepare("INSERT INTO actions VALUES(?,?,?,?,?,?,?)")
                  .run(
                    actionId,
                    job.session_id,
                    h.id,
                    job.revision,
                    proposed.key,
                    d.id,
                    JSON.stringify(action),
                  );
                this.db
                  .prepare("INSERT INTO receipts VALUES(?,?,?,?)")
                  .run(
                    receiptId,
                    actionId,
                    "simulated_delivery",
                    new Date().toISOString(),
                  );
              }
              this.db
                .prepare("UPDATE decisions SET data=? WHERE id=?")
                .run(JSON.stringify(d), d.id);
            }
            this.recordOutcomes(job.session_id, job.revision);
            this.db
              .prepare(
                "UPDATE jobs SET state='complete',attempts=attempts+1,error=NULL WHERE id=?",
              )
              .run(id);
          });
        } catch (error) {
          this.db
            .prepare(
              "UPDATE jobs SET state='failed',attempts=attempts+1,error=? WHERE id=?",
            )
            .run(error instanceof Error ? error.message : "Worker failure", id);
        }
      }
    } finally {
      this.processing = false;
    }
  }
  snapshot(id: string, cutoff?: number): Snapshot {
    const session = this.session(id),
      at = cutoff ?? session.revision;
    if (!Number.isInteger(at) || at < 0 || at > session.revision)
      throw new DomainError("Invalid historical cutoff");
    const clock = clocks[at];
    const events = (
      this.db
        .prepare(
          "SELECT id,session_id AS sessionId,revision,occurred_at AS occurredAt,received_at AS receivedAt,source,type,subject,description,payload FROM events WHERE session_id=? AND revision<=? AND occurred_at<=? AND received_at<=? ORDER BY occurred_at,rowid",
        )
        .all(id, at, clock, clock) as unknown as (Omit<
        SourceEvent,
        "payload"
      > & { payload: string })[]
    ).map((e) => ({ ...e, payload: JSON.parse(e.payload) }));
    const customers = this.db
      .prepare(
        "SELECT id,name FROM customers WHERE session_id=? ORDER BY rowid",
      )
      .all(id) as { id: PersonId; name: string }[];
    const households = customers.map((p) => project(p, events));
    const decisions = (
      this.db
        .prepare(
          "SELECT data FROM decisions WHERE session_id=? AND revision<=? ORDER BY revision,rowid",
        )
        .all(id, at) as { data: string }[]
    ).map((r) => JSON.parse(r.data) as Decision);
    const actions = (
      this.db
        .prepare(
          "SELECT data FROM actions WHERE session_id=? AND revision<=? ORDER BY revision,rowid",
        )
        .all(id, at) as { data: string }[]
    ).map((r) => JSON.parse(r.data) as DemoAction);
    return {
      session,
      cutoff: at,
      historical: at < session.revision,
      clock,
      pendingJobs: Number(
        this.db
          .prepare(
            "SELECT count(*) AS n FROM jobs WHERE session_id=? AND revision<=? AND state='pending'",
          )
          .get(id, at)?.n ?? 0,
      ),
      failedJobs: Number(
        this.db
          .prepare(
            "SELECT count(*) AS n FROM jobs WHERE session_id=? AND revision<=? AND state='failed'",
          )
          .get(id, at)?.n ?? 0,
      ),
      households,
      events,
      decisions,
      actions,
      operations: {
        ...projectOperations(events),
        outcomes: (
          this.db
            .prepare(
              `SELECT c.data AS contract, k.data AS verification FROM outcome_contracts c JOIN outcome_checks k ON k.contract_id=c.id
          WHERE c.session_id=? AND c.revision<=? AND k.revision=(SELECT MAX(revision) FROM outcome_checks WHERE contract_id=c.id AND revision<=?) ORDER BY c.revision,c.rowid`,
            )
            .all(id, at, at) as { contract: string; verification: string }[]
        ).map((row) => ({
          ...(JSON.parse(row.contract) as OutcomeContract),
          check: JSON.parse(row.verification) as OutcomeCheck,
        })),
      },
      nextStep: at < session.revision ? null : (steps[session.step] ?? null),
    };
  }
  close() {
    this.db.close();
  }
}
