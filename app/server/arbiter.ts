import { randomUUID } from "node:crypto";
import { authorityFor } from "../src/governance.ts";
import type {
  Decision,
  Household,
  MomentKind,
  Proposal,
  ProposalCheck,
  Snapshot,
} from "../src/types.ts";

const clock = (value: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });

// A reproducible policy over source-backed context. Priority is a rule value,
// not model confidence. Hard eligibility checks always precede ranking.
export function arbitrate(
  h: Household,
  before: Household,
  snapshot: Snapshot,
): Decision {
  const { cutoff: revision, clock: time, operations } = snapshot;
  const latest = (type: string) =>
    h.evidence.filter((e) => e.type === type).at(-1);
  const refs = (...types: string[]) =>
    types.flatMap((type) => (latest(type)?.id ? [latest(type)!.id] : []));
  const gate = (
    id: string,
    label: string,
    passed: boolean | null,
    detail: string,
    ...types: string[]
  ): ProposalCheck => ({
    id,
    label,
    state: passed === null ? "unknown" : passed ? "pass" : "fail",
    detail,
    evidenceIds: refs(...types),
  });
  const due = h.promise ? clock(h.promise) : null;
  const obligation = h.promise && !h.promiseFulfilled;
  const open = h.caseStatus === "open";
  const delivered = h.activation.includes("unconfirmed");
  const quiet = !!h.habit && !open && !h.promise && !h.incident;
  const available = operations.slots.filter((s) => !s.person && !s.owner);
  const incidentId = operations.incident?.id || "the incident";
  const signalRefs = refs(
    "router.heartbeat_overdue",
    "router.heartbeat_received",
    "service.restored_observed",
  );
  const failure = latest('service.failure_observed');
  const recovery = latest('service.restored_observed');
  const contraryTest = !!failure && (!recovery || Date.parse(failure.occurredAt) > Date.parse(recovery.occurredAt));
  // One household, several products: another product's recent signal can inform this one.
  const linked = h.linkedServices?.find((s) => s.recent);
  // The network team has cleared the incident this service was in.
  const cleared = !!h.incidentCleared;
  // An incident that cleared within the last day still owes affected customers a closing update.
  const clearedAt = latest("incident.cleared");
  const clearedRecently = !!clearedAt && Date.parse(time) - Date.parse(clearedAt.occurredAt) < 24 * 3600e3;
  // The case owner has only just spoken to the customer and made a promise: a message now would
  // repeat what they were told, so new evidence goes onto the case instead.
  const justPromised = justSpoken(h, time);
  // One-shot actions are not repeated at later moments.
  const done = (id: string) =>
    snapshot.decisions.some((d) => d.person === h.id && d.revision < revision && d.trace?.selectedId === id);
  const once = (id: string) =>
    gate("once", "Not already done", !done(id), done(id) ? "Already done at an earlier moment." : "Not yet done for this customer.");
  // The household's quiet hours, from their own stated preference.
  const hour = Number(new Date(time).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false })) % 24;
  const quietHours = (!!h.habit || !!h.profile?.preferences?.quietHours) && (hour >= 22 || hour < 7);
  const lastQuiet = latest("router.heartbeat_overdue");
  const signalTonight = !!lastQuiet && Date.parse(time) - Date.parse(lastQuiet.occurredAt) < 24 * 3600e3;
  const candidates: Proposal[] = [];
  function propose(
    id: string,
    agent: string,
    title: string,
    domain: string,
    disposition: string,
    reason: string,
    wake: string,
    effect: string,
    factors: [string, number][],
    checks: ProposalCheck[],
    evidenceIds: string[],
  ) {
    candidates.push({
      id,
      agent,
      title,
      domain,
      disposition,
      reason,
      wake,
      effect,
      factors: factors
        .filter(([, v]) => v !== 0)
        .map(([label, value]) => ({ label, value })),
      priority: factors.reduce((sum, [, value]) => sum + value, 0),
      checks,
      evidenceIds: [
        ...new Set([...evidenceIds, ...checks.flatMap((c) => c.evidenceIds)]),
      ],
      status: checks.every((c) => c.state === "pass") ? "held" : "blocked",
    });
  }
  propose(
    "first-use", "activation.verification", "Successful first use observed", "activation", "complete",
    "Provisioning and a successful authenticated session are recorded separately. Stop repeating setup advice; retain the observed outcome.",
    "A new service failure or support request opens a fresh assessment.",
    "Record successful first use and publish a connection update; do not attribute it to the earlier outreach.",
    [["First-use proof", 110]],
    [gate("first_use", "Successful first-use observation", h.firstUseObserved === true,
      "Requires a successful first-use record for this service, not delivery or provisioning alone.", "activation.first_use_observed"),
      gate("no_new_fault", "No later contradictory test", !contraryTest,
        contraryTest ? "A later failed test requires further investigation." : "No contradictory service test is recorded.", "service.failure_observed"),
      once("first-use")],
    refs("activation.confirmed", "activation.first_use_observed"),
  );
  propose(
    "confirmation",
    "care.outcome",
    "Recovery confirmed",
    "recovery",
    "complete",
    h.confirmed
      ? `${h.name.split(" ")[0]} confirmed the connection works. The diagnostic history and any callback record remain attached.`
      : "Acknowledging recovery requires an explicit customer confirmation. It has not been recorded yet.",
    "A new fault report opens a fresh assessment.",
    "Record confirmed outcome; publish the case update.",
    [["Confirmed outcome", 100]],
    [
      gate(
        "confirmation",
        "Customer confirmation",
        h.confirmed,
        h.confirmed
          ? "An explicit customer statement is recorded."
          : "No customer confirmation has been recorded.",
        "customer.confirmed_working",
      ),
      gate('no_unresolved_test','No contradictory fresh test',!contraryTest,
        contraryTest ? 'The customer reply differs from the latest failed line test. Reconcile them before acknowledging recovery.' : 'No newer contradictory service test.',
        'service.failure_observed','service.restored_observed'),
      once("confirmation"),
    ],
    refs("customer.confirmed_working", "promise.fulfilled"),
  );
  propose(
    "restoration",
    "care.continuity",
    h.restored
      ? obligation
        ? `Keep the ${due} callback`
        : "Await customer confirmation"
      : "Reconcile service restoration",
    "recovery",
    obligation ? "merge" : "investigate",
    !h.restored
      ? "No fresh restoration is recorded. Keep the current service investigation active."
      : obligation
        ? `The line recovered. ${h.owner || "The care team"} still owes the ${due} callback; restoration does not fulfil that promise.`
        : "Technical restoration is observed. Customer confirmation remains a separate observation.",
    "Customer confirmation or a further service observation.",
    "Update the customer; preserve the existing case and obligations.",
    [
      ["Restoration observed", 70],
      ["Open relationship", open ? 15 : 0],
      ["Promise retained", obligation ? 10 : 0],
    ],
    [
      gate(
        "restored",
        "Fresh restoration",
        h.restored,
        h.restored ? h.serviceState : "No restoration observation yet.",
        "service.restored_observed",
        "router.heartbeat_received",
      ),
      gate(
        "open",
        "Recovery still pending",
        // A line that has never worked before connects for the first time; it isn't "restored".
        !h.firstUseObserved && (!h.confirmed || contraryTest) && (open || !!h.promise || (h.incident && (!cleared || clearedRecently))),
        "Technical recovery, the callback and customer confirmation are evaluated independently.",
        "incident.confirmed",
        "case.opened",
        "order.delivered",
        "promise.created",
        "customer.confirmed_working",
      ),
    ],
    refs("promise.created", "promise.fulfilled"),
  );
  propose(
    "incident",
    "network.coordination",
    "Coordinate the shared incident",
    "network",
    "merge",
    !h.incident
      ? "Incident coordination requires explicit service membership; a shared event alone is insufficient."
      : `${incidentId} explicitly includes this service. ${obligation ? `Keep ${h.owner || "the current owner"} and the ${due} callback.` : delivered ? "Coordinate the activation investigation; delivery does not establish first use." : "Coordinate care using the confirmed affected-service register."}`,
    "Incident scope, restoration or customer evidence changes.",
    "Send one scoped incident update; retain existing care ownership.",
    [
      ["Verified incident", 70],
      ["Unresolved service", !h.restored ? 15 : 0],
      ["Promise retained", obligation ? 10 : 0],
    ],
    [
      gate(
        "membership",
        "Explicit incident membership",
        operations.incident ? h.incident : null,
        operations.incident
          ? h.incident
            ? `Service included in ${incidentId}.`
            : `Service is outside ${incidentId}.`
          : "No affected-service register available yet.",
        "incident.confirmed",
      ),
      gate(
        "unresolved",
        "Service not yet restored",
        !h.restored && !cleared && (!h.confirmed || contraryTest),
        h.restored
          ? "A later recovery observation supersedes incident-only guidance."
          : cleared
            ? `${incidentId} is cleared; incident guidance no longer applies.`
            : "No later restoration observation.",
        "service.restored_observed",
        "router.heartbeat_received",
        "customer.confirmed_working",
      ),
    ],
    refs("case.opened", "promise.created", "order.delivered"),
  );
  propose(
    "recovery",
    "care.recovery",
    open ? "Continue the recovery plan" : "Investigate service state",
    "recovery",
    "investigate",
    `${h.restartTried ? "The earlier restart did not resolve the issue. " : "The cause is still unconfirmed. "}${obligation ? `Keep ${h.owner || "the current owner"} and the ${due} callback together.` : open ? "Continue the reported case with its existing owner." : "Obtain fresh diagnostics before asking the customer to act."}${justPromised ? ` ${h.owner} spoke to ${h.name.split(" ")[0]} minutes ago; the new drop goes onto the case, with no message that would repeat it.` : ""}`,
    "A fresh diagnostic, incident membership or customer report.",
    justPromised
      ? "Add tonight’s evidence to the owner’s case; send no message that repeats what the customer was just told."
      : "Publish a service update; continue the existing investigation.",
    [
      ["Investigation", 40],
      ["Open case", open ? 25 : 0],
      ["Promise", obligation ? 15 : 0],
      ["Failed earlier test", h.restartTried ? 10 : 0],
    ],
    [
      gate(
        "care",
        "Current care need",
        !quiet && !delivered && !h.restored && (!h.confirmed || contraryTest),
        quiet
          ? "Stated habit has no contrary case or incident evidence."
          : delivered
            ? "Provisioning evidence is the first unresolved question."
            : "Evaluate the current case and service observations.",
        "case.opened",
        "preference.stated",
        "order.delivered",
        "service.restored_observed",
      ),
      gate(
        "local",
        "Independent investigation useful",
        !h.incident || cleared,
        cleared
          ? `${incidentId} is cleared; any remaining fault is this service’s own.`
          : h.incident
            ? "Merge this care work into the confirmed incident plan."
            : "No confirmed shared incident supersedes the investigation.",
        "incident.confirmed",
      ),
    ],
    refs("diagnostic.completed", "promise.created"),
  );
  propose(
    "activation",
    "activation.provisioning",
    cleared ? "Tell the customer setup can go ahead" : "Check activation status",
    "activation",
    "investigate",
    cleared
      ? `${incidentId} is cleared. Setup was paused for the incident; the hub can connect now.`
      : "Equipment is delivered. Activation and first use are unconfirmed. Check provisioning before setup advice.",
    "Provisioning result or confirmed first use.",
    cleared ? "Tell the customer they can set up their hub now; retain the activation team's ownership." : "Publish an activation update; retain the activation team's ownership.",
    [
      ["Activation investigation", 55],
      ["Delivery without first use", delivered ? 25 : 0],
    ],
    [
      gate(
        "delivery",
        "Delivered, first use unknown",
        delivered && !h.restored && (!h.confirmed || contraryTest),
        delivered
          ? "Delivery is recorded; successful first use is absent."
          : "No pending delivered order in this context.",
        "order.delivered",
        "service.restored_observed",
      ),
      gate(
        "local",
        "Provisioning can proceed independently",
        !h.incident || cleared,
        cleared
          ? `${incidentId} is cleared; setup can go ahead.`
          : h.incident
            ? "Coordinate this work under the confirmed network incident."
            : "No confirmed shared incident to merge into.",
        "incident.confirmed",
      ),
    ],
    signalRefs,
  );
  propose(
    "watch",
    "behaviour.observation",
    h.restored ? "Quiet watch completed" : "Observe without interruption",
    "observation",
    h.restored ? "suppress" : "watch",
    !quiet
      ? "A current case, promise or incident can override the usual pattern. Quiet observation is not eligible on this context."
      : h.restored
        ? "A fresh heartbeat ended the watch. No customer interruption was needed."
        : `The missing heartbeat matches a stated quiet habit. No open case or promise. ${operations.incident ? `This service is outside ${incidentId}.` : "No incident membership is established."}${linked ? " The household’s linked mobile is in normal use at home in the same window, so they are not cut off." : ""}`,
    "A fresh heartbeat, a new fault report or changed incident membership.",
    "Retain an internal watch; send no service notification.",
    [
      ["Observation", 25],
      ["Stated preference", h.habit ? 20 : 0],
      ["No contrary evidence", quiet ? 15 : 0],
      ["Linked mobile active at home", linked ? 10 : 0],
    ],
    [
      gate(
        "habit",
        "Stated habit available",
        !!h.habit,
        h.habit || "No quiet-period preference recorded.",
        "preference.stated",
      ),
      gate(
        "tonight",
        "A quiet signal in the last day",
        signalTonight,
        signalTonight ? "The hub went quiet within the last 24 hours." : "No recent quiet signal to watch.",
        "router.heartbeat_overdue",
      ),
      gate(
        "contrary",
        "No conflicting obligation or fault",
        quiet,
        quiet
          ? "No open case, callback promise or verified incident impact."
          : "Current care or incident evidence overrides the historical habit.",
        "case.opened",
        "order.delivered",
        "promise.created",
        "incident.confirmed",
      ),
    ],
    [...signalRefs, ...refs("pattern.recorded"), ...(linked?.recent ? [linked.recent.id] : [])],
  );
  propose(
    "callback",
    "care.scheduling",
    "Arrange an additional callback",
    "care",
    "hold",
    "A new callback requires unallocated capacity and a need not already owned by a care team.",
    "A fresh support request needs a callback and an appropriate slot is available.",
    "Proposal only; the demo does not book an additional appointment.",
    [
      ["Callback request", 30],
      ["Open case", open ? 20 : 0],
    ],
    [
      gate(
        "capacity",
        "Unallocated callback capacity",
        available.length > 0,
        `${available.length} unallocated slot${available.length === 1 ? "" : "s"} in the current rota.`,
        "capacity.recorded",
      ),
      gate(
        "ownership",
        "No duplicate care ownership",
        !h.owner && !h.promise,
        h.owner || h.promise
          ? `${h.owner || "A care owner"} already holds this relationship${due ? `; callback ${due}` : ""}.`
          : "No existing owner or callback.",
        "case.opened",
        "order.delivered",
        "promise.created",
      ),
      gate(
        "request",
        "Explicit callback request",
        null,
        "No new callback request recorded; do not reserve capacity speculatively.",
      ),
    ],
    [],
  );
  propose(
    "restart",
    "diagnostics.local",
    "Repeat hub restart",
    "diagnostics",
    "hold",
    h.restartTried
      ? "The previous restart failed; repeating it needs fresh diagnostic justification."
      : "A missing heartbeat does not establish that a restart would help.",
    "A new diagnostic explicitly recommends this local test.",
    "No restart instruction is sent.",
    [["Local troubleshooting", 35]],
    [
      gate(
        "prior",
        "Previous test not exhausted",
        !h.restartTried,
        h.restartTried
          ? "Restart already attempted without resolution."
          : "No failed restart retained.",
        "diagnostic.completed",
      ),
      gate(
        "diagnosis",
        "Fresh diagnostic justification",
        null,
        "Line sync and cause are not established by the heartbeat alone.",
        "router.heartbeat_overdue",
      ),
    ],
    [],
  );
  const approval = latest("policy.offer_approved");
  const faultFreeDays = Number(approval?.payload.faultFreeDays);
  const faultWindowStart = Date.parse(time) - faultFreeDays * 24 * 3600e3;
  const dated = h.evidence.filter(e => Date.parse(e.occurredAt) <= Date.parse(time) && Date.parse(e.receivedAt) <= Date.parse(time))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  // Household evidence is already scoped to its selected service by buildContext.
  const faults = dated.filter(e =>
    (e.subject === h.id &&
      ((e.type === "case.opened" && e.payload.owner !== "Activation team") ||
       ["service.failure_observed", "line.degradation_detected", "line.drops_detected"].includes(e.type))) ||
    (e.type === "incident.confirmed" &&
      ((Array.isArray(e.payload.affected) && e.payload.affected.includes(h.id)) || e.affectedServiceIds?.includes(h.serviceId))));
  const overlappingFaults = faults.filter(fault => {
    const resolution = dated.find(e => e.occurredAt >= fault.occurredAt && (
      fault.type === "case.opened"
        ? e.subject === h.id && e.type === "case.closed" && e.payload.caseId === fault.payload.caseId
        : fault.type === "incident.confirmed"
          ? e.type === "incident.cleared" && e.payload.incidentId === fault.payload.incidentId
          : e.subject === h.id &&
            ["service.restored_observed", "service.reprofiled"].includes(e.type) && e.payload.lineTest === "passed"
    ));
    return !resolution || Date.parse(resolution.occurredAt) >= faultWindowStart;
  });
  const faultWindow = gate("fault-window", "Approval’s fault-free window",
    Number.isFinite(faultFreeDays) && faultFreeDays > 0 ? overlappingFaults.length === 0 : null,
    Number.isFinite(faultWindowStart)
      ? `Checked ${new Date(faultWindowStart).toISOString()} to ${time}: ${overlappingFaults.length} recorded fault interval(s) overlap the required ${faultFreeDays} days.`
      : "Approval has no enforceable fault-free interval.",
    "policy.offer_approved");
  faultWindow.evidenceIds.push(...faults.map(e => e.id), ...dated.filter(e => ["case.closed", "incident.cleared", "service.restored_observed"].includes(e.type)).map(e => e.id));
  propose(
    "offer",
    "commercial.relevance",
    h.offerSignal ? "Offer a TV upgrade with sport" : "Recommend another product",
    "commercial",
    h.offerSignal && h.offersAllowed && h.offerApproved ? "offer" : "hold",
    h.offerSignal && h.offersAllowed && h.offerApproved
      ? `${h.offerSignal} ${h.name.split(" ")[0]} opted in to offers, and this offer was signed off in advance for customers like this.`
      : "This service signal carries no product mandate. A commercial action needs relevant intent and separate authority.",
    "Service obligations are clear and relevant commercial intent and authority are recorded.",
    h.offerSignal ? "Send one relevant offer in the app; if it is ignored, nothing changes." : "No commercial message is sent.",
    [
      ["Commercial relevance", 15],
      ["Evidence of interest", h.offerSignal ? 40 : 0],
    ],
    [
      gate(
        "service",
        "Service obligations clear",
        !open && !obligation && (!h.incident || cleared),
        open || obligation || (h.incident && !cleared)
          ? "An unresolved service relationship takes precedence."
          : "No unresolved obligation recorded.",
        "case.opened",
        "case.closed",
        "promise.created",
        "incident.confirmed",
        "incident.cleared",
        "customer.confirmed_working",
      ),
      faultWindow,
      gate(
        "intent",
        "Relevant product intent",
        h.offerSignal ? true : null,
        h.offerSignal ?? "No relevant product intent recorded.",
        "usage.pattern",
      ),
      gate(
        "commercial",
        "Commercial contact authority",
        h.offersAllowed && h.offerApproved ? true : null,
        h.offersAllowed && h.offerApproved
          ? "The customer opted in to offers, and this offer was signed off in advance by the Memory & Trust Officer."
          : "Service contact authority does not grant commercial permission.",
        "preference.offers_opt_in",
        "policy.offer_approved",
      ),
      once("offer"),
    ],
    [],
  );
  propose(
    "monitor",
    "network.assurance",
    "Keep the extra monitoring running",
    "observation",
    "watch",
    "The line was re-profiled on Friday and remains under heightened monitoring until Monday 28 September at 21:12 BST. No drops so far, and nothing new to tell the customer.",
    "Any drop, or the end of the monitoring window.",
    "Keep watching the line; send nothing while there is nothing to say.",
    [["Heightened monitoring", 104]],
    [
      gate("active", "Heightened monitoring running", h.monitoring === "active", h.monitoring === "active" ? "Started after Friday’s re-profile." : "No heightened monitoring running.", "monitoring.started"),
      gate("stable", "No new fault", !contraryTest && h.restored, "No drop or failed test since the fix.", "monitoring.checked"),
      gate("after", "The customer has already been thanked", done("confirmation"), done("confirmation") ? "The customer confirmed the fix, and we thanked them." : "The customer’s confirmation is still to be acknowledged.", "customer.confirmed_working"),
    ],
    refs("monitoring.started", "monitoring.checked", "service.reprofiled"),
  );
  propose(
    "monitor-close",
    "network.assurance",
    "Close the extra checks and tell the customer",
    "recovery",
    "complete",
    "The full 72-hour monitoring window ended without drops. Its dated completion record is now available.",
    "A new fault report opens a fresh assessment.",
    "Record the completed monitoring and closed case; send one short follow-up note.",
    [["Monitoring complete", 112]],
    [
      gate("complete", "Heightened monitoring finished", h.monitoring === "complete", h.monitoring === "complete" ? "No drops across the monitoring window." : "Monitoring still running or not started.", "monitoring.completed"),
      gate("case_closed", "Formal case closure recorded", h.caseStatus !== "open" && h.evidence.some(e => e.type === "case.closed"), "The completed checks and the dated case closure are separate records.", "case.closed"),
      gate("stable", "No new fault", !contraryTest, "No failed test since the fix.", "service.failure_observed"),
      once("monitor-close"),
    ],
    refs("monitoring.completed", "case.closed", "service.reprofiled"),
  );
  propose(
    "quiet-fix-note",
    "care.proactive",
    "Tell the customer about a fix they didn’t notice",
    "care",
    "inform",
    quietHours
      ? "A fault was fixed while the household was asleep. It waits until their quiet hours end."
      : "A routine overnight test found the line degrading, and a remote re-profile fixed it before anyone noticed. Worth telling them, outside their quiet hours, in the app.",
    "The household’s quiet hours end.",
    "Send one short note in the app: what we found, what we fixed, nothing to do.",
    [["Proactive fix", 108]],
    [
      gate("fixed", "A fault found and fixed without the customer", h.quietFix === "fixed", h.quietFix === "fixed" ? "Found by a routine test; fixed remotely." : "No quiet fix on record.", "line.degradation_detected", "service.reprofiled"),
      gate("hours", "Outside the household’s quiet hours", !quietHours, quietHours ? "Inside their stated quiet hours." : "Their quiet hours have ended.", "preference.stated"),
      once("quiet-fix-note"),
    ],
    refs("line.degradation_detected", "service.reprofiled"),
  );
  propose(
    "early-life",
    "activation.early_life",
    `Help set up ${h.unused?.join(" and ") ?? "what’s included"}`,
    "activation",
    "guide",
    `${h.name.split(" ")[0]}’s broadband works. ${h.unused?.join(" and ")} ${h.unused && h.unused.length > 1 ? "are" : "is"} included in the plan but not set up yet. Help now, so they use everything they pay for.`,
    "The products are set up, or the customer asks us to stop.",
    "Send a short setup guide in the app, one step at a time.",
    [["Early-life guidance", 106]],
    [
      gate("connected", "Broadband working", h.firstUseObserved === true, "First connection observed.", "activation.first_use_observed"),
      gate("unused", "Included products not set up", !!h.unused?.length, h.unused?.length ? `Not set up: ${h.unused.join(", ")}.` : "Everything included is set up.", "early_life.checkpoint"),
      once("early-life"),
    ],
    refs("early_life.checkpoint"),
  );
  propose(
    "early-life-complete",
    "activation.early_life",
    "Early life complete: everything in use",
    "activation",
    "complete",
    `Broadband, TV and Netflix are all set up and being used. The early-life journey is complete.`,
    "A new fault or support request.",
    "Send one note confirming everything is set up; stop setup guidance.",
    [["Early life complete", 107]],
    [
      gate("all", "Everything included is set up", !!h.unused && h.unused.length === 0, "Every included product is active.", "product.activated"),
      gate("used", "In use by the household", !!h.engaged, h.engaged ? "Watched across the household since Saturday." : "Not yet used.", "usage.observed"),
      once("early-life-complete"),
    ],
    refs("product.activated", "usage.observed"),
  );
  propose(
    "steady",
    "behaviour.observation",
    "Nothing to do: all healthy",
    "observation",
    "watch",
    "No open case, promise or fault, and nothing new that needs the customer. The right action is none.",
    "Any new signal.",
    "No action and no message.",
    [["Baseline", 5]],
    [gate("clear", "Nothing outstanding", !open && !obligation && !contraryTest && (!h.incident || cleared), "No open case, promise or unresolved fault.", "case.opened", "promise.created")],
    [],
  );
  propose(
    "engineer",
    "field.dispatch",
    "Book an engineer visit",
    "field",
    "hold",
    h.incident
      ? `${incidentId} explains the fault. A home visit would not fix a network issue, so the request is withdrawn before anyone has to decline it.`
      : open && h.restartTried
        ? "Repeat drops, the earlier restart failed and the cause is unconfirmed. A home visit is the next useful test."
        : "No repeat fault after a failed local test. A visit is not justified.",
    "A named approver signs off, or new evidence removes the need.",
    "Reserve a field slot only after sign-off. Nothing is booked automatically.",
    [
      ["Repeat fault", open && h.restartTried ? 30 : 0],
      ["Failed local test", h.restartTried ? 20 : 0],
      ["Field cost", -20],
    ],
    [
      gate(
        "repeat",
        "Repeat fault after a failed local test",
        open && h.restartTried,
        open && h.restartTried ? "Open case with a failed restart on record." : "No failed local test on an open case.",
        "case.opened",
        "diagnostic.completed",
      ),
      gate(
        "local",
        "Fault not explained by the network",
        !h.incident,
        h.incident ? `Service is inside ${incidentId}.` : "No confirmed incident covers this service.",
        "incident.confirmed",
      ),
      gate(
        "unresolved",
        "Service not yet restored",
        !h.restored,
        h.restored ? "A fresh restoration observation removes the need." : "No restoration observed.",
        "service.restored_observed",
      ),
      gate(
        "signoff",
        "Named sign-off",
        null,
        `Only ${h.owner || "the case owner"} with the field scheduling lead may book a visit.`,
      ),
    ],
    refs("diagnostic.completed", "case.opened"),
  );
  // Eligible on the evidence, but only a person may authorise it: it waits rather than runs.
  for (const c of candidates)
    if (c.checks.find((k) => k.id === "signoff") && c.checks.every((k) => k.id === "signoff" || k.state === "pass")) c.status = "awaiting";
  const owner = h.owner || "the care team";
  // Authority comes from the policy register, resolved to the named owner.
  for (const c of candidates) c.authority = authorityFor(c.id, h.owner, !!obligation);
  // Routine moments: removing friction is a pure win. Load-bearing: a person must be visibly accountable.
  const moment: MomentKind = contraryTest
    ? { kind: "load-bearing", why: "The customer’s word and the latest test disagree. A person reconciles them." }
    : h.confirmed
      ? { kind: "routine", why: "The customer confirmed it works. Closing the loop is routine; the history stays attached." }
      : obligation
        ? { kind: "load-bearing", why: `${owner} promised a ${due} callback. A named person stays accountable; automation supports them rather than replacing them.` }
        : open && h.restartTried
          ? { kind: "load-bearing", why: "A repeat fault the customer has already chased. A named owner stays on it." }
          : h.quietFix === "fixed"
            ? { kind: "routine", why: "The remote fix is verified. Send a short note after quiet hours so the customer knows what changed." }
          : quiet
            ? { kind: "routine", why: "Normal for this household. Removing friction here means saying nothing." }
            : delivered
              ? { kind: "routine", why: "A first-week activation check. Fast and automatic is the win; nobody needs to call." }
              : { kind: "routine", why: "No commitment or repeat fault is open. Keep it simple and automatic." };

  // "Nothing to do" is only a fallback: it steps aside whenever a real plan applies.
  const steady = candidates.find((c) => c.id === "steady");
  if (steady && candidates.some((c) => c.id !== "steady" && c.status === "held")) {
    steady.status = "blocked";
    steady.checks.push({ id: "fallback", label: "No other plan applies", state: "fail", detail: "Another plan applies, so doing nothing is not the choice.", evidenceIds: [] });
  }
  candidates.sort((a, b) => b.priority - a.priority);
  const winner = candidates.find((c) => c.status === "held");
  if (!winner) throw new Error("No eligible service disposition");
  winner.status = "selected";
  for (const c of candidates) {
    if (
      (winner.id === "incident" &&
        ((c.id === "recovery" && open && !delivered) ||
          (c.id === "activation" && delivered))) ||
      (c.id === "callback" && (!!h.promise || !!h.owner))
    )
      c.status = "merged";
  }
  const order = { selected: 0, merged: 1, awaiting: 2, held: 3, blocked: 4 };
  candidates.sort(
    (a, b) => order[a.status] - order[b.status] || b.priority - a.priority,
  );
  const triggerIds = h.evidence
    .filter((e) => e.revision === revision)
    .map((e) => e.id);
  const fields: (keyof Household)[] = [
    "serviceState",
    "incident",
    "caseStatus",
    "owner",
    "promise",
    "promiseFulfilled",
    "restored",
    "confirmed",
    "activation",
    "firstUseObserved",
    "contactAllowed",
    "incidentCleared",
    "habit",
    "restartTried",
    "reprofiled",
    "monitoring",
    "quietFix",
    "unused",
    "engaged",
    "offerSignal",
    "offersAllowed",
    "offerApproved",
  ];
  const previous = snapshot.decisions.filter((d) => d.person === h.id).at(-1);
  return {
    id: randomUUID(),
    person: h.id,
    revision,
    time,
    title: winner.title,
    domain: winner.domain,
    disposition: winner.disposition,
    reason: winner.reason,
    evidenceIds: [...new Set([...winner.evidenceIds, ...triggerIds])],
    held: candidates
      .filter((c) => c.status !== "selected")
      .map((c) => ({ title: c.title, reason: c.reason, wake: c.wake })),
    policyVersion: "bt-context-v2.2",
    moment,
    trace: {
      version: 1,
      triggerIds,
      selectedId: winner.id,
      previousDecisionId: previous?.id || null,
      candidates,
      changes: fields
        .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(h[field]))
        .map((field) => ({
          field,
          before: String(before[field] ?? "—"),
          after: String(h[field] ?? "—"),
          evidenceIds: triggerIds,
        })),
      execution: [],
    },
  };
}

/** The owner made a still-open promise to this customer within the last half hour. */
function justSpoken(h: Household, at: string) {
  const promised = h.evidence.filter((e) => e.type === "promise.created").at(-1);
  return (
    !!promised &&
    !!h.promise &&
    !h.promiseFulfilled &&
    Date.parse(at) - Date.parse(promised.occurredAt) <= 30 * 60e3
  );
}

export function serviceMessage(
  h: Household,
  d: Decision,
): { key: string; title: string; body: string } | null {
  if (!h.contactAllowed || ["watch", "suppress"].includes(d.disposition))
    return null;
  // Recovery work right after the owner's own promise stays on the case, not the phone.
  if (d.trace?.selectedId === "recovery" && justSpoken(h, d.time)) return null;
  const selected = d.trace!.selectedId;
  const callback =
    h.promise && !h.promiseFulfilled
      ? ` ${h.owner || "Your care team"} will still call at ${clock(h.promise)}, as promised.`
      : "";
  switch (selected) {
    case "monitor-close": {
      return {
        key: "monitor-closed",
        title: "Your 72-hour line check completed",
        body: "The extra monitoring after your 25 September fix completed on 28 September with no drops. Your case is closed. If you notice a new problem, let us know.",
      };
    }
    case "quiet-fix-note":
      return {
        key: "quiet-fix",
        title: "We fixed something overnight",
        body: "While you were asleep, a routine check found your line getting weaker. We fixed it remotely before it caused a problem. There’s nothing you need to do.",
      };
    case "early-life":
      return {
        key: "early-life",
        title: `Let’s get your ${h.unused?.join(" and ") ?? "extras"} set up`,
        body: `Your broadband is working. ${h.unused?.join(" and ")} ${h.unused && h.unused.length > 1 ? "are" : "is"} included in your plan too. I can walk you through it, one step at a time: it takes about five minutes.`,
      };
    case "early-life-complete":
      return {
        key: "early-life-done",
        title: "You’re all set up",
        body: "Broadband, BT TV and Netflix are all working, and your household has already watched 11 hours. If anything stops working, we’ll usually spot it before you do.",
      };
    case "offer":
      return {
        key: "offer",
        title: "Sport on the big screen?",
        body: "Your household has watched live sport through apps on most weekends. You could add TNT Sports to your BT TV and watch it on the living-room TV, first month free, then £25 a month. Want to try it? If not, nothing changes.",
      };
    case "first-use":
      return { key: "first-use", title: "You’re connected",
        body: "Your broadband is active and we’ve now observed a successful connection. You don’t need to repeat the setup steps. Your activation history is here if you need us." };
    case "confirmation":
      return {
        key: "confirmed",
        title: `Thanks for confirming, ${h.name.split(" ")[0]}`,
        body: "Thanks for confirming your connection is working again. We’ve recorded your reply; your case and any extra monitoring stay with the care team until the checks are complete.",
      };
    case "restoration":
      return {
        key: "restored",
        title: "Your connection is back",
        body: `We can see your line has recovered.${callback} Let us know whether everything is working for you.`,
      };
    case "incident":
      if (h.activation.includes("unconfirmed"))
        return {
          key: "incident",
          title: "Hold off setting up for now",
          body: "A network issue in your area is stopping new connections. There’s nothing wrong with your hub. We’ll tell you as soon as you can go ahead.",
        };
      return {
        key: "incident",
        title: "We’ve linked this to a network issue",
        body: `A confirmed network issue affects your service.${callback}${h.restartTried ? " There’s no need to repeat your earlier restart." : " Your care team is coordinating the next steps."}`,
      };
    case "activation":
      if (h.incidentCleared)
        return {
          key: "setup-go",
          title: "You can set up your hub now",
          body: "The network issue in your area is fixed. Switch your hub off and on again and it should connect within a few minutes. We’ll confirm once we can see it working.",
        };
      if (h.evidence.some((e) => e.type === "router.setup_attempted"))
        return {
          key: "activation",
          title: "We can see you’re setting up",
          body: "Your new hub is switched on but hasn’t connected yet. We’re checking your line is ready before asking you to try anything else. Your activation team has the case.",
        };
      return {
        key: "activation",
        title: "Let’s get your connection started",
        body: "Your hub has arrived. We’re checking your activation before asking you to try setup steps. Your activation team has the case.",
      };
    default:
      return {
        key: "recovery",
        title: "We’re keeping track of this",
        body: `We have your earlier information, ${h.name.split(" ")[0]}.${callback} ${h.owner || "Your care team"} is looking after the investigation. You won’t need to start again.`,
      };
  }
}
