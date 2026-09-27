import type { HouseholdFixture } from "./data-model.ts";
import type { NetworkView, PersonId } from "../src/types.ts";

// Operational context as of the scenario clock: which access node each service hangs off,
// what the incident register says about it, who has time, and what work is already open.
// Built only from the fixture's operational tables; nothing appears before it happened.
type R = Record<string, any>;
export function projectNetwork(fixture: HouseholdFixture, clock: string): NetworkView {
  const t = (table: string) => ((fixture.tables as Record<string, R[]>)[table] || []) as R[];
  const now = Date.parse(clock);
  const by = (iso: string | null | undefined) => !!iso && Date.parse(iso) <= now;
  const people = t("customer.people");
  const members = t("customer.household_memberships");
  const products = new Map(t("operations.products").map((p) => [p.id, p]));
  const alias = (householdId: string): PersonId | null => {
    const p = members
      .filter((m) => m.household_id === householdId)
      .map((m) => people.find((x) => x.id === m.person_id))
      .find((x) => x && ["daniel", "sam", "maya"].includes(x.alias));
    return (p?.alias as PersonId) ?? null;
  };
  const services = t("customer.services").filter((s) => by(s.ordered_at));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const incidents = t("operations.incidents").filter((i) => by(i.opened_at));
  const membership = t("operations.incident_services").filter((m) => by(m.valid_from));
  const nodes = t("operations.assets").map((a) => {
    const deps = t("operations.service_dependencies").filter((d) => d.asset_id === a.id && by(d.valid_from));
    const attached = deps.map((d) => serviceById.get(d.service_id)).filter(Boolean) as R[];
    const incident = incidents.find((i) =>
      membership.some((m) => m.incident_id === i.id && m.membership === "affected" && attached.some((s) => s.id === m.service_id)),
    );
    return {
      reference: a.reference,
      kind: a.kind,
      incident: incident ? { reference: incident.reference, status: (by(incident.resolved_at) ? "resolved" : "open") as "open" | "resolved" } : null,
      services: attached.map((s) => ({
        person: alias(s.household_id),
        reference: s.reference,
        product: products.get(s.product_id)?.kind ?? "service",
        lifecycle: s.lifecycle,
        incident:
          (membership.find((m) => m.service_id === s.id)?.membership as "affected" | "excluded" | undefined) ?? null,
      })),
    };
  });
  // Services without a recorded access dependency (e.g. mobile) are still part of the household.
  const unattached = services
    .filter((s) => !t("operations.service_dependencies").some((d) => d.service_id === s.id))
    .map((s) => ({
      person: alias(s.household_id),
      reference: s.reference,
      product: products.get(s.product_id)?.kind ?? "service",
      lifecycle: s.lifecycle,
      incident:
        (membership.find((m) => m.service_id === s.id)?.membership as "affected" | "excluded" | undefined) ?? null,
    }));
  const cases = t("operations.cases")
    .filter((c) => by(c.opened_at))
    .map((c) => ({
      reference: c.reference,
      person: alias(serviceById.get(c.service_id)?.household_id),
      owner: c.owner_ref,
      status: (by(c.closed_at) ? "closed" : "open") as "open" | "closed",
      description: c.description,
      openedAt: c.opened_at,
      closedAt: by(c.closed_at) ? c.closed_at : null,
      diagnostics: t("operations.diagnostics")
        .filter((d) => d.case_id === c.id && by(d.completed_at ?? d.started_at))
        .map((d) => ({ test: d.test_name, result: d.result, at: d.completed_at ?? d.started_at })),
    }))
    .sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed") || Date.parse(b.openedAt) - Date.parse(a.openedAt));
  const caseRef = new Map(t("operations.cases").map((c) => [c.id, c.reference]));
  const promises = t("operations.promises")
    .filter((p) => by(p.created_at))
    .map((p) => ({
      case: caseRef.get(p.case_id) ?? null,
      owner: p.owner_ref,
      kind: p.kind,
      dueAt: p.due_at,
      kept: by(p.fulfilled_at),
    }));
  const appointments = t("operations.appointments");
  const known = (eventId: string) => {
    const e = fixture.events.find((x) => x.id === eventId);
    return e ? by(e.knownAt) : true;
  };
  const slots = t("operations.capacity_slots")
    .filter((s) => known(s.source_event_id))
    .map((s) => {
      const held = appointments.find((a) => a.slot_id === s.id);
      return {
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        owner: s.owner_ref,
        heldFor: held ? (caseRef.get(held.case_id) ?? null) : null,
        state: (by(s.ends_at) ? "past" : held ? "held" : "free") as "past" | "held" | "free",
      };
    });
  // Moment 4: one household, several products — members and every service they hold.
  const households = t("customer.households").map((hh) => ({
    label: hh.label,
    person: alias(hh.id),
    members: members
      .filter((m) => m.household_id === hh.id && by(m.valid_from))
      .map((m) => ({ name: people.find((p) => p.id === m.person_id)?.name ?? "Member", since: m.valid_from })),
    services: services
      .filter((sv) => sv.household_id === hh.id)
      .map((sv) => ({ reference: sv.reference, product: products.get(sv.product_id)?.kind ?? "service", lifecycle: sv.lifecycle, since: sv.activated_at ?? sv.ordered_at })),
  }));
  return { nodes, unattached, cases, promises, slots, households };
}
