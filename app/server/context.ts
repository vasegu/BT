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
  const scoped = available.filter(
    (e) =>
      (e.personId === personId && e.serviceId === serviceId) ||
      (!e.personId &&
        !e.serviceId &&
        ["incident.confirmed", "capacity.recorded"].includes(e.type)),
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
  for (const e of evidence.filter((e) => e.type === "incident.confirmed")) {
    const hasRegisteredService = fixture.tables[
      "operations.incident_services"
    ]?.some((r) => r.service_id === serviceId);
    if (!hasRegisteredService) e.payload = { ...e.payload, affected: [] };
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
    }));
  if (!currentCase && household.activation === "Activation confirmed") {
    household.caseStatus = "none";
    household.owner = null;
  }
  household.contactAllowed =
    fixture.tables["customer.contact_permissions"]?.some(
      (p) =>
        p.person_id === personId &&
        p.account_id === service.account_id &&
        p.purpose === purpose &&
        p.channel === "in_app" &&
        p.allowed === true &&
        effective(p) &&
        knownIds.has(String(p.source_event_id)),
    ) ?? false;
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
      .filter((e) => e.personId === personId && !knownIds.has(e.id))
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
