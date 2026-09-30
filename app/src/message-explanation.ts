import type { Snapshot, Household, DemoAction, SourceEvent } from "./types.ts";
import { formatDateTime } from "./time.ts";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });

const availableAt = (events: SourceEvent[], cutoff: string) => events.filter(e =>
  Date.parse(e.receivedAt) <= Date.parse(cutoff) && Date.parse(e.occurredAt) <= Date.parse(cutoff));

export function messageExplanation(action: DemoAction, snapshot: Snapshot, person: Household["id"]) {
  const decision = snapshot.decisions.find(d => d.id === action.decisionId);
  const at = decision?.time ?? action.time;
  const available = availableAt(snapshot.events, at);
  const personal = available.filter(e => e.subject === person).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const caseEvent = personal.filter(e => e.type === "case.opened" || e.type === "case.closed").at(-1);
  const owner = caseEvent?.type === "case.opened" && typeof caseEvent.payload.owner === "string" ? caseEvent.payload.owner : null;
  const ids = new Set(decision?.evidenceIds ?? []);
  const evidence = (decision?.evidenceIds ?? []).map(id => available.find(e => e.id === id)).filter((e): e is SourceEvent => !!e);
  const used = evidence.map(e => ({ event: e, reason: because(e, owner, person) }));
  const sources = [...new Set(used.map(({ event, reason }) => reason?.used ?? event.source))];
  if (decision?.trace?.selectedId === "offer") {
    const priority = ["usage.pattern", "preference.offers_opt_in", "policy.offer_approved", "incident.cleared"];
    used.sort((a, b) => (priority.includes(a.event.type) ? priority.indexOf(a.event.type) : 99) - (priority.includes(b.event.type) ? priority.indexOf(b.event.type) : 99));
  }
  const reasons = [...new Map(used.filter(u => u.reason).map(u => [u.reason!.text, u.reason!])).values()];
  return { decision, at, owner, sources, reasons, held: personal.filter(e => !ids.has(e.id)).length };
}

export function monitoringCheckLines(events: SourceEvent[], person: Household["id"], cutoff: string) {
  const relevant = availableAt(events, cutoff).filter(e => e.subject === person && ["service.reprofiled", "monitoring.completed", "case.closed"].includes(e.type))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  return relevant.map(e => `${formatDateTime(e.occurredAt)} · ${e.description}`);
}

/** A customer-language reason for each record a decision relied on. */
function because(e: SourceEvent, owner: string | null, person: Household["id"]): { text: string; used: string } | null {
  const p = e.payload as Record<string, unknown>;
  switch (e.type) {
    case "router.heartbeat_overdue":
      return { text: `Your hub stopped checking in with us at ${time(e.occurredAt)}.`, used: "Your hub’s status signal" };
    case "router.heartbeat_received":
      return { text: `Your hub checked in again at ${time(e.occurredAt)}.`, used: "Your hub’s status signal" };
    case "service.reprofiled":
      return { text: "We adjusted your line remotely to keep it stable.", used: "Tests already run on your line" };
    case "monitoring.completed":
      return { text: "We watched your line closely after the fix: no drops.", used: "Your hub’s status signal" };
    case "line.drops_detected":
      return { text: `Our monitoring spotted short drops on your line on ${day(e.occurredAt)}, before you had to tell us.`, used: "Tests already run on your line" };
    case "line.degradation_detected":
      return { text: "A routine overnight check found your line getting weaker.", used: "Tests already run on your line" };
    case "early_life.checkpoint":
      return { text: "Your plan includes BT TV and Netflix, and they weren’t set up yet.", used: "Your order" };
    case "product.activated":
      return { text: `You set up ${String(p.product ?? "a product")}.`, used: "Your order" };
    case "usage.observed":
      return { text: "Your household has been using everything.", used: "How you use your services" };
    case "usage.pattern":
      return { text: "Your household watches live sport on most weekends.", used: "How you use your services" };
    case "preference.offers_opt_in":
      return { text: "You said you’d like to hear about relevant offers.", used: "What you told us" };
    case "router.setup_attempted":
      return { text: `You switched on your new hub at ${time(e.occurredAt)}, before its first connection was confirmed.`, used: "Your hub’s status signal" };
    case "incident.cleared":
      return { text: "The network fault in your area has been fixed.", used: "Our network fault register" };
    case "incident.confirmed":
      return Array.isArray(p.affected) && p.affected.includes(person)
        ? { text: "Your line was included in a confirmed network fault in your area.", used: "Our network fault register" }
        : { text: "A nearby network fault did not include your line.", used: "Our network fault register" };
    case "diagnostic.completed":
      return p.result === "not_resolved" || p.result === "intermittent"
        ? { text: `A ${String(p.test ?? "test").replace("_", " ")} at ${time(e.occurredAt)} didn’t fix it, so we won’t ask you to repeat it.`, used: "Tests already run on your line" }
        : { text: `We ran a ${String(p.test ?? "test").replace("_", " ")} on your line at ${time(e.occurredAt)}.`, used: "Tests already run on your line" };
    case "service.restored_observed":
      return { text: `A line test at ${time(e.occurredAt)} showed your connection was back.`, used: "Tests already run on your line" };
    case "promise.created":
      return { text: `${owner ?? "Your adviser"} promised to call you at ${formatDateTime(String(p.dueAt ?? e.occurredAt))}.`, used: "Your case history" };
    case "promise.fulfilled":
      return { text: `${owner ?? "Your adviser"} made the promised call at ${formatDateTime(e.occurredAt)}.`, used: "Your case history" };
    case "case.opened":
      return { text: `You reported this on ${day(e.occurredAt)}.`, used: "Your case history" };
    case "order.delivered":
      return { text: `Your hub was delivered on ${day(e.occurredAt)}.`, used: "Your order" };
    case "activation.pending":
    case "activation.confirmed":
      return { text: e.type === "activation.pending" ? "Your line was awaiting activation." : "Your line activation was confirmed.", used: "Your order" };
    case "activation.first_use_observed":
      return { text: "We saw your connection being used for the first time.", used: "Your hub’s status signal" };
    case "customer.confirmed_working":
      return { text: "You told us it’s working again.", used: "What you told us" };
    case "mobile.activity_observed":
      return { text: "Activity on your linked mobile service helped us interpret this broadband signal. It does not authorise changes to your mobile service.", used: "Linked mobile activity" };
    case "policy.offer_approved":
      return { text: "This offer has separate recorded approval.", used: "Commercial approval" };
    case "preference.stated":
      return { text: `You told us: ${e.description}`, used: "What you told us" };
    default:
      return null;
  }
}
