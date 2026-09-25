import { useEffect, useRef, useState } from "react";
import type {
  Decision,
  Household,
  Proposal,
  Snapshot,
  SourceEvent,
} from "./types";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
const short = (id: string) => id.slice(0, 8);
const labels: Record<string, string> = {
  router_simulator: "Hub telemetry",
  diagnostics_simulator: "Diagnostics",
  incident_simulator: "Network incidents",
  crm_simulator: "Care / CRM",
  order_simulator: "Orders",
  rota_simulator: "Callback rota",
  contact_note_simulator: "Customer contact",
  identity_simulator: "Contact authority",
  synthetic_history_summary: "History summary",
  adviser_simulator: "Adviser",
  customer_phone_simulator: "Customer reply",
};
const fieldLabels: Record<string, string> = {
  serviceState: "service.state",
  incident: "incident.in_scope",
  caseStatus: "case.status",
  owner: "care.owner",
  promise: "promise.due",
  promiseFulfilled: "promise.fulfilled",
  restored: "service.restored",
  confirmed: "customer.confirmed",
  contactAllowed: "contact.allowed",
};

function PanelHead({
  number,
  title,
  note,
}: {
  number: string;
  title: string;
  note?: string;
}) {
  return (
    <header className="aw-panel-head">
      <h2>
        <span>{number}</span>
        {title}
      </h2>
      {note && <small>{note}</small>}
    </header>
  );
}

function SourceActivity({
  events,
  clock,
  selected,
  inspect,
}: {
  events: SourceEvent[];
  clock: string;
  selected: Set<string>;
  inspect: (e: SourceEvent) => void;
}) {
  const sources = [...new Set(events.map((e) => e.source))];
  const now = new Date(clock).getTime();
  return (
    <div className="aw-sources">
      <div className="aw-subhead">
        <span>Source activity</span>
        <small>2h · 15m buckets</small>
      </div>
      {sources.map((source) => {
        const records = events.filter((e) => e.source === source);
        const bars = Array.from(
          { length: 8 },
          (_, i) =>
            records.filter((e) => {
              const minutes = (now - new Date(e.receivedAt).getTime()) / 60000;
              return minutes >= (7 - i) * 15 && minutes < (8 - i) * 15;
            }).length,
        );
        const latest = records.at(-1)!;
        const used = records.some((e) => selected.has(e.id));
        return (
          <button
            className={`aw-source ${used ? "is-used" : ""}`}
            key={source}
            onClick={() => inspect(latest)}
            title={`${source} · latest source record ${time(latest.receivedAt)}`}
          >
            <span>{labels[source] || source}</span>
            <svg viewBox="0 0 80 18" aria-hidden="true">
              <path d="M0 17H80" />
              {bars.map((n, i) => (
                <rect
                  key={i}
                  x={i * 10 + 2}
                  y={17 - Math.min(n, 4) * 4}
                  width="5"
                  height={Math.min(n, 4) * 4}
                />
              ))}
            </svg>
            <code>{bars.reduce((a, b) => a + b, 0)}</code>
          </button>
        );
      })}
      <p className="aw-note">
        Purple sources contribute to the selected proposal.
      </p>
    </div>
  );
}

function PriorityHistory({
  runs,
  selected,
  current,
}: {
  runs: Decision[];
  selected: Proposal;
  current: Decision;
}) {
  const points = runs
    .filter((d) => d.revision <= current.revision && d.trace)
    .map((d) => ({
      run: d,
      candidate: d.trace!.candidates.find((c) => c.id === selected.id),
    }))
    .filter((p) => p.candidate);
  const x = (i: number) =>
    points.length === 1 ? 230 : 32 + (i * 396) / (points.length - 1);
  const y = (v: number) => 76 - v * 0.6;
  return (
    <div className="aw-history">
      <div className="aw-subhead">
        <span>Priority through recorded runs</span>
        <small>Rule value / 100</small>
      </div>
      <svg
        viewBox="0 0 460 106"
        role="img"
        aria-label={`${selected.title}: priority across ${points.length} recorded runs. Solid points were selected.`}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1="28" x2="436" y1={y(v)} y2={y(v)} />
            <text x="20" y={y(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <path
          d={points
            .map(
              (p, i) => `${i ? "L" : "M"}${x(i)},${y(p.candidate!.priority)}`,
            )
            .join(" ")}
        />
        {points.map((p, i) => (
          <g key={p.run.id}>
            <circle
              cx={x(i)}
              cy={y(p.candidate!.priority)}
              r="4"
              className={
                p.candidate!.status === "selected" ? "is-selected" : ""
              }
            />
            <text x={x(i)} y="94" textAnchor="middle">
              {time(p.run.time)}
            </text>
          </g>
        ))}
      </svg>
      <div className="aw-legend">
        <span>
          <i /> Selected
        </span>
        <span>
          <i className="hollow" /> Not selected
        </span>
        <small>Eligibility gates take precedence</small>
      </div>
    </div>
  );
}

export function ArbiterWorkbench({
  h,
  snapshot,
  decision,
  inspect,
}: {
  h: Household;
  snapshot: Snapshot;
  decision?: Decision;
  inspect: (e: SourceEvent) => void;
}) {
  const [runId, setRunId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [showContract, setShowContract] = useState(false);
  const contract = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (showContract) contract.current?.showModal();
  }, [showContract]);
  const runs = snapshot.decisions.filter((d) => d.person === h.id);
  const run = runs.find((d) => d.id === runId) || decision;
  const trace = run?.trace;
  if (!run || !trace)
    return (
      <div className="aw-empty">
        <span className="eyebrow">Arbiter / awaiting a recorded run</span>
        <h2>
          {run
            ? "This earlier run has a summary record."
            : "The first signal starts the trace."}
        </h2>
        <p>
          {run
            ? "New runs retain proposals, eligibility checks and execution details. Return to the account and advance the scenario, or start a new session."
            : "Return to the account and play the scenario. Open this panel to inspect the proposals and decisions it produces."}
        </p>
        {runs.length > 0 && (
          <label className="aw-run-select">
            Inspect run
            <select
              aria-label="Inspect arbitration run"
              value={run?.id || ""}
              onChange={(e) => {
                setRunId(e.target.value);
                setCandidateId(null);
              }}
            >
              {runs.map((d) => (
                <option key={d.id} value={d.id}>
                  {time(d.time)} · rev {d.revision}
                  {d.trace ? " · full trace" : " · summary"}
                </option>
              ))}
            </select>
          </label>
        )}
        {run && (
          <blockquote>
            {run.title}
            <p>{run.reason}</p>
          </blockquote>
        )}
      </div>
    );
  const selected =
    trace.candidates.find((c) => c.id === candidateId) ||
    trace.candidates.find((c) => c.id === trace.selectedId)!;
  const context = h.evidence.filter(
    (e) =>
      e.revision <= run.revision &&
      e.occurredAt <= run.time &&
      e.receivedAt <= run.time,
  );
  const used = new Set(selected.evidenceIds);
  const evidence = context.filter((e) => used.has(e.id));
  const triggers = context.filter((e) => trace.triggerIds.includes(e.id));
  const eligible = selected.checks.every((c) => c.state === "pass");
  const prior = runs.find((d) => d.id === trace.previousDecisionId);
  const changed = prior && prior.trace?.selectedId !== trace.selectedId;
  const names = {
    selected: "Selected",
    held: "Held",
    blocked: "Blocked",
    merged: "Merged",
  };
  return (
    <div className="arbiter-workbench">
      <div className="aw-runbar">
        <span className="aw-live-dot" />
        <div>
          <strong>{run.title}</strong>
          <small>
            {changed
              ? `Revised from ${prior.title}`
              : "Context evaluated · decision recorded"}
          </small>
        </div>
        <div className="aw-run-id">
          <span>RUN</span>
          <code>{short(run.id)}</code>
          <span>POLICY</span>
          <code>{run.policyVersion}</code>
        </div>
        <label className="aw-run-select">
          Inspect run
          <select
            aria-label="Inspect arbitration run"
            value={run.id}
            onChange={(e) => {
              setRunId(e.target.value);
              setCandidateId(null);
            }}
          >
            {runs.map((d) => (
              <option value={d.id} key={d.id}>
                {time(d.time)} · rev {d.revision}
              </option>
            ))}
          </select>
        </label>
        <button
          className="aw-contract-button"
          onClick={() => setShowContract(true)}
          title="Inspect the persisted decision JSON"
        >
          {"{ }"} Record
        </button>
      </div>

      <div className="aw-columns">
        <section className="aw-panel aw-inputs">
          <PanelHead
            number="01"
            title="Signals & memory"
            note={`${context.length} records`}
          />
          <div className="aw-panel-scroll">
            <div className="aw-trigger">
              <span className="aw-kicker">THIS RUN WAS TRIGGERED BY</span>
              {triggers.map((e) => (
                <button key={e.id} onClick={() => inspect(e)}>
                  <time>{time(e.receivedAt)}</time>
                  <code>{e.type}</code>
                  <span>↗</span>
                </button>
              ))}
              {!triggers.length && <p>Context reassessment</p>}
            </div>
            <SourceActivity
              events={context}
              clock={run.time}
              selected={used}
              inspect={inspect}
            />
            <div className="aw-memory">
              <div className="aw-subhead">
                <span>Memory changes</span>
                <small>
                  rev {run.revision - 1} → {run.revision}
                </small>
              </div>
              {trace.changes.length ? (
                trace.changes.map((change) => (
                  <div className="aw-change" key={change.field}>
                    <code>{fieldLabels[change.field] || change.field}</code>
                    <div>
                      <span>{change.before}</span>
                      <b>→</b>
                      <strong>{change.after}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <p className="aw-note">
                  No projected fact changed. The new observation still prompted
                  a recorded reassessment.
                </p>
              )}
            </div>
            <div className="aw-protected">
              <span className="aw-kicker">CONTINUITY</span>
              <strong>
                {context.some((e) => e.type === "promise.created")
                  ? "Existing promise stays attached"
                  : "Retained context stays attached"}
              </strong>
              <p>
                {context
                  .filter((e) =>
                    [
                      "promise.created",
                      "preference.stated",
                      "order.delivered",
                    ].includes(e.type),
                  )
                  .map((e) => e.description)
                  .join(" ") ||
                  "Source records remain available to subsequent decisions."}
              </p>
            </div>
            <PriorityHistory runs={runs} selected={selected} current={run} />
          </div>
        </section>

        <section className="aw-panel aw-proposals">
          <PanelHead
            number="02"
            title="Proposal queue"
            note={`${trace.candidates.length} assessed`}
          />
          <div className="aw-queue-legend">
            <span>DOMAIN / PROPOSED ACTION</span>
            <span>PRIORITY</span>
            <span>DISPOSITION</span>
          </div>
          <div className="aw-queue" aria-label="Domain proposals">
            {trace.candidates.map((c) => (
              <button
                key={c.id}
                aria-pressed={c.id === selected.id}
                onClick={() => setCandidateId(c.id)}
                className={`aw-proposal ${c.id === selected.id ? "is-inspected" : ""}`}
              >
                <span className="aw-proposal-name">
                  <code>{c.agent}</code>
                  <strong>{c.title}</strong>
                </span>
                <span className="aw-score">
                  <b>{c.priority}</b>
                  <i>
                    <em style={{ width: `${c.priority}%` }} />
                  </i>
                </span>
                <span className={`aw-status ${c.status}`}>
                  {names[c.status]}
                </span>
              </button>
            ))}
          </div>
          <div className="aw-path">
            <span className="aw-kicker">
              INSPECTED PROPOSAL / DECISION PATH
            </span>
            <div>
              <span className="pass">
                <small>Evidence</small>
                <b>{selected.evidenceIds.length} records</b>
              </span>
              <i>→</i>
              <span className={eligible ? "pass" : "stop"}>
                <small>Eligibility</small>
                <b>{eligible ? "Passed" : "Gated"}</b>
              </span>
              <i>→</i>
              <span className={eligible ? "pass" : "muted"}>
                <small>Priority</small>
                <b>{selected.priority} / 100</b>
              </span>
              <i>→</i>
              <span className={selected.status}>
                <small>Result</small>
                <b>{names[selected.status]}</b>
              </span>
            </div>
          </div>
          <p className="aw-queue-foot">
            Eligible proposals are ranked by policy priority. Merged work
            retains its existing owner.
          </p>
        </section>

        <section className="aw-panel aw-assessment">
          <PanelHead
            number="03"
            title="Decision inspection"
            note="Rule-derived"
          />
          <div className="aw-panel-scroll">
            <div className="aw-selected-summary">
              <span className={`aw-status ${selected.status}`}>
                {names[selected.status]}
              </span>
              <code>{selected.agent}</code>
              <h3>{selected.title}</h3>
              <p>{selected.reason}</p>
            </div>
            <div className="aw-checks">
              <div className="aw-subhead">
                <span>Eligibility checks</span>
                <small>Hard gates</small>
              </div>
              {selected.checks.map((check) => (
                <div className={`aw-check ${check.state}`} key={check.id}>
                  <i>
                    {check.state === "pass"
                      ? "✓"
                      : check.state === "fail"
                        ? "×"
                        : "?"}
                  </i>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.detail}</p>
                    {check.evidenceIds.length > 0 && (
                      <button
                        onClick={() => {
                          const e = context.find(
                            (e) => e.id === check.evidenceIds[0],
                          );
                          if (e) inspect(e);
                        }}
                      >
                        Source {short(check.evidenceIds[0])} ↗
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="aw-factors">
              <div className="aw-subhead">
                <span>Priority components</span>
                <small>Policy units</small>
              </div>
              {selected.factors.map((f) => (
                <div key={f.label}>
                  <span>{f.label}</span>
                  <i>
                    <b style={{ width: `${f.value}%` }} />
                  </i>
                  <code>+{f.value}</code>
                </div>
              ))}
              <p className="aw-note">
                A priority value cannot override a failed or unknown gate.
              </p>
            </div>
            <div className="aw-evidence">
              <div className="aw-subhead">
                <span>Evidence used</span>
                <small>{evidence.length} linked</small>
              </div>
              {evidence.map((e) => (
                <button key={e.id} onClick={() => inspect(e)}>
                  <time>{time(e.occurredAt)}</time>
                  <span>
                    <strong>{e.type}</strong>
                    <small>{e.description}</small>
                  </span>
                  <b>↗</b>
                </button>
              ))}
            </div>
            <div className="aw-wake">
              <span className="aw-kicker">
                {selected.status === "selected"
                  ? "BOUNDED EFFECT"
                  : "RECONSIDER WHEN"}
              </span>
              <p>
                {selected.status === "selected"
                  ? selected.effect
                  : selected.wake}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="aw-execution">
        <header>
          <span className="aw-kicker">04 / EXECUTION RECEIPT</span>
          <small>For the selected plan · {time(run.time)}</small>
        </header>
        <div className="aw-execution-steps">
          {trace.execution.map((step, i) => (
            <div key={`${i}-${step.stage}`} className={step.status}>
              <span>
                {String(i + 1).padStart(2, "0")} <b>{step.stage}</b>
              </span>
              <p title={step.detail}>{step.detail}</p>
              {step.actionId && (
                <code>
                  {step.receiptId
                    ? `receipt ${short(step.receiptId)}`
                    : `action ${short(step.actionId)}`}
                </code>
              )}
            </div>
          ))}
        </div>
      </section>
      <dialog
        ref={contract}
        className="aw-contract"
        aria-label="Persisted decision record"
        onClose={() => setShowContract(false)}
      >
        <header>
          <div>
            <span className="eyebrow">
              Persisted decision / rev {run.revision}
            </span>
            <h2>{short(run.id)}</h2>
          </div>
          <button autoFocus onClick={() => contract.current?.close()}>
            Close ×
          </button>
        </header>
        <pre>{JSON.stringify(run, null, 2)}</pre>
      </dialog>
    </div>
  );
}
