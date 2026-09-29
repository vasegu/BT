import type { NetworkView, PersonId, Snapshot, SourceEvent } from "./types";
import { householdNames } from "./presentation";
import { rhythmGrid } from "./Rhythm";

// Denser operational sections, each tied to a claim in the pitch and built only from recorded
// events and tables as of the scenario clock.
const HOUR = 3600e3;
const people: PersonId[] = ["daniel", "sam", "maya"];
const at = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const tint: Record<PersonId, string> = { daniel: "#5514b4", sam: "#0f7b5f", maya: "#a15c07" };
const first = (p: PersonId) => householdNames[p].split(" ")[0];
const OPS = new Set(["router_simulator", "network_simulator", "diagnostics_simulator", "workforce_simulator", "orders_simulator"]);
const ROUTINE = new Set(["router.observation_window", "router.overnight_window"]);

/** "A memory which only updates in a nightly batch job decays into a liability." */
export function LiveNotNightly({ snapshot, inspect }: { snapshot: Snapshot; inspect: (e: SourceEvent) => void }) {
  const clock = Date.parse(snapshot.clock);
  const tonight = snapshot.events.filter(
    (e) => OPS.has(e.source) && !ROUTINE.has(e.type) && Date.parse(e.receivedAt) <= clock && Date.parse(e.receivedAt) > clock - 3 * HOUR,
  );
  // The next 02:00 London run after each signal happened.
  const nightly = (iso: string) => {
    const d = new Date(iso);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (d.getUTCHours() >= 1 ? 1 : 0), 1, 0);
    return next;
  };
  const lags = tonight.map((e) => Date.parse(e.receivedAt) - Date.parse(e.occurredAt));
  const worstBatch = Math.max(0, ...tonight.map((e) => nightly(e.occurredAt) - Date.parse(e.occurredAt)));
  const mins = (ms: number) => (ms < 60e3 ? "0 min" : `${Math.round(ms / 60e3)} min`);
  return (
    <div className="ops-fresh">
      <div className="ops-kpis">
        <div>
          <b>{tonight.length}</b>
          <span>operational signals tonight</span>
        </div>
        <div>
          <b>{lags.length ? mins(Math.max(...lags)) : "—"}</b>
          <span>slowest to reach the system</span>
        </div>
        <div className="is-batch">
          <b>{tonight.length ? `${Math.round(worstBatch / HOUR)} h` : "—"}</b>
          <span>a nightly batch would have added</span>
        </div>
      </div>
      <table className="ops-table">
        <thead>
          <tr>
            <th>Signal</th>
            <th>Happened</th>
            <th>System knew</th>
            <th>Nightly batch</th>
          </tr>
        </thead>
        <tbody>
          {[...tonight].reverse().slice(0, 7).map((e) => (
            <tr key={e.id} onClick={() => inspect(e)}>
              <td>
                <code>{e.type}</code>
                <small>{e.subject === "shared" ? "network" : first(e.subject as PersonId)}</small>
              </td>
              <td>{at(e.occurredAt)}</td>
              <td className="is-live">{at(e.receivedAt)}</td>
              <td className="is-batch">02:00 · +{Math.round((nightly(e.occurredAt) - Date.parse(e.occurredAt)) / HOUR)}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "A constant, low-level diagnostic signal from every connected router." */
export function RouterTelemetry({ snapshot, focus }: { snapshot: Snapshot; focus: PersonId }) {
  const clock = Date.parse(snapshot.clock);
  return (
    <div className="ops-telemetry">
      {people.map((p) => {
        const r = rhythmGrid(snapshot, p, 7);
        const windows = snapshot.events.filter(
          (e) => e.subject === p && e.type === "router.observation_window" && Date.parse(e.receivedAt) > clock - 24 * HOUR && Date.parse(e.receivedAt) <= clock,
        );
        const exp = windows.reduce((a, e) => a + (Number((e.payload as { expected?: number }).expected) || 0), 0);
        const got = windows.reduce((a, e) => a + (Number((e.payload as { received?: number }).received) || 0), 0);
        const heard = snapshot.events
          .filter(
            (e) =>
              e.subject === p &&
              Date.parse(e.receivedAt) <= clock &&
              (e.type === "router.heartbeat_received" ||
                (e.type === "activation.first_use_observed" && e.revision > 0) ||
                (e.type === "router.observation_window" && Number((e.payload as { received?: number }).received) > 0)),
          )
          .at(-1);
        const lastHeard = heard
          ? heard.type === "router.observation_window"
            ? String((heard.payload as { intervalEnd?: string }).intervalEnd ?? heard.occurredAt)
            : heard.occurredAt
          : null;
        return (
          <article key={p} className={`ops-router${p === focus ? " is-focus" : ""}`}>
            <header>
              <i style={{ background: tint[p] }} />
              <b>{first(p)}</b>
              <span>{exp ? `${Math.round((got / exp) * 100)}% heartbeats · 24h` : "no windows"}</span>
            </header>
            {r && (
              <div className="ops-mini" style={{ gridTemplateColumns: `repeat(${r.grid[0].length}, 1fr)` }}>
                {r.grid.flatMap((row, i) => row.map((c, d) => <i key={`${i}-${d}`} className={`rc rc-${c.state}${c.state === "now" && r.quietNow ? " is-quiet" : ""}`} style={c.state === "partial" ? { opacity: 0.35 + c.ratio * 0.5 } : undefined} />))}
              </div>
            )}
            <p>{r?.summary.replace(" for 30 days", " all week").replace("last 30 nights", "last 7 nights")}</p>
            <small>
              {heard?.type === "activation.first_use_observed"
                ? `first connection ${day(heard.occurredAt)} ${at(heard.occurredAt)}`
                : lastHeard
                  ? `last heartbeat ${day(lastHeard)} ${at(lastHeard)}`
                  : "never heard from"}
            </small>
          </article>
        );
      })}
    </div>
  );
}

/** Moment 1: "notices non-activation as it happens and treats it as a trigger". */
export function Provisioning({ snapshot, focus }: { snapshot: Snapshot; focus: PersonId }) {
  const clock = Date.parse(snapshot.clock);
  const stages = [
    ["order.accepted", "Ordered"],
    ["order.dispatched", "Dispatched"],
    ["order.delivered", "Delivered"],
    ["activation.confirmed", "Activated"],
    ["activation.first_use_observed", "First use"],
  ] as const;
  return (
    <div className="ops-pipes">
      {people.map((p) => {
        const mine = snapshot.events.filter((e) => e.subject === p && Date.parse(e.receivedAt) <= clock);
        // The most recent order chain for this household's broadband.
        const accepted = mine.filter((e) => e.type === "order.accepted").at(-1);
        const chain = mine.filter((e) => accepted && Date.parse(e.occurredAt) >= Date.parse(accepted.occurredAt));
        const reached = stages.map(([type]) => chain.find((e) => e.type === type));
        const delivered = reached[2],
          activated = reached[3];
        const stalled = delivered && !activated ? Math.floor((clock - Date.parse(delivered.occurredAt)) / (24 * HOUR)) : null;
        // Even once resolved, a slow activation stays visible: it is the Moment 1 story.
        const firstUse = reached[4];
        const gap = delivered && firstUse ? Math.floor((Date.parse(firstUse.occurredAt) - Date.parse(delivered.occurredAt)) / (24 * HOUR)) : 0;
        return (
          <div key={p} className={`ops-pipe${p === focus ? " is-focus" : ""}${stalled !== null || gap >= 2 ? " is-stalled" : ""}`}>
            <span className="ops-pipe-who">
              <i style={{ background: tint[p] }} />
              {first(p)}
            </span>
            <ol>
              {stages.map(([, label], i) => (
                <li key={label} className={reached[i] ? "is-done" : ""}>
                  <span>{label}</span>
                  <small>{reached[i] ? day(reached[i]!.occurredAt) : "—"}</small>
                </li>
              ))}
            </ol>
            <em>
              {stalled !== null
                ? `${stalled} day${stalled === 1 ? "" : "s"} since delivery · not activated`
                : gap >= 2
                  ? `First use ${gap} days after delivery`
                  : reached[4]
                  ? "In use"
                  : activated
                    ? "Active"
                    : "No order on record"}
            </em>
          </div>
        );
      })}
    </div>
  );
}

/** Moment 4: "one household, several products, one relationship". */
export function Households({ net, focus }: { net: NetworkView; focus: PersonId }) {
  return (
    <div className="ops-households">
      {(net.households ?? []).map((hh) => (
        <article key={hh.label} className={hh.person === focus ? "is-focus" : ""}>
          <header>
            {hh.person && <i style={{ background: tint[hh.person] }} />}
            <b>{hh.label}</b>
          </header>
          <div className="ops-members">
            {hh.members.map((m) => (
              <span key={m.name}>
                {m.name}
                <small>since {day(m.since)}</small>
              </span>
            ))}
          </div>
          <div className="ops-products">
            {hh.services.map((s) => (
              <span key={s.reference} className={`is-${s.product}`}>
                {s.product}
                <small>{s.lifecycle}</small>
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
