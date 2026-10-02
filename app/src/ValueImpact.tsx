import type { Decision, Household, Proposal, Snapshot } from "./types";
import { formatDateTime } from "./time";
import {
  METRICS,
  VALUE_MODEL,
  formatDelta,
  formatLevel,
  impactOf,
  tone,
  tradeOffs,
  valueSummary,
  type Realisation,
} from "./value-impact";
import "./value-impact.css";

const confidenceLabel = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" };

/** Panel 03: what the inspected proposal is expected to do for BT, and how it compares with the chosen plan. */
export function ValueBlock({ h, proposal, chosen }: { h: Household; proposal: Proposal; chosen?: Proposal }) {
  const impact = impactOf(proposal.id, h);
  const versus = chosen && chosen.id !== proposal.id ? impactOf(chosen.id, h) : null;
  const gated = !proposal.checks.every((c) => c.state === "pass");
  return (
    <div className="vi-block">
      <div className="aw-subhead">
        <span>Value to BT</span>
        <small>{versus ? `vs ${chosen!.title.toLowerCase()}` : "expected · modelled"}</small>
      </div>
      <dl className="vi-metrics">
        {METRICS.map((m) => {
          const n = impact[m.id];
          const diff = versus ? n - versus[m.id] : null;
          return (
            <div key={m.id} title={m.hint}>
              <dt>{m.label}</dt>
              <dd className={`is-${tone(m.id, n)}`}>{formatDelta(m.id, n)}</dd>
              {diff !== null && <small className={`is-${tone(m.id, diff)}`}>{formatDelta(m.id, diff)}</small>}
            </div>
          );
        })}
      </dl>
      <p className="aw-note">
        {impact.lever.basis} {confidenceLabel[impact.lever.confidence]}.
        {gated && " A gate blocks this action, so none of this value is available now."}
      </p>
    </div>
  );
}

/** Full-width strip under the columns: every proposal in the run, weighed on value to BT. */
export function TradeOffTable({ h, decision, inspectedId, onInspect }: { h: Household; decision: Decision; inspectedId: string; onInspect: (id: string) => void }) {
  const rows = tradeOffs(decision, h);
  if (!rows.length) return null;
  const selectedId = decision.trace?.selectedId;
  const bestRevenue = Math.max(...rows.filter((r) => r.eligible).map((r) => r.impact.revenue));
  const best = rows.find((r) => r.eligible && r.impact.revenue === bestRevenue);
  const chosen = rows.find((r) => r.proposal.id === selectedId);
  const forgone = best && chosen && best.proposal.id !== chosen.proposal.id ? best.impact.revenue - chosen.impact.revenue : 0;
  return (
    <section className="vi-trade" aria-label="Trade-offs: value to BT">
      <header>
        <span className="aw-kicker">04 / TRADE-OFFS · VALUE TO BT</span>
        <small>
          {forgone > 0
            ? `Chosen plan gives up ${formatDelta("revenue", forgone).replace("+", "")} of modelled 12-month revenue against ${best!.proposal.title.toLowerCase()}, in exchange for the gates and policy above`
            : "The chosen plan is also the highest-value eligible option"}
          {" · "}
          {VALUE_MODEL} · modelled, not measured
        </small>
      </header>
      <div className="vi-table-wrap">
        <table className="vi-table">
          <thead>
            <tr>
              <th scope="col">Proposal</th>
              {METRICS.map((m) => (
                <th scope="col" key={m.id} title={m.hint}>
                  {m.short}
                </th>
              ))}
              <th scope="col">Eligibility</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ proposal, impact, eligible }) => (
              <tr
                key={proposal.id}
                className={`${proposal.id === selectedId ? "is-selected" : ""} ${proposal.id === inspectedId ? "is-inspected" : ""} ${eligible ? "" : "is-gated"}`}
              >
                <th scope="row">
                  <button onClick={() => onInspect(proposal.id)} aria-pressed={proposal.id === inspectedId}>
                    {proposal.id === selectedId && <em>Chosen</em>}
                    {proposal.title}
                  </button>
                </th>
                {METRICS.map((m) => (
                  <td key={m.id} className={`is-${tone(m.id, impact[m.id])}`}>
                    {formatDelta(m.id, impact[m.id])}
                  </td>
                ))}
                <td className="vi-gate">{eligible ? (proposal.status === "awaiting" ? "Needs sign-off" : "Eligible") : "Gated"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const stateLabel: Record<Realisation, string> = {
  evidenced: "Evidenced",
  pending: "Awaiting proof",
  "at-risk": "At risk",
  "no-proof": "No proof obligation",
};

/** Tracking: the value each committed decision was expected to create, and how much the outcome evidence supports. */
export function ValueTracking({ h, snapshot, compact = false }: { h: Household; snapshot: Snapshot; compact?: boolean }) {
  const { ledger, baseline, expected, evidenced, atRisk } = valueSummary(snapshot, h);
  const churn = h.profile?.churn;
  return (
    <section className="vi-track" aria-label="Value to BT">
      <header>
        <h3>Value to BT</h3>
        <span>
          Expected at decision time against what the outcome evidence supports. {VALUE_MODEL} · modelled estimates, not causal attribution.
        </span>
      </header>
      <div className="vi-track-grid">
        {METRICS.map((m) => {
          const now = m.id === "cost" ? expected.cost : baseline[m.id] + expected[m.id];
          return (
            <article key={m.id} title={m.hint}>
              <small>{m.label}</small>
              <b className={`is-${tone(m.id, expected[m.id])}`}>{formatDelta(m.id, expected[m.id])}</b>
              <dl>
                <div>
                  <dt>Evidenced</dt>
                  <dd className={`is-${tone(m.id, evidenced[m.id])}`}>{formatDelta(m.id, evidenced[m.id])}</dd>
                </div>
                {atRisk[m.id] !== 0 && (
                  <div>
                    <dt>At risk</dt>
                    <dd className="is-bad">{formatDelta(m.id, atRisk[m.id])}</dd>
                  </div>
                )}
                {m.id !== "cost" && (
                  <div>
                    <dt>Baseline → modelled</dt>
                    <dd>
                      {formatLevel(m.id, baseline[m.id])} → {formatLevel(m.id, now)}
                    </dd>
                  </div>
                )}
              </dl>
            </article>
          );
        })}
      </div>
      {churn && (
        <p className="vi-observed">
          <em>Observed churn model reading:</em> {Math.round(churn.score * 100)}% ({churn.level}) as of {formatDateTime(churn.asOf)}
          {churn.drivers.length > 0 && ` · ${churn.drivers.join(" · ")}`}
        </p>
      )}
      {!compact && (
        <ol className="vi-ledger">
          {!ledger.length && <li className="is-empty">No decision has moved value yet.</li>}
          {ledger.map((v) => (
            <li key={v.decision.id} className={`is-${v.state}`}>
              <span>{stateLabel[v.state]}</span>
              <b>{v.decision.title}</b>
              <small>{formatDateTime(v.decision.time)}</small>
              <code className={`is-${tone("revenue", v.impact.revenue)}`}>{formatDelta("revenue", v.impact.revenue)}</code>
              <code className={`is-${tone("churn", v.impact.churn)}`}>{formatDelta("churn", v.impact.churn)}</code>
              <code className={`is-${tone("cltv", v.impact.cltv)}`}>{formatDelta("cltv", v.impact.cltv)}</code>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
