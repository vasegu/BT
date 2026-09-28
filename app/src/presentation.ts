import type { Snapshot, PersonId } from "./types.ts";
export type PresentationPanel =
  | "customer"
  | "operations"
  | "arbiter"
  | "actions"
  | "phone";
export const householdNames: Record<PersonId, string> = {
  daniel: "Daniel Reed",
  sam: "Sam Morgan",
  maya: "Maya Patel",
};
const people: PersonId[] = ["daniel", "sam", "maya"];
export function householdOutcome(s: Snapshot, person: PersonId) {
  const h = s.households.find((h) => h.id === person)!;
  const outcomes = s.operations.outcomes.filter((o) => o.person === person);
  const met = (goal: string) =>
    outcomes.some((o) => o.goal === goal && o.check.status === "met");
  const contradiction = outcomes.find((o) => o.check.status === "contradicted");
  const messages = s.actions.filter((a) => a.person === person).length;
  if (contradiction)
    return {
      state: "contradicted",
      title: "Fresh evidence needs attention",
      detail: contradiction.check.finding,
      proof: outcomes,
    };
  if (person === "daniel")
    return {
      state:
        met("service") && met("callback") && met("confirmation")
          ? "met"
          : "waiting",
      title:
        h.confirmed && h.restored
          ? "Recovery confirmed"
          : h.restored
            ? "Connection back. Follow-through matters."
            : "An existing case, an existing promise.",
      detail: `Line ${h.restored ? "observed working" : "not yet verified"} · callback ${h.promiseFulfilled ? "kept" : "outstanding"} · customer ${h.confirmed ? "confirmed" : "reply outstanding"}.`,
      proof: outcomes,
    };
  if (person === "sam")
    return {
      state: h.firstUseObserved && met("activation") ? "met" : "waiting",
      title: h.firstUseObserved
        ? "First use has its own proof."
        : "Delivered is not connected.",
      detail: h.firstUseObserved
        ? "Successful first use observed. The effect of outreach on activation is not measured."
        : "Delivery is recorded. Successful first use is still unconfirmed; the activation team retains ownership.",
      proof: outcomes,
    };
  return {
    state: met("watch") ? "met" : "waiting",
    title: met("watch")
      ? "The watch ended. The evening stayed quiet."
      : "Watch the signal. Respect the routine.",
    detail: `${messages} customer messages · ${met("watch") ? "a returning heartbeat fulfils the watch" : h.incident ? "incident evidence overrides the routine" : h.caseStatus !== "none" ? "current care evidence requires review" : "waiting for fresh telemetry; the routine is context, not proof"}.`,
    proof: outcomes,
  };
}
/** The clock is the spine: each stop is one source signal, read across all three homes at once. */
export const moments = [
  {
    time: "20:45",
    title: "Before the signal",
    lead: "Three homes, three histories. Nothing has happened yet.",
    proves: { component: "Customer memory", detail: "Three histories already known — usable in the moment, not a report pulled up afterwards." },
  },
  {
    time: "21:00",
    title: "Three routers go quiet",
    lead: "The same heartbeat is overdue in all three homes at the same minute.",
    proves: { component: "The reasoning engine", detail: "One identical signal. What memory holds makes it three different right answers." },
  },
  {
    time: "21:03",
    title: "A network incident is confirmed",
    lead: "The affected-service register names exactly which homes are in scope.",
    proves: { component: "Operational memory", detail: "Shared scope is declared explicitly — which homes are in, which are not. No guessing." },
  },
  {
    time: "21:12",
    title: "The line comes back",
    lead: "Fresh evidence arrives. A working line does not close every thread.",
    proves: { component: "The loop stays open", detail: "A restored line is not a kept promise. Fresh evidence keeps the thread open." },
  },
  {
    time: "21:15",
    title: "A promise is kept",
    lead: "The named adviser makes the call she promised, on time.",
    proves: { component: "Governed action", detail: "A named adviser acts — accountable and on time, not an automated guess." },
  },
  {
    time: "21:18",
    title: "The customers confirm",
    lead: "The loop closes with each customer's own evidence.",
    proves: { component: "The loop closes", detail: "Each outcome is written back to memory. The capability compounds." },
  },
];
// Continuous telemetry and chat are context, not the moment's signal.
const ambient = new Set([
  "router.observation_window",
  "router.overnight_window",
  "conversation.message",
  "contact.authority_recorded",
]);
export type MomentLane = {
  person: PersonId;
  decision: Snapshot["decisions"][number] | null;
  previous: Snapshot["decisions"][number] | null;
  changed: boolean;
  message: Snapshot["actions"][number] | null;
  lastMessage: Snapshot["actions"][number] | null;
  fresh: Snapshot["events"];
  involved: boolean;
  inIncident: boolean;
  outcome: ReturnType<typeof householdOutcome>;
  panels: PresentationPanel[];
};
export function momentView(s: Snapshot) {
  const decided = (p: PersonId) =>
    s.decisions.some((d) => d.person === p && d.revision === s.cutoff);
  const status: "ready" | "deciding" | "failed" = s.failedJobs
    ? "failed"
    : s.pendingJobs || (s.cutoff > 0 && people.some((p) => !decided(p)))
      ? "deciding"
      : "ready";
  const signals = s.cutoff
    ? s.events.filter((e) => e.revision === s.cutoff && !ambient.has(e.type))
    : [];
  const shared = signals.filter((e) => e.subject === "shared");
  const lanes: MomentLane[] = people.map((person) => {
    const h = s.households.find((h) => h.id === person)!;
    const mine = s.decisions.filter((d) => d.person === person);
    const decision =
      status === "ready" ? (mine.filter((d) => d.revision <= s.cutoff).at(-1) ?? null) : null;
    const previous = mine.filter((d) => d.revision < s.cutoff).at(-1) ?? null;
    const changed =
      !!decision && decision.revision === s.cutoff && (!previous || previous.title !== decision.title);
    const actions = s.actions.filter((a) => a.person === person);
    const message = actions.filter((a) => a.revision === s.cutoff).at(-1) ?? null;
    const lastMessage = actions.filter((a) => a.revision < s.cutoff).at(-1) ?? null;
    const fresh = signals.filter((e) => e.subject === person);
    const inIncident = !!h.incident;
    const touchedByShared = shared.length > 0 && inIncident;
    const panels: PresentationPanel[] = [];
    if (fresh.length) panels.push("customer");
    if (shared.length) panels.push("operations");
    if (changed) panels.push("arbiter");
    if (message || fresh.some((e) => /fulfilled|confirmed|first_use|restored|received/.test(e.type)))
      panels.push("actions");
    if (message) panels.push("phone");
    return {
      person,
      decision,
      previous,
      changed,
      message,
      lastMessage,
      fresh,
      inIncident,
      involved: s.cutoff === 0 || fresh.length > 0 || changed || !!message || touchedByShared,
      outcome: householdOutcome(s, person),
      panels,
    };
  });
  return { status, moment: moments[s.cutoff], signals, lanes };
}
