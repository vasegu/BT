import type { Decision, Household, Snapshot } from "./types";
import { moments } from "./presentation";
import "./decision-flow.css";

// Three memories in, one decision out: the simple version of the arbiter, for the room.
const at = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

type Fact = { text: string; weight?: "high" | "low" };

function memoryFacts(h: Household): Fact[] {
  const first = h.name.split(" ")[0];
  const out: Fact[] = [];
  if (h.caseStatus === "open" && h.owner && h.owner !== "Activation team")
    out.push({ text: `Open case with ${h.owner}; line dropping since before tonight`, weight: "high" });
  if (h.promise && !h.promiseFulfilled) out.push({ text: `${h.owner ?? "Adviser"} promised a call at ${at(h.promise)}`, weight: "high" });
  if (h.promise && h.promiseFulfilled) out.push({ text: `${h.owner ?? "Adviser"} kept the ${at(h.promise)} call` });
  if (h.restartTried && !h.restored) out.push({ text: "A restart was already tried and failed", weight: "high" });
  if (h.activation.includes("unconfirmed")) out.push({ text: "New hub delivered; never connected", weight: "high" });
  if (h.firstUseObserved) out.push({ text: "First connection observed tonight", weight: "high" });
  if (h.habit) out.push({ text: `Told us: “${h.habit}”`, weight: "high" });
  const linked = h.linkedServices?.find((s) => s.recent);
  if (linked) out.push({ text: "Their linked mobile is in normal use at home" });
  if (h.restored) out.push({ text: "Connection seen working again" });
  if (h.confirmed) out.push({ text: `${first} confirmed it works`, weight: "high" });
  if (!out.length) out.push({ text: "Nothing on record that changes the response", weight: "low" });
  return out;
}

function operationsFacts(h: Household, s: Snapshot): Fact[] {
  const out: Fact[] = [];
  const signals = s.events.filter((e) => e.revision === s.cutoff && s.cutoff > 0 && (e.subject === h.id || e.subject === "shared"));
  const labels: Record<string, string> = {
    "router.heartbeat_overdue": "Router went quiet",
    "router.setup_attempted": "Hub switched on, not connected",
    "router.heartbeat_received": "Hub back online",
    "service.restored_observed": "Line test passed",
    "incident.confirmed": "Network incident confirmed",
    "incident.cleared": "Network incident cleared",
    "activation.first_use_observed": "First connection observed",
    "promise.fulfilled": "Adviser’s call logged",
    "customer.confirmed_working": "Customer reply received",
  };
  const fresh = [...new Set(signals.map((e) => labels[e.type]).filter(Boolean))];
  if (fresh.length) out.push({ text: `New at ${moments[s.cutoff].time}: ${fresh.join(", ").toLowerCase()}`, weight: "high" });
  const inc = s.operations.incident;
  if (inc)
    out.push(
      h.incident
        ? { text: h.incidentCleared ? `${inc.id} cleared; this line was inside it` : `${inc.id}: this line is inside the affected area`, weight: "high" }
        : { text: `${inc.id}: this line is outside it`, weight: "high" },
    );
  else out.push({ text: "No confirmed network incident", weight: "low" });
  const free = s.operations.slots.filter((x) => !x.person && !x.owner).length;
  if (free) out.push({ text: `${free} callback slot${free === 1 ? "" : "s"} free tonight`, weight: "low" });
  return out;
}

function governanceFacts(h: Household, d: Decision): Fact[] {
  const out: Fact[] = [];
  const chosen = d.trace?.candidates.find((c) => c.id === d.trace?.selectedId);
  if (d.moment) out.push({ text: `${d.moment.kind === "routine" ? "Routine moment" : "Load-bearing moment"}: ${d.moment.why}`, weight: "high" });
  if (chosen?.authority)
    out.push({
      text:
        chosen.authority.mode === "autonomous"
          ? "This action may run on its own"
          : chosen.authority.mode === "human-led"
            ? `${chosen.authority.role} leads; the system supports`
            : `Needs sign-off from ${chosen.authority.role}`,
    });
  out.push({ text: h.contactAllowed ? "In-app service messages permitted" : "No permission to message", weight: h.contactAllowed ? "low" : "high" });
  for (const c of d.trace?.candidates.filter((x) => x.status === "awaiting") ?? [])
    out.push({ text: `${c.title} waits for ${c.authority?.role ?? "a person"}`, weight: "high" });
  return out;
}

export function DecisionFlow({ h, snapshot, decision, compact = false }: { h: Household; snapshot: Snapshot; decision?: Decision; compact?: boolean }) {
  if (!decision)
    return (
      <section className="df df-empty">
        <p>No decision yet. At {moments[1].time} the first signal arrives, and this shows how the three memories combine.</p>
      </section>
    );
  const message = snapshot.actions.find((a) => a.decisionId === decision.id);
  const chosen = decision.trace?.candidates.find((c) => c.id === decision.trace?.selectedId);
  const alternatives = (decision.trace?.candidates ?? []).filter((c) => c.id !== chosen?.id && c.status !== "merged").slice(0, 3);
  const columns: [string, string, Fact[]][] = [
    ["Customer memory", `What we know about ${h.name.split(" ")[0]}`, memoryFacts(h)],
    ["Operational memory", "What is happening on the network", operationsFacts(h, snapshot)],
    ["Governance", "What we are allowed to do", governanceFacts(h, decision)],
  ];
  return (
    <section className={`df${compact ? " is-compact" : ""}`} aria-label="How the three memories combine into this decision">
      <div className="df-inputs">
        {columns.map(([name, sub, facts]) => (
          <article key={name} className="df-input">
            <header>
              <b>{name}</b>
              <small>{sub}</small>
            </header>
            <ul>
              {facts.map((f, i) => (
                <li key={i} className={f.weight === "high" ? "is-key" : f.weight === "low" ? "is-quiet" : ""}>
                  {f.text}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="df-arrow" aria-hidden="true">
        <span>Arbiter</span>
      </div>
      <article className="df-decision">
        <span className="eyebrow">Decision · {moments[decision.revision]?.time}</span>
        <h3>{decision.title}</h3>
        <p>{decision.reason}</p>
        <dl>
          <div>
            <dt>What happens next</dt>
            <dd>{chosen?.effect ?? "—"}</dd>
          </div>
          <div>
            <dt>{h.name.split(" ")[0]} sees</dt>
            <dd>{message ? `“${message.title}”` : "Nothing new on the phone, by design"}</dd>
          </div>
        </dl>
        {alternatives.length > 0 && (
          <details className="df-why-not">
            <summary>Why not something else?</summary>
            <ul>
              {alternatives.map((c) => (
                <li key={c.id}>
                  <b>{c.title}</b>
                  <span>{c.status === "awaiting" ? `Waits for ${c.authority?.role ?? "a person"}.` : (c.checks.find((k) => k.state !== "pass")?.detail ?? c.reason)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </article>
    </section>
  );
}
