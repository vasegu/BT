import type { HouseholdFixture, Row } from "./data-model.ts";
import type { Household, PersonId, SourceEvent } from "../src/types.ts";
import { project, projectOperations, clocks } from "./engine.ts";
import {
  availableEvents,
  deriveMemories,
  hash,
  type MemoryItem,
} from "./memory.ts";
export type ContextBundle = {
  sessionId: string;
  personId: string;
  serviceId: string;
  cutoff: string;
  purpose: "service";
  household: Household;
  operations: ReturnType<typeof projectOperations>;
  memories: MemoryItem[];
  evidence: SourceEvent[];
  hash: string;
  retrieval: {
    admitted: string[];
    rejected: { id: string; reason: string }[];
    method: string;
  };
};
export function buildContext(input: {
  fixture: HouseholdFixture;
  sessionId: string;
  personId: string;
  serviceId: string;
  cutoff: string;
  purpose: "service";
}): ContextBundle {
  const { fixture, sessionId, personId, serviceId, cutoff, purpose } = input;
  const effective = (row: Row) =>
    Date.parse(String(row.valid_from)) <= Date.parse(cutoff) &&
    (row.valid_to === null ||
      Date.parse(String(row.valid_to)) > Date.parse(cutoff));
  const service = fixture.tables["customer.services"]?.find(
    (s) => s.id === serviceId,
  );
  const person = fixture.tables["customer.people"]?.find(
    (p) => p.id === personId,
  );
  if (
    !service ||
    !person ||
    !fixture.tables["customer.account_roles"]?.some(
      (r) =>
        r.person_id === personId &&
        r.account_id === service.account_id &&
        effective(r),
    )
  )
    throw new Error("Account authority is required for this service");
  const alias = String(person.alias) as PersonId;
  const available = availableEvents(fixture.events, cutoff);
  const knownIds = new Set(available.map((e) => e.id));
  const observedIds = new Set(
    fixture.events
      .filter(
        (e) =>
          Date.parse(e.occurredAt) <= Date.parse(cutoff) &&
          Date.parse(e.knownAt) <= Date.parse(cutoff),
      )
      .map((e) => e.id),
  );
  // Interval ends caused by a not-yet-known replacement cannot alter past state.
  const effectiveKnown = (row: Row, peers: Row[]) =>
    effective(row) ||
    (Date.parse(String(row.valid_from)) <= Date.parse(cutoff) &&
      row.valid_to !== null &&
      peers.some(
        (next) =>
          next.valid_from === row.valid_to &&
          !observedIds.has(String(next.source_event_id)),
      ));
  const scoped = available.filter(
    (e) =>
      (e.personId === personId && e.serviceId === serviceId) ||
      (!e.personId &&
        !e.serviceId &&
        ["incident.confirmed", "incident.cleared", "capacity.recorded"].includes(e.type)),
  );
  const cases = scoped.filter((e) => e.type === "case.opened");
  const currentCase = cases.at(-1)?.caseId;
  // Facts use current episodes. Historic router returns cannot resolve a new gap.
  const current = scoped.filter((e) => {
    if (
      e.type === "router.observation_window" ||
      e.type === "router.overnight_window"
    )
      return false;
    if (e.type.startsWith("router."))
      return (
        Date.parse(e.occurredAt) >=
        Date.parse(fixture.scenarioStart.slice(0, 10) + "T00:00:00Z")
      );
    if (e.caseId && e.caseId !== currentCase) return false;
    return e.type !== "conversation.message" && e.type !== "interest.stated";
  });
  const sources = new Map(
    fixture.tables["ingestion.sources"].map((s) => [s.id, s.name]),
  );
  const normal = (date: string) =>
    new Date(date).toISOString().replace(".000Z", "Z");
  const evidence: SourceEvent[] = current.map((e) => ({
    id: e.id,
    sessionId,
    serviceId: e.serviceId,
    revision: Math.max(
      0,
      clocks.findIndex(
        (t) =>
          Date.parse(t) >=
          Math.max(Date.parse(e.occurredAt), Date.parse(e.knownAt)),
      ),
    ),
    occurredAt: normal(e.occurredAt),
    receivedAt: normal(e.knownAt),
    source: String(sources.get(e.source)),
    type: e.type,
    subject: e.personId ? alias : "shared",
    description: e.description,
    payload: e.payload,
  }));
  for (let i = evidence.length - 1; i >= 0; i--) {
    const e = evidence[i];
    if (e.type !== "incident.confirmed") continue;
    const incident = fixture.tables["operations.incidents"].find(
      (r) => r.reference === e.payload.incidentId,
    );
    const peers = fixture.tables["operations.incident_services"].filter(
      (r) => r.incident_id === incident?.id && r.service_id === serviceId,
    );
    const membership = peers
      .filter(
        (r) =>
          observedIds.has(String(r.source_event_id)) &&
          effectiveKnown(r, peers),
      )
      .sort(
        (a, b) =>
          Date.parse(String(a.valid_from)) - Date.parse(String(b.valid_from)),
      )
      .at(-1);
    if (!membership) {
      evidence.splice(i, 1);
      continue;
    }
    const affected = Array.isArray(e.payload.affected)
      ? e.payload.affected.filter((id) => id !== alias)
      : [];
    if (membership.membership === "affected") affected.push(alias);
    e.payload = { ...e.payload, affected };
  }
  // A cleared incident only concerns services that were inside it.
  for (let i = evidence.length - 1; i >= 0; i--) {
    const e = evidence[i];
    if (e.type !== "incident.cleared") continue;
    const inside = evidence.some(
      (x) => x.type === "incident.confirmed" && x.payload.incidentId === e.payload.incidentId && Array.isArray(x.payload.affected) && x.payload.affected.includes(alias),
    );
    if (!inside) evidence.splice(i, 1);
  }
  const household = project({ id: alias, name: String(person.name) }, evidence);
  household.linkedServices = fixture.tables["customer.services"]
    .filter(
      (s) =>
        s.account_id === service.account_id &&
        available.some((e) => e.serviceId === s.id),
    )
    .map((s) => ({
      reference: String(s.reference),
      product: String(
        fixture.tables["operations.products"].find((p) => p.id === s.product_id)
          ?.name,
      ),
      state: available.some(
        (e) => e.serviceId === s.id && e.type === "activation.confirmed",
      )
        ? "Activation recorded"
        : "Activation unconfirmed",
      // Latest activity on the other product within the past two hours, if any.
      recent: (() => {
        const e = available
          .filter(
            (x) =>
              x.serviceId === s.id &&
              x.type === "mobile.activity_observed" &&
              Date.parse(cutoff) - Date.parse(x.occurredAt) <= 2 * 3600e3,
          )
          .at(-1);
        return e ? { id: e.id, at: e.occurredAt, description: e.description } : undefined;
      })(),
    }));
  if (!currentCase && household.activation === "Activation confirmed") {
    household.caseStatus = "none";
    household.owner = null;
  }
  const permissions = fixture.tables["customer.contact_permissions"].filter(
    (p) =>
      p.person_id === personId &&
      p.account_id === service.account_id &&
      p.purpose === purpose &&
      p.channel === "in_app",
  );
  const permission = permissions
    .filter(
      (p) =>
        observedIds.has(String(p.source_event_id)) &&
        effectiveKnown(p, permissions),
    )
    .sort(
      (a, b) =>
        Date.parse(String(a.valid_from)) - Date.parse(String(b.valid_from)),
    )
    .at(-1);
  household.contactAllowed = permission?.allowed === true;
  const failure = evidence
    .filter((e) => e.type === "service.failure_observed")
    .at(-1);
  const recovery = evidence
    .filter((e) => e.type === "service.restored_observed")
    .at(-1);
  if (
    failure &&
    (!recovery ||
      Date.parse(failure.occurredAt) > Date.parse(recovery.occurredAt))
  ) {
    household.restored = false;
    household.caseStatus = "open";
    household.serviceState = "Fresh line test failed · customer reply differs";
  }
  const memories = deriveMemories({
    sessionId,
    personId,
    serviceId,
    cutoff,
    events: scoped,
  });
  const retrieval = {
    admitted: memories.map((m) => m.id),
    rejected: fixture.events
      .filter(
        (e) =>
          e.personId === personId &&
          observedIds.has(e.id) &&
          !knownIds.has(e.id),
      )
      .map((e) => ({ id: e.id, reason: "Not yet available or superseded" })),
    method:
      "Authority, service and both timestamps filtered; structured memory. Semantic ranking recorded separately when available.",
  };
  const body = {
    sessionId,
    personId,
    serviceId,
    cutoff,
    purpose,
    household,
    operations: projectOperations(evidence),
    memories,
    evidence,
    retrieval,
  };
  return { ...body, hash: hash(body) };
}
