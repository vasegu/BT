import { randomUUID } from "node:crypto";
import type {
  Decision,
  Household,
  OutcomeContract,
  OutcomeCheck,
  OutcomeGoal,
  Snapshot,
  SourceEvent,
} from "../src/types.ts";
const minutes = (iso: string, n: number) =>
  new Date(Date.parse(iso) + n * 60_000).toISOString().replace(".000Z", "Z");
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });

// Named proof obligations, not estimated causal effects or learned success probabilities.
export function contractsFor(
  h: Household,
  d: Decision,
  s: Snapshot,
  reconstructed: boolean,
): OutcomeContract[] {
  const personal = h.evidence.filter((e) => e.subject === h.id);
  const latest = (type: string) =>
    personal.filter((e) => e.type === type).at(-1);
  const selected = d.trace?.selectedId;
  if (!selected || selected === "defer") return [];
  const action = s.actions.find((a) => a.decisionId === d.id);
  const definitions: {
    goal: OutcomeGoal;
    anchor: SourceEvent | undefined;
    title: string;
    baseline: string;
    target: string;
    expectedEvent: string;
    dueAt: string;
    deadlineBasis: string;
    attribution: string;
  }[] = [];
  const verificationWindow = minutes(d.time, 30);
  if (h.caseStatus === "open" && !h.activation.includes("unconfirmed")) {
    if (!h.restored)
      definitions.push({
        goal: "service",
        anchor: latest("case.opened"),
        title: "Working connection",
        baseline: "Connection drops reported",
        target: "Fresh line test passes for this service",
        expectedEvent: "service.restored_observed",
        dueAt: verificationWindow,
        deadlineBasis: "Demo policy: verify within 30 min; not a repair ETA",
        attribution:
          "A later line test establishes recovery. The update did not repair the network.",
      });
    if (!h.confirmed)
      definitions.push({
        goal: "confirmation",
        anchor: latest("case.opened"),
        title: "Customer confirms recovery",
        baseline: "Customer outcome unconfirmed",
        target: "The customer explicitly confirms working service",
        expectedEvent: "customer.confirmed_working",
        dueAt: verificationWindow,
        deadlineBasis: "Demo policy: check customer outcome within 30 min",
        attribution:
          "An explicit reply establishes the reported experience, not satisfaction or churn reduction.",
      });
  }
  if (h.promise && !h.promiseFulfilled)
    definitions.push({
      goal: "callback",
      anchor: latest("promise.created"),
      title: "Keep the callback",
      baseline: "Named callback outstanding",
      target: `The existing callback is fulfilled by ${hhmm(h.promise)}`,
      expectedEvent: "promise.fulfilled",
      dueAt: h.promise,
      deadlineBasis: "Deadline from the existing customer promise",
      attribution:
        "The adviser’s completion record proves follow-through. The arbiter preserves the commitment; it does not make the call.",
    });
  if (h.activation.includes("unconfirmed"))
    definitions.push({
      goal: "activation",
      anchor: latest("order.delivered"),
      title: "Successful first use",
      baseline: "Hub delivered; first use unknown",
      target: "Successful first use is observed for this service",
      expectedEvent: "activation.first_use_observed",
      dueAt: verificationWindow,
      deadlineBasis: "Demo policy: review the first-use gap within 30 min",
      attribution:
        "Delivery and outreach are not activation. No conversion or revenue is attributed without a successful first-use record.",
    });
  if (
    selected === "watch" &&
    h.habit &&
    !h.restored &&
    !h.incident &&
    h.caseStatus === "none"
  )
    definitions.push({
      goal: "watch",
      anchor: latest("router.heartbeat_overdue"),
      title: "Quiet watch resolves",
      baseline: "Missing heartbeat; routine may explain it",
      target: "Heartbeat returns within the observation window",
      expectedEvent: "router.heartbeat_received",
      dueAt: minutes(d.time, 10),
      deadlineBasis: "Demo watch policy: 10 min, then reassess missing proof",
      attribution:
        "Returning telemetry supports ending this watch. Zero messages is observable; avoided calls and satisfaction are not measured.",
    });
  return definitions
    .filter((x) => x.anchor)
    .map(({ anchor, ...x }) => ({
      ...x,
      id: randomUUID(),
      person: h.id,
      scopeId: anchor!.id,
      decisionId: d.id,
      actionId: action?.id || null,
      revision: d.revision,
      createdAt: d.time,
      evidenceIds: [...new Set([anchor!.id, ...d.evidenceIds])],
      provenance: reconstructed ? "reconstructed" : "committed",
      version: "bt-outcomes-v1",
    }));
}

export function verifyOutcome(
  c: OutcomeContract,
  s: Pick<Snapshot, "events" | "clock" | "cutoff">,
): OutcomeCheck {
  // Both clocks matter: a late-arriving record is not known before receipt.
  const fresh = s.events.filter(
    (e) =>
      e.revision <= s.cutoff &&
      Date.parse(e.occurredAt) >= Date.parse(c.createdAt) &&
      Date.parse(e.occurredAt) <= Date.parse(s.clock) &&
      Date.parse(e.receivedAt) <= Date.parse(s.clock),
  );
  const anchor = s.events.find((e) => e.id === c.scopeId);
  const own = fresh.filter(
    (e) =>
      e.subject === c.person &&
      (!anchor?.serviceId || e.serviceId === anchor.serviceId),
  );
  const matches = (e: SourceEvent) =>
    e.type === c.expectedEvent &&
    (c.goal === "service"
      ? e.payload.lineTest === "passed"
      : c.goal === "callback"
        ? e.payload.dueAt === c.dueAt || e.payload.promiseTime === hhmm(c.dueAt)
        : c.goal === "activation"
          ? e.payload.successful === true
          : c.goal === "watch"
            ? e.payload.status === undefined || e.payload.status === "received"
            : typeof e.payload.statement === "string" &&
              !!e.payload.statement.trim());
  // A fresh case or replacement promise breaks the old scope: it cannot fulfil it.
  const replacement = own.find(
    (e) =>
      e.id !== c.scopeId &&
      (c.goal === "callback"
        ? e.type === "promise.created"
        : c.goal === "service" || c.goal === "confirmation"
          ? e.type === "case.opened"
          : c.goal === "activation"
            ? e.type === "order.delivered"
            : e.type === "router.heartbeat_overdue"),
  );
  const inScope = (e: SourceEvent) =>
    !replacement ||
    Date.parse(e.occurredAt) < Date.parse(replacement.occurredAt);
  const positive = own.filter((e) => matches(e) && inScope(e)).at(-1);
  const negative = fresh
    .filter(
      (e) =>
        inScope(e) &&
        (e.subject === c.person &&
        (!anchor?.serviceId || e.serviceId === anchor.serviceId)
          ? c.goal === "service"
            ? e.type === "service.failure_observed"
            : c.goal === "callback"
              ? e.type === "promise.missed" &&
                (e.payload.dueAt === c.dueAt ||
                  e.payload.promiseTime === hhmm(c.dueAt))
              : c.goal === "confirmation"
                ? e.type === "customer.reported_problem"
                : c.goal === "activation"
                  ? e.type === "activation.failed"
                  : e.type === "case.opened"
          : c.goal === "watch" &&
            e.subject === "shared" &&
            e.type === "incident.confirmed" &&
            (!anchor?.serviceId ||
              e.affectedServiceIds?.includes(anchor.serviceId)) &&
            Array.isArray(e.payload.affected) &&
            e.payload.affected.includes(c.person)),
    )
    .at(-1);
  const observation =
    positive &&
    (!negative ||
      Date.parse(positive.occurredAt) > Date.parse(negative.occurredAt))
      ? positive
      : negative || replacement;
  const met = !!observation && observation === positive;
  const due = Date.parse(s.clock) >= Date.parse(c.dueAt);
  const status = observation
    ? met
      ? "met"
      : "contradicted"
    : due
      ? "unverified"
      : "waiting";
  const next: Record<OutcomeGoal, string> = {
    service:
      "Retain the recovery observation; still check the promise and the customer’s own confirmation.",
    callback:
      "Retain the fulfilled promise. Do not schedule a duplicate callback for this commitment.",
    confirmation:
      "Retain this confirmed recovery episode. A new fault must open a fresh assessment.",
    activation:
      "Record successful first use. Do not send setup advice for an already completed activation.",
    watch:
      "End this watch without contact. Recheck fresh incident scope and complaints before using the habit again.",
  };
  return {
    revision: s.cutoff,
    checkedAt: s.clock,
    status,
    observedAt: observation?.occurredAt || null,
    onTime: met
      ? Date.parse(observation!.occurredAt) <= Date.parse(c.dueAt)
      : null,
    evidenceIds: observation ? [observation.id] : [],
    finding: met
      ? observation!.description
      : observation
        ? `Contrary or replacement evidence: ${observation.description}`
        : due
          ? "Verification window reached without the required observation. The outcome is unknown."
          : "Waiting for the required observation. Delivery alone does not establish the outcome.",
    nextDecision: met
      ? next[c.goal]
      : observation
        ? "Reassess this plan using the fresh evidence; do not reuse the earlier expectation as a success."
        : due
          ? "The verification is due. Reassess or obtain fresh evidence; retain ownership and outstanding commitments."
          : `Keep this proof obligation open until ${hhmm(c.dueAt)} or a qualifying observation.`,
  };
}
