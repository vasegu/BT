import { useState } from "react";
import type { Household, Snapshot, SourceEvent } from "./types";
import "./operations.css";
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
const age = (iso: string, clock: string) =>
  `${Math.max(0, Math.floor((Date.parse(clock) - Date.parse(iso)) / 60_000))}m ago`;

export function OperationalMemory({
  h,
  snapshot,
  inspect,
  onCutoff,
}: {
  h: Household;
  snapshot: Snapshot;
  inspect: (event: SourceEvent) => void;
  onCutoff: (at: number) => void;
}) {
  const [selected, setSelected] = useState(h.id);
  const person = snapshot.households.find((p) => p.id === selected) || h;
  const shared = snapshot.events.filter((e) => e.subject === "shared");
  const incident = snapshot.operations.incident;
  const register = shared.filter((e) => e.type === "incident.confirmed").at(-1);
  const rota = shared.filter((e) => e.type === "capacity.recorded").at(-1);
  const observations = snapshot.events.filter(
    (e) =>
      e.subject === person.id &&
      /^(router\.|service\.|activation\.|order\.)/.test(e.type),
  );
  const latest = observations.at(-1);
  const free = snapshot.operations.slots.filter(
    (s) => !s.owner && !s.person,
  ).length;
  const labels = [
    "20:45 · Before the signal",
    "21:00 · Signal received",
    "21:03 · Incident scoped",
    "21:12 · Recovery observed",
    "21:15 · Callback kept",
    "21:18 · Customer confirmed",
  ];
  return (
    <div className="operational-memory ops-state">
      <div className="om-summary">
        <div>
          <span className="eyebrow">
            SHARED CONTEXT → SERVICE SCOPE → ACTION CONSTRAINTS
          </span>
          <h2>What can we safely act on?</h2>
          <p>
            Network scope, source freshness and available people. Customer
            history joins this context in the arbiter.
          </p>
        </div>
        <label className="om-replay">
          Read the recorded state
          <select
            value={snapshot.cutoff}
            onChange={(e) => onCutoff(Number(e.target.value))}
          >
            {labels.slice(0, snapshot.session.revision + 1).map((label, i) => (
              <option value={i} key={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="ops-grid">
        <section className="om-panel ops-network">
          <header className="om-panel-heading">
            <h2>
              <span>01</span>Network context
            </h2>
            <code>EXPLICIT MEMBERSHIP</code>
          </header>
          <div className="om-scroll ops-network-body">
            <div className="ops-register">
              <div>
                <span className="eyebrow">Affected-service register</span>
                <h3>{incident?.id || "No confirmed incident"}</h3>
                <p>
                  {incident
                    ? incident.status
                    : "Missing heartbeats are individual signals. Shared cause remains unknown."}
                </p>
              </div>
              <div className="ops-count">
                <strong>{incident?.affected.length ?? "—"}</strong>
                <small>SERVICES IN SCOPE</small>
              </div>
            </div>
            <div className="ops-network-map">
              <svg
                preserveAspectRatio="none"
                viewBox="0 0 650 98"
                aria-label="Explicit incident scope links to three services"
              >
                <path
                  d="M325 0V30M109 30H541M109 30V82M325 30V82M541 30V82"
                  fill="none"
                  stroke="#d8d0e6"
                  strokeWidth="1.5"
                />
                {snapshot.households.map((p, i) => (
                  <g key={p.id}>
                    <path
                      d={`M325 0V30H${109 + i * 216}V82`}
                      fill="none"
                      stroke={incident && p.incident ? "#7552a5" : "#d8d0e6"}
                      strokeWidth={incident && p.incident ? 2 : 1}
                      strokeDasharray={
                        !incident || !p.incident ? "3 5" : undefined
                      }
                    />
                    <circle
                      cx={109 + i * 216}
                      cy="82"
                      r="5"
                      fill={incident && p.incident ? "#7552a5" : "white"}
                      stroke="#b4a5ca"
                    />
                  </g>
                ))}
              </svg>
              <div className="ops-services">
                {snapshot.households.map((p) => (
                  <button
                    key={p.id}
                    aria-pressed={person.id === p.id}
                    onClick={() => setSelected(p.id)}
                  >
                    <span className="eyebrow">
                      {p.serviceId.replace("svc_", "")}
                    </span>
                    <strong>{p.name.split(" ")[0]}</strong>
                    <span
                      className={`ops-membership ${incident && p.incident ? "inside" : ""}`}
                    >
                      {incident
                        ? p.incident
                          ? "Included"
                          : "Explicitly outside"
                        : "Unconfirmed"}
                    </span>
                    <small>{p.serviceState}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="ops-boundary">
              <span>≠</span>
              <p>
                <strong>
                  Shared incident status and an individual line are separate.
                </strong>{" "}
                A recovered service does not close the incident. Proximity or
                similar telemetry does not establish membership.
              </p>
            </div>
            {register && (
              <button className="om-json" onClick={() => inspect(register)}>
                Inspect affected-service record{" "}
                <span>{time(register.occurredAt)} · JSON ↗</span>
              </button>
            )}
          </div>
        </section>
        <section className="om-panel ops-capacity">
          <header className="om-panel-heading">
            <h2>
              <span>02</span>Capacity & commitments
            </h2>
            <code>{free} FREE</code>
          </header>
          <div className="om-scroll">
            <div className="om-context-block">
              <span className="eyebrow">Callback rota</span>
              <p>
                A free slot permits a proposal. It does not create a customer
                promise.
              </p>
              {snapshot.operations.slots.map((slot) => {
                const owner = snapshot.households.find(
                  (p) => p.id === slot.person,
                );
                return (
                  <div className="om-slot" key={slot.time}>
                    <time>{slot.time}</time>
                    <span>
                      <strong>{slot.owner || "Available"}</strong>
                      <small>
                        {owner
                          ? `${owner.name.split(" ")[0]} · ${owner.promiseFulfilled ? "commitment fulfilled" : "existing reservation"}`
                          : "Unallocated · no commitment"}
                      </small>
                    </span>
                    <i className={slot.owner ? "reserved" : ""} />
                  </div>
                );
              })}
              {rota && (
                <button className="om-source" onClick={() => inspect(rota)}>
                  <span>
                    <code>{rota.type}</code>
                    <small>
                      {time(rota.occurredAt)} ·{" "}
                      {age(rota.occurredAt, snapshot.clock)}
                    </small>
                  </span>
                  <span>↗</span>
                </button>
              )}
            </div>
            <div className="om-context-block">
              <span className="eyebrow">Constraints passed to the arbiter</span>
              <ul className="ops-constraints">
                <li>Join the exact service to the current incident.</li>
                <li>Retain named ownership and outstanding promises.</li>
                <li>
                  Check available capacity before proposing another callback.
                </li>
                <li>
                  Require a new source record to change operational state.
                </li>
              </ul>
            </div>
          </div>
        </section>
        <section className="om-panel ops-records">
          <header className="om-panel-heading">
            <h2>
              <span>03</span>Source ledger
            </h2>
            <code>AS KNOWN {time(snapshot.clock)}</code>
          </header>
          <div className="om-scroll">
            <table className="ops-source-table">
              <thead>
                <tr>
                  <th>Source / observation</th>
                  <th>Occurred</th>
                  <th>Received</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {shared.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <button onClick={() => inspect(e)}>
                        <code>{e.type} ↗</code>
                        <span>{e.description}</span>
                      </button>
                    </td>
                    <td>{time(e.occurredAt)}</td>
                    <td>{time(e.receivedAt)}</td>
                    <td>{age(e.occurredAt, snapshot.clock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="om-chart-note">
            Age is elapsed time, not an invented freshness score. Replay uses
            only records already received at the selected cutoff.
          </p>
        </section>
        <section className="om-panel ops-service-detail">
          <header className="om-panel-heading">
            <h2>
              <span>04</span>
              {person.name.split(" ")[0]}’s service context
            </h2>
            <code>JOINED / NOT INFERRED</code>
          </header>
          <div className="om-scroll">
            <div className="om-context-block">
              <span className="eyebrow">Scope decision</span>
              <h3>
                {incident
                  ? person.incident
                    ? `Included in ${incident.id}`
                    : `Outside ${incident.id}`
                  : "Membership not established"}
              </h3>
              <p>
                {register
                  ? `The ${time(register.occurredAt)} register ${person.incident ? "includes" : "excludes"} this service.`
                  : "Do not promote a missing heartbeat into an area incident."}
              </p>
              <span className="eyebrow">Latest service observation</span>
              <h3>{latest?.type || "No observation"}</h3>
              <p>{latest?.description || "Waiting for telemetry."}</p>
              {latest && (
                <button className="om-source" onClick={() => inspect(latest)}>
                  <span>
                    <code>
                      {time(latest.occurredAt)} source →{" "}
                      {time(latest.receivedAt)} arrival
                    </code>
                    <small>
                      {age(latest.occurredAt, snapshot.clock)} · {latest.source}
                    </small>
                  </span>
                  <span>↗</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
      <div className="om-method">
        <span>
          <i /> Synthetic source records · real SQLite projections
        </span>
        <span>
          Operational conditions here · verification lives in Actions & outcomes
        </span>
      </div>
    </div>
  );
}
