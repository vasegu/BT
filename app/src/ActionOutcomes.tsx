import {
  BehaviourSpace,
  ContextContrasts,
  contrastNarrative,
  BehaviourInspector,
  useBehaviourSpace,
} from "./BehaviourSpace";
import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  Household,
  OutcomeEpisode,
  PersonId,
  Snapshot,
  SourceEvent,
} from "./types";
import "./operations.css";
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
const short = (id: string) => id.slice(0, 8);
const colors: Record<PersonId, string> = {
  daniel: "#7552a5",
  sam: "#af8245",
  maya: "#47837f",
};
const statusText = {
  waiting: "Awaiting proof",
  met: "Verified",
  unverified: "Verification due",
  contradicted: "Reassess",
};
const tone = (o: OutcomeEpisode): CSSProperties =>
  ({ "--person-tone": colors[o.person] }) as CSSProperties;
function Panel({
  title,
  number,
  note,
  children,
  className = "",
}: {
  title: string;
  number: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`om-panel ${className}`}>
      <header className="om-panel-heading">
        <h2>
          <span>{number}</span>
          {title}
        </h2>
        {note && <code>{note}</code>}
      </header>
      {children}
    </section>
  );
}
function EvidenceMap({
  rows,
  selected,
  select,
  snapshot,
}: {
  rows: OutcomeEpisode[];
  selected?: OutcomeEpisode;
  select: (id: string) => void;
  snapshot: Snapshot;
}) {
  const start = Math.min(...rows.map((o) => Date.parse(o.createdAt)));
  const end = Math.max(
    ...rows.map((o) => Date.parse(o.dueAt)),
    Date.parse(snapshot.clock),
  );
  const x = (iso: string) =>
    235 + ((Date.parse(iso) - start) / Math.max(end - start, 60_000)) * 375;
  const height = Math.max(210, 55 + rows.length * 31),
    now = x(snapshot.clock);
  return (
    <div className="om-map-scroll">
      <svg
        className="om-map"
        viewBox={`0 0 660 ${height}`}
        preserveAspectRatio="xMidYMin meet"
        aria-label="Action expectations and observed outcomes over time"
      >
        <defs>
          <pattern
            id="om-dots"
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.6" fill="#d6d0df" />
          </pattern>
        </defs>
        <rect
          x="214"
          y="35"
          width="424"
          height={height - 55}
          fill="url(#om-dots)"
          opacity=".55"
        />
        {now < 610 && (
          <rect
            x={Math.max(214, now)}
            y="35"
            width={610 - Math.max(214, now)}
            height={height - 55}
            fill="#f8f7fa"
            opacity=".85"
          />
        )}
        {[0, 10, 20, 30]
          .filter((m) => start + m * 60_000 <= end)
          .map((m) => (
            <g key={m}>
              <line
                x1={x(new Date(start + m * 60_000).toISOString())}
                x2={x(new Date(start + m * 60_000).toISOString())}
                y1="36"
                y2={height - 20}
                stroke="#e9e5ed"
              />
              <text
                x={x(new Date(start + m * 60_000).toISOString())}
                y="22"
                textAnchor="middle"
                className="om-axis"
              >
                {time(new Date(start + m * 60_000).toISOString())}
              </text>
            </g>
          ))}
        <text x="18" y="22" className="om-axis">
          PERSON / EXPECTED CHANGE
        </text>
        {rows.map((o, i) => {
          const y = 48 + i * 31,
            observed = o.check.observedAt,
            active = selected?.id === o.id;
          const point = observed
            ? x(observed)
            : Math.min(x(o.dueAt), Math.max(x(o.createdAt), now));
          const who = snapshot.households
            .find((h) => h.id === o.person)!
            .name.split(" ")[0];
          return (
            <g
              key={o.id}
              role="button"
              tabIndex={0}
              aria-label={`${who}: ${o.title}, ${statusText[o.check.status]}`}
              aria-pressed={active}
              onClick={() => select(o.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(o.id);
                }
              }}
              className={`om-map-row ${active ? "selected" : ""}`}
              style={tone(o)}
            >
              <rect
                x="4"
                y={y - 14}
                width="648"
                height="30"
                rx="5"
                fill={active ? "#f0ebf7" : "transparent"}
              />
              <rect
                x="17"
                y={y - 6}
                width="3"
                height="18"
                rx="1"
                fill={colors[o.person]}
              />
              <text x="28" y={y - 2} className="om-map-title">
                {o.title}
              </text>
              <text x="28" y={y + 10} className="om-map-sub">
                {who} · {statusText[o.check.status]}
              </text>
              <line
                x1={x(o.createdAt)}
                x2={x(o.dueAt)}
                y1={y}
                y2={y}
                stroke={colors[o.person]}
                strokeOpacity=".4"
                strokeDasharray="3 4"
              />
              <line
                x1={x(o.createdAt)}
                x2={point}
                y1={y}
                y2={y}
                stroke={colors[o.person]}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <rect
                x={x(o.createdAt) - 4}
                y={y - 4}
                width="8"
                height="8"
                rx="1.5"
                fill={colors[o.person]}
              />
              <circle
                cx={x(o.dueAt)}
                cy={y}
                r="5"
                fill="white"
                stroke={colors[o.person]}
                strokeWidth="1.5"
              />
              {observed && (
                <g transform={`translate(${x(observed)} ${y})`}>
                  <path
                    d="M0 -7L7 0L0 7L-7 0Z"
                    fill={
                      o.check.status === "met" ? colors[o.person] : "#b56450"
                    }
                    stroke="white"
                    strokeWidth="1.4"
                  />
                  {active && (
                    <circle
                      r="12"
                      fill="none"
                      stroke={colors[o.person]}
                      strokeOpacity=".35"
                    />
                  )}
                </g>
              )}
              {active && (
                <text
                  x={observed ? x(observed) : x(o.dueAt)}
                  y={y + 15}
                  textAnchor="middle"
                  className="om-map-sub"
                >
                  {observed
                    ? `observed ${time(observed)}`
                    : `due ${time(o.dueAt)}`}
                </text>
              )}
            </g>
          );
        })}
        <line
          x1={now}
          x2={now}
          y1="32"
          y2={height - 19}
          stroke="#5514b4"
          strokeDasharray="2 3"
          opacity=".6"
          pointerEvents="none"
        />
        <text x={now} y={height - 6} textAnchor="middle" className="om-now">
          AS KNOWN {time(snapshot.clock)}
        </text>
      </svg>
    </div>
  );
}
export function ActionOutcomes({
  h,
  snapshot,
  inspect,
  onCutoff,
}: {
  h: Household;
  snapshot: Snapshot;
  inspect: (e: SourceEvent) => void;
  onCutoff: (at: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [filter, setFilter] = useState("all"),
    [view, setView] = useState<"behaviour" | "evidence">("behaviour"),
    [selectedRunId, setSelectedRunId] = useState<string | null>(null),
    [referenceId, setReferenceId] = useState<string | null>(null);
  const space = useBehaviourSpace(snapshot);
  const runRows =
    space.data?.runs.filter((r) => filter === "all" || r.person === filter) ||
    [];
  const run =
    runRows.find((r) => r.id === selectedRunId) ||
    runRows.filter((r) => r.person === h.id).at(-1) ||
    runRows[0];
  const defaultContrast =
    space.data?.contrasts.find((c) => {
      if (!run || (c.a !== run.id && c.b !== run.id)) return false;
      const other = runRows.find((r) => r.id === (c.a === run.id ? c.b : c.a));
      return other?.person === run.person && other.revision < run.revision;
    }) ||
    space.data?.contrasts.find(
      (c) =>
        (c.a === run?.id || c.b === run?.id) &&
        runRows.some((r) => r.id === (c.a === run?.id ? c.b : c.a)),
    );
  const reference =
    runRows.find((r) => r.id === referenceId && r.id !== run?.id) ||
    runRows.find(
      (r) =>
        r.id ===
        (defaultContrast?.a === run?.id
          ? defaultContrast?.b
          : defaultContrast?.a),
    ) ||
    runRows.find((r) => r.id !== run?.id);
  const contrast = space.data?.contrasts.find(
    (c) =>
      (c.a === run?.id && c.b === reference?.id) ||
      (c.b === run?.id && c.a === reference?.id),
  );
  const chooseRun = (id: string) => {
    setSelectedRunId(id);
    setReferenceId((current) => (current === id ? null : current));
  };
  const dialog = useRef<HTMLDialogElement>(null);
  const outcomes = snapshot.operations.outcomes,
    rows = outcomes.filter((o) => filter === "all" || o.person === filter);
  const selected =
    rows.find((o) => o.id === selectedId) ||
    rows.find((o) => o.person === h.id && o.goal === "callback") ||
    rows.find((o) => o.person === h.id) ||
    rows[0];
  const person =
    snapshot.households.find(
      (p) => p.id === (view === "behaviour" ? run?.person : selected?.person),
    ) || h;
  const proof = snapshot.events.filter((e) =>
    selected?.check.evidenceIds.includes(e.id),
  );
  const action = snapshot.actions.find((a) => a.id === selected?.actionId),
    decision = snapshot.decisions.find((d) => d.id === selected?.decisionId);
  const targets = outcomes.filter((o) => o.person === person.id),
    verified = targets.filter((o) => o.check.status === "met").length;
  const latestModel = snapshot.decisions
    .filter((d) => d.person === person.id && d.trace?.assessment)
    .at(-1)?.trace?.assessment;
  const modelMemory = Array.isArray(latestModel?.state.outcomeMemory)
    ? (latestModel.state.outcomeMemory as { id: string; status: string }[])
    : [];
  const readByModel =
    latestModel?.status === "ok" &&
    selected &&
    modelMemory.find((m) => m.id === selected.id);
  const loopReady = selected && selected.check.status !== "waiting";
  return (
    <div className="operational-memory action-outcomes">
      <div className="om-summary">
        <a className="ar-review-link" href={`?session=${snapshot.session.id}&person=${h.id}&view=agent-review&at=${snapshot.cutoff}`}>Review recorded behaviour ↗</a>
        <div>
          <span className="eyebrow">
            CONTEXT → POSSIBLE ACTIONS → GOVERNED ACTION → EVIDENCE
          </span>
          <h2>
            {view === "behaviour"
              ? "What in the context changes the response?"
              : `${person.name.split(" ")[0]}: what actually changed?`}
          </h2>
          <p>
            {view === "behaviour"
              ? contrastNarrative(reference, run)
              : !targets.length
                ? "No committed plan yet. The operating context is ready."
                : verified === targets.length
                  ? `${verified} expected changes verified. Inspect the evidence for each one.`
                  : `${targets.length - verified} of ${targets.length} expected changes still need evidence.`}
          </p>
        </div>
        <div className="om-summary-stat">
          <strong>
            {String(verified).padStart(2, "0")}
            <span> / {String(targets.length).padStart(2, "0")}</span>
          </strong>
          <small>
            VERIFIED OUTCOMES · {person.name.split(" ")[0].toUpperCase()}
          </small>
        </div>
        <label className="om-replay">
          Read the recorded state
          <select
            value={snapshot.cutoff}
            onChange={(e) => onCutoff(Number(e.target.value))}
          >
            {[
              "20:45 · Before the signal",
              "21:00 · Signal received",
              "21:03 · Incident scoped",
              "21:12 · Recovery observed",
              "21:15 · Callback kept",
              "21:18 · Customer confirmed",
            ]
              .slice(0, snapshot.session.revision + 1)
              .map((label, at) => (
                <option key={at} value={at}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="om-layout">
        <Panel
          title={
            view === "behaviour"
              ? "Find a meaningful contrast"
              : "Action ledger"
          }
          number="01"
          note={view === "behaviour" ? "RECORDED RUNS" : "SIMULATED DELIVERY"}
          className="om-context"
        >
          {view === "behaviour" && space.data ? (
            <ContextContrasts
              data={space.data}
              selected={run}
              reference={reference}
              filter={filter}
              compare={(a, b) => {
                setReferenceId(a);
                setSelectedRunId(b);
              }}
            />
          ) : (
            <div className="om-scroll">
              <div className="om-context-block">
                <span className="eyebrow">Committed actions / receipts</span>
                <p>
                  A delivery receipt proves delivery in this demo. The expected
                  customer change is verified separately.
                </p>
              </div>
              {snapshot.actions
                .filter((a) => filter === "all" || a.person === filter)
                .map((a) => (
                  <button
                    className="ao-ledger-row"
                    key={a.id}
                    onClick={() => {
                      setSelectedRunId(a.decisionId);
                      setView("behaviour");
                    }}
                  >
                    <span className="eyebrow">
                      {time(a.time)} ·{" "}
                      {
                        snapshot.households
                          .find((p) => p.id === a.person)
                          ?.name.split(" ")[0]
                      }
                    </span>
                    <strong>{a.title}</strong>
                    <span>{a.body}</span>
                    <code>
                      decision {short(a.decisionId)}
                      <br />
                      action {short(a.id)}
                      <br />
                      receipt {a.receiptId ? short(a.receiptId) : "pending"}
                    </code>
                    <small>{a.status} · simulated</small>
                  </button>
                ))}
              {!snapshot.actions.length && (
                <p className="om-empty">
                  No customer action committed at this cutoff.
                </p>
              )}
              <div className="om-context-block om-value">
                <span className="eyebrow">Value to test</span>
                <strong>Less effort. More trust. Successful use.</strong>
                <p>
                  Kept promises and confirmed service are observable. Contact
                  savings and retention still need measurement.
                </p>
              </div>
            </div>
          )}
        </Panel>
        <div className="om-centre">
          <Panel
            title={
              view === "behaviour"
                ? "From context to action"
                : "Expected change & evidence"
            }
            number="02"
            className="om-chart-panel"
          >
            <div className="om-map-tools">
              <div className="bs-view-controls" aria-label="Chart view">
                <button
                  aria-pressed={view === "behaviour"}
                  onClick={() => setView("behaviour")}
                >
                  Context → action
                </button>
                <button
                  aria-pressed={view === "evidence"}
                  onClick={() => setView("evidence")}
                >
                  Outcome evidence
                </button>
              </div>
              <label>
                Show
                <select
                  aria-label="Filter outcome map by person"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All three people</option>
                  {snapshot.households.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.split(" ")[0]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {view === "behaviour" ? (
              space.data ? (
                <BehaviourSpace
                  data={space.data}
                  selected={run}
                  reference={reference}
                  contrast={contrast}
                  select={chooseRun}
                  setReference={setReferenceId}
                  filter={filter}
                />
              ) : (
                <div className="om-empty" role="status">
                  {space.error || "Embedding recorded customer facts locally…"}
                  {space.error && (
                    <button
                      className="om-json"
                      onClick={() => setView("evidence")}
                    >
                      Open evidence timeline ↗
                    </button>
                  )}
                </div>
              )
            ) : rows.length ? (
              <EvidenceMap
                rows={rows}
                selected={selected}
                select={setSelectedId}
                snapshot={snapshot}
              />
            ) : (
              <div className="om-empty">
                No outcome contracts in this snapshot.
                <br />
                The first committed plan opens its verification window.
              </div>
            )}
            {view === "evidence" && (
              <div className="om-chart-note">
                ■ Plan · ○ Verify by · ◆ Evidence. Select a path to inspect its
                proof. Lines link records in time; they do not establish
                causation.
              </div>
            )}
          </Panel>
          <Panel
            title="Memory for the next decision"
            number="04"
            note="PERSISTED / SCOPED"
            className="om-feedback"
          >
            <div className="om-feedback-rows">
              {outcomes.length ? (
                snapshot.households.map((p) => {
                  const own = outcomes.filter((o) => o.person === p.id),
                    met = own.filter((o) => o.check.status === "met"),
                    latest = met.at(-1) || own[0];
                  return (
                    <button
                      key={p.id}
                      aria-pressed={person.id === p.id}
                      disabled={!latest}
                      onClick={() => {
                        setFilter("all");
                        if (latest) setSelectedId(latest.id);
                        setView("evidence");
                      }}
                    >
                      <span
                        className="om-initial"
                        style={{ color: colors[p.id] }}
                      >
                        {p.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <span>
                        <strong>
                          {p.name.split(" ")[0]}{" "}
                          <small>
                            {met.length}/{own.length} verified
                          </small>
                        </strong>
                        <span>
                          {!own.length
                            ? "No verification contract recorded."
                            : p.id === "daniel"
                              ? met.length === own.length
                                ? "Recovery confirmed; retain the failed restart and kept promise."
                                : "Recovery, follow-through and confirmation remain separate."
                              : p.id === "sam"
                                ? met.length
                                  ? "First use observed; retain the activation episode."
                                  : "First use still unknown. Outreach is not onboarding success."
                                : met.length
                                  ? "Heartbeat returned. End this watch; fresh faults still override habit."
                                  : "Observe without contact; reassess if proof is missing."}
                        </span>
                      </span>
                      <b>↗</b>
                    </button>
                  );
                })
              ) : (
                <p className="om-empty">
                  The ledger preserves what worked, what remains unknown and
                  what needs another assessment.
                </p>
              )}
            </div>
            <div className="om-bandit">
              <span>↺</span>
              <div>
                <strong>
                  Future learning loop <em>Concept</em>
                </strong>
                <p>
                  Context + action + outcome → reward → better decisions. Future
                  contextual bandit; no training is running.
                </p>
              </div>
            </div>
          </Panel>
        </div>
        <Panel
          title={
            view === "behaviour"
              ? "Explain the difference"
              : "Verify the change"
          }
          number="03"
          className="om-inspector"
          note={
            view === "behaviour"
              ? run
                ? short(run.id)
                : "NO RUN"
              : selected
                ? short(selected.id)
                : "NO PLAN"
          }
        >
          {view === "behaviour" ? (
            run && space.data ? (
              <BehaviourInspector
                run={run}
                data={space.data}
                snapshot={snapshot}
                inspect={inspect}
                reference={reference}
                contrast={contrast}
                verify={(id) => {
                  setSelectedId(id);
                  setView("evidence");
                }}
              />
            ) : (
              <div className="om-empty">
                {space.error
                  ? "Run inspection is unavailable. The evidence timeline remains available."
                  : "Select a recorded run to inspect its context and observations."}
              </div>
            )
          ) : selected ? (
            <div className="om-scroll" aria-live="polite">
              <div className="om-inspector-title" style={tone(selected)}>
                <span className="eyebrow">
                  {person.name} / {selected.goal}
                </span>
                <h3>{selected.title}</h3>
                <span className={`om-status ${selected.check.status}`}>
                  {statusText[selected.check.status]}
                  {selected.check.status === "met"
                    ? selected.check.onTime
                      ? " · on time"
                      : " · late"
                    : ""}
                </span>
              </div>
              <ol className="om-proof-chain">
                <li>
                  <span className="om-step-number">1</span>
                  <div>
                    <span className="eyebrow">
                      Action / {time(selected.createdAt)}
                    </span>
                    <strong>
                      {action?.title ||
                        decision?.title ||
                        "Observe without contact"}
                    </strong>
                    <small>
                      {action
                        ? `Simulated delivery · ${short(action.id)}`
                        : "Internal decision · no message receipt"}
                    </small>
                  </div>
                </li>
                <li>
                  <span className="om-step-number">2</span>
                  <div>
                    <span className="eyebrow">Expected change</span>
                    <p>{selected.target}</p>
                    <code>{selected.expectedEvent}</code>
                    <small>
                      Verify by {time(selected.dueAt)} ·{" "}
                      {selected.deadlineBasis}
                    </small>
                  </div>
                </li>
                <li className={selected.check.status === "met" ? "proven" : ""}>
                  <span className="om-step-number">3</span>
                  <div>
                    <span className="eyebrow">Observed change</span>
                    <p>{selected.check.finding}</p>
                    {proof.map((e) => (
                      <button
                        className="om-proof-link"
                        key={e.id}
                        onClick={() => inspect(e)}
                      >
                        {time(e.occurredAt)} ·{" "}
                        {e.source.replace("_simulator", "")} <span>↗</span>
                      </button>
                    ))}
                  </div>
                </li>
                <li className={loopReady ? "proven" : ""}>
                  <span className="om-step-number">↺</span>
                  <div>
                    <span className="eyebrow">
                      Write back → next arbiter read
                    </span>
                    <p>{selected.check.nextDecision}</p>
                    <small>
                      {readByModel
                        ? `Jev read this contract as “${readByModel.status}” in its latest assessment.`
                        : "Available to the next Jev assessment. No model read recorded yet."}
                    </small>
                  </div>
                </li>
              </ol>
              <div className="om-attribution">
                <strong>What this proves</strong>
                <p>{selected.attribution}</p>
              </div>
              <button
                className="om-json"
                onClick={() => dialog.current?.showModal()}
              >
                Inspect verification contract <span>JSON ↗</span>
              </button>
            </div>
          ) : (
            <div className="om-empty">
              Select an expectation after the first plan is recorded.
            </div>
          )}
        </Panel>
      </div>
      <div className="om-method">
        <span>
          <i /> SQLite contracts + verification ledger · synthetic scenario
          records
        </span>
        <span>
          {outcomes.some((o) => o.provenance === "reconstructed")
            ? "Earlier plans reconstructed from their stored evidence"
            : "Contracts captured with the committed plan"}{" "}
          · no causal uplift estimate
        </span>
      </div>
      <dialog ref={dialog} className="om-dialog">
        <header>
          <h2>Expectation + verification record</h2>
          <button
            onClick={() => dialog.current?.close()}
            aria-label="Close verification contract"
          >
            ✕
          </button>
        </header>
        <p>
          Immutable target; append-only verification at each replay revision.{" "}
          {selected?.provenance === "reconstructed"
            ? "This earlier plan was reconstructed from persisted records."
            : "Recorded with this plan."}
        </p>
        <pre>{JSON.stringify(selected, null, 2)}</pre>
      </dialog>
    </div>
  );
}
