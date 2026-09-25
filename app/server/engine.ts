import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type {
  Snapshot,
  SourceEvent,
  Household,
  Decision,
  DemoAction,
  PersonId,
  Step,
} from "../src/types.ts";

const steps: Step[] = [
  "heartbeat",
  "incident",
  "restore",
  "callback",
  "confirm",
];
const clocks = [
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

function project(
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
    habit: null,
    restartTried: false,
    restored: false,
    confirmed: false,
    incident: false,
    contactAllowed: false,
    evidence,
  };
  for (const e of evidence) {
    switch (e.type) {
      case "contact.authority_recorded":
        h.contactAllowed =
          e.payload.allowed === true && e.payload.purpose === "service";
        break;
      case "case.opened":
        h.caseStatus = "open";
        h.owner = String(e.payload.owner);
        h.serviceState = "Repeated drops reported";
        break;
      case "diagnostic.completed":
        h.restartTried = true;
        break;
      case "promise.created":
        h.promise = String(e.payload.dueAt);
        break;
      case "promise.fulfilled":
        h.promiseFulfilled = true;
        break;
      case "order.delivered":
        h.activation = "Delivered · activation unconfirmed";
        h.owner = "Activation team";
        h.caseStatus = "open";
        break;
      case "preference.stated":
        h.habit = String(e.payload.statement);
        break;
      case "router.heartbeat_overdue":
        h.serviceState = "Heartbeat overdue · cause unknown";
        break;
      case "router.heartbeat_received":
        h.serviceState = "Heartbeat observed";
        h.restored = true;
        break;
      case "incident.confirmed":
        h.incident = (e.payload.affected as string[]).includes(person.id);
        if (h.incident) h.serviceState = "Confirmed incident · INC-017";
        break;
      case "service.restored_observed":
        h.restored = true;
        h.serviceState = "Restoration observed";
        break;
      case "customer.confirmed_working":
        h.confirmed = true;
        h.caseStatus = "closed";
        break;
    }
  }
  return h;
}
function assess(h: Household, revision: number, time: string): Decision {
  const base = {
    id: randomUUID(),
    person: h.id,
    revision,
    time,
    evidenceIds: h.evidence.map((e) => e.id),
    policyVersion: "bt-context-v1.1",
    held: [
      {
        title: "Repeat hub restart",
        reason: h.restartTried
          ? "Earlier restart did not resolve the issue."
          : "The current evidence does not justify this instruction.",
        wake: "A fresh diagnostic establishes a useful local test.",
      },
      {
        title: "New product offer",
        reason: "No product mandate from this service signal.",
        wake: "Service obligations clear and relevant stated intent is recorded.",
      },
    ],
  };
  if (h.confirmed)
    return {
      ...base,
      domain: "recovery",
      disposition: "complete",
      title: "Recovery confirmed",
      reason:
        "Daniel confirmed the connection works. The kept callback and diagnostic history remain in memory.",
    };
  if (h.id === "maya")
    return {
      ...base,
      domain: "observation",
      disposition: h.restored ? "suppress" : "watch",
      title: h.restored ? "Quiet watch completed" : "Watch until 21:10",
      reason: h.restored
        ? "A fresh heartbeat ended the watch. No customer interruption was needed."
        : `The missing heartbeat matches the stated overnight habit. No open case or promise. ${h.evidence.some((e) => e.type === "incident.confirmed") ? "This service is outside INC-017." : "No incident membership is established."}`,
    };
  if (h.restored)
    return {
      ...base,
      domain: "recovery",
      disposition: h.promiseFulfilled ? "investigate" : "merge",
      title: h.promiseFulfilled
        ? "Await customer confirmation"
        : "Keep the 21:15 callback",
      reason: h.promiseFulfilled
        ? "Aisha completed the callback. Technical restoration and customer confirmation remain separate observations."
        : "The line recovered, but Aisha still owes the promised call. Restoration cannot fulfil that obligation.",
    };
  if (h.incident)
    return {
      ...base,
      domain: "network",
      disposition: "merge",
      title: "Coordinate the shared incident",
      reason:
        h.id === "daniel"
          ? "INC-017 explicitly includes this service. Link the existing case; retain Aisha and the 21:15 callback."
          : "INC-017 explicitly includes this service. Coordinate the activation investigation without assuming delivery proves first use.",
    };
  return h.id === "daniel"
    ? {
        ...base,
        domain: "recovery",
        disposition: "investigate",
        title: "Continue the recovery plan",
        reason:
          "Restart already tried. Keep the existing case, Aisha and the 21:15 callback together.",
      }
    : {
        ...base,
        domain: "activation",
        disposition: "investigate",
        title: "Check activation status",
        reason:
          "Equipment is delivered. Activation and first use are unconfirmed. Check provisioning before setup advice.",
      };
}
function message(
  h: Household,
  d: Decision,
): { key: string; title: string; body: string } | null {
  if (h.id === "maya" || !h.contactAllowed) return null;
  if (h.confirmed)
    return {
      key: "confirmed",
      title: "Thanks for confirming, Daniel",
      body: "Your connection is working again and your case is now closed. Your history is here if you need us.",
    };
  if (h.restored)
    return {
      key: "restored",
      title: "Your connection is back",
      body: "We can see your line has recovered. Aisha will still call at 21:15, as promised.",
    };
  if (h.incident)
    return {
      key: "incident",
      title: "We’ve linked this to a network issue",
      body:
        h.id === "daniel"
          ? "A confirmed network issue affects your service. Aisha is still looking after your case and will call at 21:15. There’s no need to restart your hub again."
          : "A confirmed network issue affects your service. Your activation team is checking it alongside your order. We’ll keep your case updated.",
    };
  return h.id === "daniel"
    ? {
        key: "recovery",
        title: "We’re keeping track of this",
        body: "We have your earlier checks, Daniel. Aisha is still looking after your case and will call at 21:15. You won’t need to start again.",
      }
    : {
        key: "activation",
        title: "Let’s get your connection started",
        body: "Your hub has arrived. We’re checking your activation before asking you to try any setup steps. Your activation team has the case.",
      };
}

export class Engine {
  db: DatabaseSync;
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
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,action_id TEXT NOT NULL UNIQUE REFERENCES actions(id),provenance TEXT NOT NULL CHECK(provenance='simulated_delivery'),created_at TEXT NOT NULL);
    `);
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
        .run(id, "bt-three-routers-v2", new Date().toISOString());
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
          payload: { held: "daniel", owner: "Aisha", available: "21:30" },
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
          inputs.push({
            type: "router.heartbeat_overdue",
            subject: p.id,
            source: "router_simulator",
            description:
              "No heartbeat received in the expected window. Line state and cause remain unknown.",
            payload: { overdueSeconds: 240, lineSyncStatus: "unknown" },
          });
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
  processJobs() {
    // ponytail: one synchronous local worker, SQLite transaction is the crash/claim boundary.
    // Move to leased Postgres jobs before a hosted multi-worker deployment.
    const ids = this.db
      .prepare(
        "SELECT id FROM jobs WHERE state IN ('pending','failed') AND attempts<3 ORDER BY rowid LIMIT 12",
      )
      .all() as { id: string }[];
    for (const { id } of ids) {
      try {
        this.transaction(() => {
          const job = this.db
            .prepare("SELECT * FROM jobs WHERE id=? AND state!='complete'")
            .get(id) as
            | { id: string; session_id: string; revision: number }
            | undefined;
          if (!job) return;
          const snapshot = this.snapshot(job.session_id, job.revision);
          for (const h of snapshot.households) {
            const d = assess(h, job.revision, clocks[job.revision]);
            this.db
              .prepare("INSERT OR IGNORE INTO decisions VALUES(?,?,?,?,?)")
              .run(d.id, job.session_id, h.id, job.revision, JSON.stringify(d));
            const proposed = message(h, d);
            if (
              proposed &&
              h.contactAllowed &&
              !this.db
                .prepare(
                  "SELECT id FROM actions WHERE session_id=? AND person=? AND logical_key=?",
                )
                .get(job.session_id, h.id, proposed.key)
            ) {
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
          }
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
            "SELECT count(*) AS n FROM jobs WHERE session_id=? AND state='pending'",
          )
          .get(id)?.n ?? 0,
      ),
      failedJobs: Number(
        this.db
          .prepare(
            "SELECT count(*) AS n FROM jobs WHERE session_id=? AND state='failed'",
          )
          .get(id)?.n ?? 0,
      ),
      households,
      events,
      decisions,
      actions,
      operations: {
        incident: events.some((e) => e.type === "incident.confirmed")
          ? {
              id: "INC-017",
              affected: ["daniel", "sam"],
              status: "Open · service restoration tracked separately",
            }
          : null,
        slots: [
          { time: "21:15", owner: "Aisha", person: "daniel" },
          { time: "21:30", owner: null, person: null },
        ],
      },
      nextStep: at < session.revision ? null : (steps[session.step] ?? null),
    };
  }
  close() {
    this.db.close();
  }
}
