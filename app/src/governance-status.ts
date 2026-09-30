import type { Decision, SourceEvent } from "./types";

/** Approval must be evidenced at the decision time, not inferred from today’s household state. */
export function hasRecordedApproval(d: Decision, events: SourceEvent[]): boolean {
  const proposal = d.trace?.candidates.find((c) => c.id === d.trace?.selectedId);
  return !!proposal?.checks.some((c) => ["commercial", "approval"].includes(c.id) && c.state === "pass" && c.evidenceIds.some((id) => events.some((e) => e.id === id && e.type === "policy.offer_approved" && Date.parse(e.receivedAt) <= Date.parse(d.time))));
}

/** Reconstruct only authority that was effective and known when this decision ran. */
export function recordedContactPermission(d: Decision | undefined, events: SourceEvent[]): boolean | null {
  if (!d) return null;
  const authority = events.filter(e => e.subject === d.person && e.type === "contact.authority_recorded"
    && e.revision <= d.revision && Date.parse(e.receivedAt) <= Date.parse(d.time) && Date.parse(e.occurredAt) <= Date.parse(d.time)
    && e.payload.purpose === "service" && e.payload.channel === "in_app")
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || Date.parse(a.receivedAt) - Date.parse(b.receivedAt)).at(-1);
  if (typeof authority?.payload.allowed !== "boolean") return null;
  return authority.payload.allowed && authority.payload.role === "account_holder";
}
