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
        s.cutoff >= 8
          ? "Stable for six weeks. Nothing to do."
          : h.monitoring === "complete"
            ? "Held all weekend. Case closed."
            : h.monitoring === "active" && s.cutoff >= 6
              ? "Fixed, and watched for 72 hours."
              : h.confirmed && h.restored
          ? "Recovery confirmed"
          : h.restored
            ? "Connection back. Follow-through matters."
            : "Dropping since yesterday. Aisha has the case.",
      detail: `Line ${h.restored ? "observed working" : "not yet verified"} · callback ${h.promiseFulfilled ? "kept" : "outstanding"} · customer ${h.confirmed ? "confirmed" : "reply outstanding"}.`,
      proof: outcomes,
    };
  if (person === "sam")
    return {
      state: h.firstUseObserved && met("activation") ? "met" : "waiting",
      title: h.offerSignal
        ? "Using it all. Ready for something more."
        : h.engaged && !h.unused?.length
          ? "Everything they bought, in use."
          : h.unused?.length
            ? "Connected. Now the rest of the plan."
            : h.firstUseObserved
        ? "First use has its own proof."
        : h.incident && h.incidentCleared
          ? "Cleared to set up. Told to go ahead."
          : h.incident
            ? "Setup paused by a network issue."
            : h.evidence.some((e) => e.type === "router.setup_attempted")
              ? "Switched on, not connected yet."
              : "Delivered is not connected.",
      detail: h.firstUseObserved
        ? "Successful first use observed. The effect of outreach on activation is not measured."
        : "Delivery is recorded. Successful first use is still unconfirmed; the activation team retains ownership.",
      proof: outcomes,
    };
  return {
    state: met("watch") ? "met" : "waiting",
    title: s.cutoff >= 7
      ? "Nothing needed. Nothing sent."
      : h.quietFix === "fixed"
        ? "Fixed overnight. Told in the morning."
        : met("watch")
      ? "The watch ended. The evening stayed quiet."
      : s.cutoff === 0
        ? "A normal evening so far."
        : "Watch the signal. Respect the routine.",
    detail: `${messages} customer messages · ${met("watch") ? "a returning heartbeat fulfils the watch" : h.incident ? "incident evidence overrides the routine" : h.caseStatus !== "none" ? "current care evidence requires review" : "waiting for fresh telemetry; the routine is context, not proof"}.`,
    proof: outcomes,
  };
}
/** The clock is the spine: each stop is one source signal, read across all three homes at once. */
export const moments = [
  { time: "20:45", title: "Before the signal", lead: "No network signal yet, but each home already has a history. Daniel’s line has been dropping since yesterday, tonight’s restart didn’t fix it, and Aisha has promised to call at 21:15. His hub still looks healthy to our systems." },
  { time: "21:00", title: "Three homes, one minute", lead: "Daniel’s and Maya’s routers miss the same heartbeat. Sam switches on a new hub for the first time, and it won’t connect." },
  { time: "21:03", title: "A network incident is confirmed", lead: "The affected-service register names exactly which homes are in scope." },
  { time: "21:12", title: "The line comes back", lead: "The incident clears and fresh evidence arrives. A working line does not close every thread." },
  { time: "21:15", title: "A promise is kept", lead: "The named adviser makes the promised call, on time." },
  { time: "21:18", title: "The customers confirm", lead: "The loop closes with each customer's own evidence." },
  { time: "Sat 08:30", title: "The morning after", lead: "What happened overnight, and who needs to hear about it. A quiet fix is only a selling point if the customer learns about it at the right time." },
  { time: "Mon 08:30", title: "Before the working week", lead: "Heightened monitoring ends, early life is checked, and every message is timed to the household’s own week." },
  { time: "6 Nov", title: "Six weeks on", lead: "What the relationship looks like now: what’s in use, what they might enjoy next, and what the system has learned." },
].map((m, i) => ({ ...m, chapter: i >= 6 ? 2 : 1 }));
/** The two chapters of the story. */
export const chapters = [
  { title: "Tonight", from: 0, to: 5 },
  { title: "The weeks after", from: 6, to: 8 },
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

/** The recorded clock at each moment (UTC), matching the engine. */
const CLOCKS = ["2026-09-25T19:45:00Z", "2026-09-25T20:00:00Z", "2026-09-25T20:03:00Z", "2026-09-25T20:12:00Z", "2026-09-25T20:15:00Z", "2026-09-25T20:18:00Z", "2026-09-26T07:30:00Z", "2026-09-28T07:30:00Z", "2026-11-06T19:00:00Z"];
const RECORD_TEXT: Record<string, (first: string, owner: string) => string> = {
  "router.heartbeat_overdue": () => "Router went quiet",
  "router.setup_attempted": () => "Hub switched on, not connected",
  "router.heartbeat_received": () => "Hub back online",
  "service.restored_observed": () => "Line test passed",
  "promise.fulfilled": (_f, owner) => `${owner}’s promised call made`,
  "customer.confirmed_working": (first) => `${first} confirmed it works`,
  "activation.confirmed": () => "Line provisioned",
  "activation.first_use_observed": () => "First connection observed",
  "mobile.activity_observed": () => "Linked mobile active at home",
  "service.reprofiled": () => "Line re-profiled remotely",
  "monitoring.started": () => "72-hour monitoring started",
  "monitoring.checked": () => "Overnight check: no drops",
  "monitoring.completed": () => "Monitoring complete: no drops",
  "case.closed": (_f, owner) => `${owner} closed the case`,
  "line.degradation_detected": () => "Routine test found the line degrading",
  "early_life.checkpoint": () => "TV and Netflix not set up yet",
  "product.activated": () => "A product was set up",
  "usage.observed": () => "Household using everything",
  "usage.pattern": () => "Sport watched most weekends",
};
export type ChangeRow = { panel: PresentationPanel | "governance"; name: string; text: string; changed: boolean };

/** One line per panel: what changed for this customer at this moment, compared with the moment before. */
export function changeSummary(s: Snapshot, person: PersonId): ChangeRow[] {
  const h = s.households.find((x) => x.id === person)!;
  const first = householdNames[person].split(" ")[0];
  const owner = h.owner ?? "The case owner";
  const at = s.cutoff;
  const mine = s.events.filter((e) => e.subject === person && e.revision === at && at > 0 && RECORD_TEXT[e.type]);
  const shared = s.events.filter((e) => e.subject === "shared" && e.revision === at && at > 0 && e.type.startsWith("incident."));
  const decisions = s.decisions.filter((d) => d.person === person);
  const decision = decisions.find((d) => d.revision === at) ?? null;
  const previous = decisions.filter((d) => d.revision < at).at(-1) ?? null;
  const message = s.actions.find((a) => a.person === person && a.revision === at) ?? null;
  const outcomes = s.operations.outcomes.filter((o) => o.person === person);
  const from = Date.parse(CLOCKS[Math.max(0, at - 1)]),
    to = Date.parse(CLOCKS[at]);
  const proven = outcomes.filter((o) => o.check.status === "met" && o.check.observedAt && Date.parse(o.check.observedAt) > from && Date.parse(o.check.observedAt) <= to);
  const opened = outcomes.filter((o) => o.revision === at);
  const chosen = decision?.trace?.candidates.find((c) => c.id === decision.trace?.selectedId);
  const waiting = decision?.trace?.candidates.filter((c) => c.status === "awaiting") ?? [];
  const withdrawn = (previous?.trace?.candidates ?? []).filter(
    (c) => c.status === "awaiting" && decision?.trace?.candidates.find((x) => x.id === c.id)?.status !== "awaiting",
  );
  const incidentText = (e: Snapshot["events"][number]) => {
    const id = String(e.payload.incidentId ?? "The incident");
    if (e.type === "incident.cleared") return h.incident ? `${id} cleared, so ${first} is no longer waiting on it` : `${id} cleared; ${first} was never in it`;
    return h.incident ? `${id} confirmed, with ${first}’s service inside it` : `${id} confirmed; ${first} is outside it`;
  };
  return [
    {
      panel: "customer",
      name: "Customer memory",
      text: at === 0 ? "History loaded before tonight’s first signal" : mine.length ? mine.map((e) => RECORD_TEXT[e.type](first, owner)).join(" · ") : "Nothing new for this home",
      changed: at === 0 || mine.length > 0,
    },
    {
      panel: "operations",
      name: "Operational memory",
      text: shared.length ? shared.map(incidentText).join(" · ") : at === 0 ? "No network signal yet" : "No change on the network",
      changed: shared.length > 0,
    },
    {
      panel: "arbiter",
      name: "Arbiter",
      text: !decision
        ? at === 0 ? "No decision until a signal arrives" : previous ? `Still: ${previous.title}` : "No decision"
        : previous && previous.title !== decision.title
          ? `${previous.title} → ${decision.title}`
          : previous
            ? `Still: ${decision.title}`
            : decision.title,
      changed: !!decision && (!previous || previous.title !== decision.title),
    },
    {
      panel: "phone",
      name: "Customer experience",
      text: message ? `Sees “${message.title}”` : decision ? "Nothing new on the phone, by design" : "Nothing new on the phone",
      changed: !!message,
    },
    {
      panel: "actions",
      name: "Actions & outcomes",
      text: proven.length
        ? `Proven: ${proven.map((o) => o.title.toLowerCase()).join(", ")}`
        : opened.length
          ? `Now expecting: ${opened.map((o) => o.title.toLowerCase()).join(", ")}`
          : "No new proof or expectation",
      changed: proven.length > 0 || opened.length > 0,
    },
    {
      panel: "governance",
      name: "Governance",
      text: withdrawn.length
        ? `${withdrawn.map((c) => c.title).join(", ")} withdrawn, never booked`
        : waiting.length
          ? `${waiting.map((c) => c.title).join(", ")} waits for ${waiting[0].authority?.role ?? "a person"}`
          : chosen?.authority
            ? `${decision?.moment?.kind === "load-bearing" ? "Load-bearing" : "Routine"} · ${chosen.authority.mode === "autonomous" ? "ran on its own" : chosen.authority.mode === "human-led" ? `led by ${chosen.authority.role}` : `signed off by ${chosen.authority.role}`}`
            : "No decision to authorise yet",
      changed: withdrawn.length > 0 || waiting.length > 0 || (!!decision && (!previous || previous.title !== decision.title)),
    },
  ];
}
