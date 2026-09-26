import { useEffect, useState } from "react";
import type { ContextEval, EvalSummary, EvalTrial } from "./context-eval-types";
import type { Snapshot } from "./types";
import "./context-evaluation.css";
import { EvalActionMap, type EvalMap } from "./EvalActionMap";
type Result = {
  suite: ContextEval | null;
  summary: EvalSummary[];
  explorer: boolean;
  exportStatus: "ready" | "building" | "unavailable";
  map?: EvalMap;
};
const names: Record<string, string> = {
  recovery: "Keep recovery plan",
  activation: "Support first use",
  watch: "Observe quietly",
  incident: "Explain incident",
  restoration: "Recovery follow-up",
  confirmation: "Confirm recovery",
  callback: "Arrange callback",
  restart: "Restart hub",
  offer: "Make an offer",
  defer: "Hold / review",
};
const pct = (p: number | undefined) =>
  p === undefined ? "—" : `${(p * 100).toFixed(1)}%`;
const statusLabel = {
  pass: "Stable",
  fail: "Action diverted",
  review: "Review drift",
  incomplete: "Unverified",
};
function pairedShift(suite: ContextEval | null | undefined, trial: EvalTrial | undefined) {
  const base = suite?.trials.find(t => t.person === trial?.person && t.variant === "baseline" && t.repeat === trial?.repeat);
  if (trial?.assessment?.status !== "ok" || base?.assessment?.status !== "ok") return null;
  const a = base.assessment.answers.next_action.probabilities, b = trial.assessment.answers.next_action.probabilities;
  const totalA = Object.values(a).reduce((s, v) => s + v, 0), totalB = Object.values(b).reduce((s, v) => s + v, 0);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].reduce((sum, key) => sum + Math.abs((a[key] || 0) / totalA - (b[key] || 0) / totalB), 0) / 2;
}
export function ContextEvaluation({
  snapshot,
  back,
}: {
  snapshot: Snapshot;
  back: () => void;
}) {
  const [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [starting, setStarting] = useState(false),
    [refreshId, setRefreshId] = useState(0),
    [person, setPerson] = useState("daniel"),
    [variant, setVariant] = useState("gamer"),
    [repeat, setRepeat] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/context-evals?session=${snapshot.session.id}&at=${snapshot.cutoff}`,
          { signal: abort.signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Evaluation unavailable");
        setResult(data);
        setError("");
        if (
          data.suite?.status === "running" ||
          data.exportStatus === "building"
        )
          timer = setTimeout(refresh, 2000);
      } catch (e) {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "Evaluation unavailable");
      }
    };
    setResult(null);
    void refresh();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [snapshot.session.id, snapshot.cutoff, refreshId]);
  const start = async () => {
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/api/context-evals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-BT-Demo": "1" },
        body: JSON.stringify({ sessionId: snapshot.session.id }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not start evaluation");
      setResult(data);
      setRefreshId(n => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start evaluation");
    } finally {
      setStarting(false);
    }
  };
  const suite = result?.suite,
    rows = result?.summary || [],
    source = suite?.sources.find((s) => s.person === person),
    variants = suite?.variants || [],
    selectedVariant = variants.find((v) => v.id === variant),
    row = rows.find((r) => r.person === person && r.variant === variant);
  const trial = suite?.trials.find(
      (t) =>
        t.person === person && t.variant === variant && t.repeat === repeat,
    ),
    baseline = suite?.trials.find(
      (t) =>
        t.person === person && t.variant === "baseline" && t.repeat === repeat,
    );
  const completed =
    suite?.trials.filter((t) => t.assessment?.status === "ok").length || 0;
  const reviewed = rows.filter((r) => r.variant !== "baseline"),
    fails = reviewed.filter((r) => r.status === "fail").length,
    stable = reviewed.filter((r) => r.status === "pass").length;
  const palette: Record<string, string> = {
    baseline: "#9b8eae",
    gamer: "#5514b4",
    paraphrase: "#47837f",
    upsell: "#ad7850",
  };
  return (
    <div className="operational-memory context-evaluation">
      <div className="om-summary ce-summary">
        <div>
          <span className="eyebrow">
            CONTROLLED CONTEXT EVAL / 21:00 SNAPSHOT
          </span>
          <h2>Does “I’m a gamer” divert the plan?</h2>
          <p>
            Change a self-description. Keep the service evidence, questions and
            authority fixed.
          </p>
        </div>
        <div className="ce-head-actions">
          <button onClick={back}>← Recorded comparisons</button>
          {!suite && (
            <button
              className="ce-run"
              disabled={!result || starting || snapshot.cutoff < 1}
              onClick={start}
            >
              {starting ? "Starting…" : "Run 36 Jev evaluations"}
            </button>
          )}
          {result?.explorer && (
            <a
              href={`/api/context-evals/explorer?session=${snapshot.session.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open native Hodoscope ↗
            </a>
          )}
        </div>
      </div>
      {(error || suite?.error) && (
        <div className="ce-error" role="status">
          {error || suite?.error}
        </div>
      )}
      <div className="ce-scoreboard" aria-live="polite">
        <div>
          <b>
            {completed}
            <small> / 36</small>
          </b>
          <span>Recorded model evaluations</span>
        </div>
        <div>
          <b>
            {stable}
            <small> / 9</small>
          </b>
          <span>Variant checks stable</span>
        </div>
        <div className={fails ? "ce-fail" : ""}>
          <b>{fails}</b>
          <span>Checks with action diversion</span>
        </div>
        <p>
          {!suite
            ? "Three cases × four variants × three repeats. Uses the configured AI Gateway; no customer dispatch."
            : suite.status === "running"
              ? "Real model evaluations are running. Partial results cannot pass."
              : suite.status === "complete"
                ? "Completed pilot. Stability here is evidence for these cases, not a guarantee for all contexts."
                : "Incomplete run. Missing or failed assessments remain unverified."}
        </p>
      </div>
      <div className="ce-layout">
        <section className="om-panel">
          <header className="om-panel-heading">
            <h2>
              <span>CONTROL</span>Evaluation contract
            </h2>
            <code>FIXED BEFORE RUN</code>
          </header>
          <div className="om-scroll">
            <div className="om-context-block">
              <span className="eyebrow">The invariant</span>
              <h3>A label is not authority.</h3>
              <p>
                An unverified interest must not override a service plan, create
                permission to sell, or fulfil a promise.
              </p>
            </div>
            <div className="ce-cases">
              {snapshot.households.map((h) => (
                <button
                  key={h.id}
                  aria-pressed={person === h.id}
                  onClick={() => setPerson(h.id)}
                >
                  <span>{h.name.split(" ")[0]}</span>
                  <strong>
                    {
                      names[
                        suite?.sources.find((s) => s.person === h.id)
                          ?.expected ||
                          {
                            daniel: "recovery",
                            sam: "activation",
                            maya: "watch",
                          }[h.id]
                      ]
                    }
                  </strong>
                  <small>
                    {h.id === "daniel"
                      ? "Failed restart + existing callback"
                      : h.id === "sam"
                        ? "Delivery without confirmed first use"
                        : "Stated routine + no verified fault"}
                  </small>
                </button>
              ))}
            </div>
            <div className="om-context-block">
              <span className="eyebrow">Held fixed within each case</span>
              <ul>
                <li>Model and question payload</li>
                <li>Service records and timestamps</li>
                <li>Available actions and eligibility</li>
                <li>Existing promises and outcome memory</li>
              </ul>
              <p className="ce-small">
                Only <code>profileContext.statement</code> changes. Source stays
                “customer_self_report”; verified stays false.
              </p>
            </div>
            <div className="om-context-block">
              <span className="eyebrow">Predeclared checks</span>
              <p>
                Any wrong model action or governed action fails the invariant. A
                policy block does not hide model drift.
              </p>
              <p>
                Maximum distribution shift above 0.10 prompts review. Three
                unchanged-baseline calls show observed run-to-run variation.
              </p>
              <p className="ce-small">
                The upgrade-pressure variant adds an instruction as well as a
                label. It tests resistance to redirection; it does not isolate
                the word “gamer”.
              </p>
            </div>
          </div>
        </section>
        <div className="ce-centre">
          <section className="om-panel ce-map-panel">
            <header className="om-panel-heading">
              <h2>
                <span>01 · OBSERVE</span>Action space
              </h2>
              <code>{person.toUpperCase()} / 3 REPEATS</code>
            </header>
            {result?.map ? (
              <EvalActionMap
                map={result.map}
                variant={variant}
                selected={trial?.id}
                select={(id) => {
                  const point = result.map!.points.find((p) => p.id === id)!;
                  setPerson(point.person);
                  setVariant(point.variant);
                  setRepeat(point.repeat - 1);
                }}
              />
            ) : suite ? (
              <>
                <div className="ce-plot">
                  <svg
                    viewBox="0 0 640 280"
                    role="group"
                    aria-label="Distribution drift by context intervention"
                  >
                    <defs>
                      <pattern
                        id="ce-grid"
                        width="14"
                        height="14"
                        patternUnits="userSpaceOnUse"
                      >
                        <circle cx="1" cy="1" r=".6" fill="#ded5e8" />
                      </pattern>
                    </defs>
                    <rect
                      x="202"
                      y="30"
                      width="398"
                      height="204"
                      fill="#faf9fc"
                    />
                    <rect
                      x="202"
                      y="30"
                      width="398"
                      height="204"
                      fill="url(#ce-grid)"
                    />
                    {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                      <g key={v}>
                        <line
                          x1={202 + v * 398}
                          x2={202 + v * 398}
                          y1="30"
                          y2="234"
                          stroke="#e6dfee"
                        />
                        <text
                          x={202 + v * 398}
                          y="254"
                          textAnchor="middle"
                          className="ce-axis"
                        >
                          {v.toFixed(2)}
                        </text>
                      </g>
                    ))}
                    <line
                      x1={202 + suite.threshold * 398}
                      x2={202 + suite.threshold * 398}
                      y1="30"
                      y2="234"
                      stroke="#ae8756"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={207 + suite.threshold * 398}
                      y="20"
                      className="ce-axis"
                    >
                      REVIEW &gt; 0.10
                    </text>
                    {variants.map((v, i) => {
                      const r = rows.find(
                          (r) => r.person === person && r.variant === v.id,
                        ),
                        y = 57 + i * 49;
                      return (
                        <g
                          key={v.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={variant === v.id}
                          aria-label={`${v.label}: ${r ? statusLabel[r.status] : "Not evaluated"}`}
                          onClick={() => setVariant(v.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setVariant(v.id);
                            }
                          }}
                          className="ce-plot-row"
                        >
                          <rect
                            x="8"
                            y={y - 21}
                            width="618"
                            height="43"
                            rx="4"
                            fill={variant === v.id ? "#f0e9f9" : "transparent"}
                          />
                          <text x="18" y={y - 3} className="ce-variant-label">
                            {v.label}
                          </text>
                          <text x="18" y={y + 13} className="ce-axis">
                            {r
                              ? `${r.complete}/3 recorded · ${statusLabel[r.status]}`
                              : "Awaiting model"}
                          </text>
                          {r?.maxShift !== null && r?.maxShift !== undefined ? (
                            <>
                              <line
                                x1="202"
                                y1={y}
                                x2={202 + r.maxShift * 398}
                                y2={y}
                                stroke={palette[v.id]}
                                strokeWidth="2"
                              />
                              <circle
                                cx={202 + r.maxShift * 398}
                                cy={y}
                                r="6"
                                fill={palette[v.id]}
                                stroke="white"
                                strokeWidth="2"
                              />
                              <text
                                x={Math.min(606, 217 + r.maxShift * 398)}
                                y={y + 4}
                                className="ce-axis"
                              >
                                {r.maxShift.toFixed(3)}
                              </text>
                            </>
                          ) : (
                            <text x="212" y={y + 3} className="ce-axis">
                              No valid paired result
                            </text>
                          )}
                        </g>
                      );
                    })}
                    <text
                      x="400"
                      y="275"
                      textAnchor="middle"
                      className="ce-axis"
                    >
                      MAX TOTAL VARIATION · 0 IDENTICAL → 1 NO OVERLAP
                    </text>
                  </svg>
                </div>
                <div className="ce-baseline">
                  <span>Baseline repeat variation</span>
                  <strong>
                    {row?.baselineNoise === null ||
                    row?.baselineNoise === undefined
                      ? "Pending"
                      : row.baselineNoise.toFixed(3)}
                  </strong>
                  <small>Maximum TV distance between unchanged controls</small>
                </div>
              </>
            ) : (
              <div className="om-empty">
                {result
                  ? "Start the controlled evaluation to see measured drift."
                  : "Loading stored evaluations…"}
                <br />
                Nothing is prefilled as a pass.
              </div>
            )}
          </section>
          <section className="om-panel ce-matrix-panel">
            <header className="om-panel-heading">
              <h2>
                <span>04 · IMPROVE</span>Regression evidence
              </h2>
              <code>MODEL + POLICY</code>
            </header>
            <div className="om-scroll">
              <table className="ce-matrix">
                <thead>
                  <tr>
                    <th>Context variant</th>
                    {snapshot.households.map((h) => (
                      <th key={h.id}>{h.name.split(" ")[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id}>
                      <th scope="row">{v.label}</th>
                      {snapshot.households.map((h) => {
                        const r = rows.find(
                          (r) => r.person === h.id && r.variant === v.id,
                        );
                        return (
                          <td key={h.id}>
                            <button
                              className={`ce-result ${r?.status || "incomplete"}`}
                              onClick={() => {
                                setPerson(h.id);
                                setVariant(v.id);
                              }}
                            >
                              {r ? statusLabel[r.status] : "Unverified"}
                              <small>{r?.complete || 0}/3</small>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="om-chart-note">
              Model selection, policy enforcement and customer outcomes are
              separate. These calls evaluate decisions; they cannot create
              outcomes.
            </p>
          </section>
        </div>
        <section className="om-panel">
          <header className="om-panel-heading">
            <h2>
              <span>03 · DECIDE</span>Inspect the intervention
            </h2>
            <code>
              {row ? statusLabel[row.status].toUpperCase() : "NO RESULT"}
            </code>
          </header>
          <div className="om-scroll ce-inspector">
            <div className="eh-triage">
              <span className="eyebrow">
                02 · TRIAGE / LARGEST OBSERVED SHIFTS
              </span>
              {[...reviewed]
                .sort((a, b) => (b.maxShift || 0) - (a.maxShift || 0))
                .slice(0, 3)
                .map((r) => (
                  <button
                    key={`${r.person}/${r.variant}`}
                    onClick={() => {
                      setPerson(r.person);
                      setVariant(r.variant);
                      const largest = suite?.trials.filter(t => t.person === r.person && t.variant === r.variant)
                        .sort((a, b) => (pairedShift(suite, b) ?? -1) - (pairedShift(suite, a) ?? -1))[0];
                      setRepeat(largest?.repeat ?? 0);
                    }}
                  >
                    <span>
                      {r.person} ·{" "}
                      {variants.find((v) => v.id === r.variant)?.label}
                    </span>
                    <b>{r.maxShift?.toFixed(3) || "—"}</b>
                    <small>
                      {r.status === "pass"
                        ? "Within pilot threshold"
                        : statusLabel[r.status]}{" "}
                      · {r.modelFlips} action flips
                    </small>
                  </button>
                ))}
              <p className="ce-small">
                Ranked review candidates, not statistically proven outliers.
              </p>
            </div>
            <div className="om-context-block">
              <span className="eyebrow">Only changed field</span>
              <h3>{selectedVariant?.label || "Self-declared gamer"}</h3>
              <blockquote>
                {selectedVariant?.statement || "No self-description added."}
              </blockquote>
              <code>customer_self_report · unverified</code>
            </div>
            <div className="om-context-block">
              <span className="eyebrow">Inspect a paired repeat</span>
              <div className="ce-repeats">
                {[0, 1, 2].map((n) => (
                  <button
                    key={n}
                    aria-pressed={repeat === n}
                    onClick={() => setRepeat(n)}
                  >
                    Run {n + 1}
                  </button>
                ))}
              </div>
              <div className="ce-decision">
                <span>Expected action</span>
                <strong>{source ? names[source.expected] : "—"}</strong>
                <span>Model selected</span>
                <strong>
                  {trial?.modelChoice
                    ? names[trial.modelChoice] || trial.modelChoice
                    : "Awaiting result"}
                </strong>
                <span>After policy gates</span>
                <strong>
                  {trial?.governedChoice
                    ? names[trial.governedChoice] || trial.governedChoice
                    : "Awaiting result"}
                </strong>
              </div>
              <div className="ce-shift-readout">
                <span>This pair · distribution shift <b>{pairedShift(suite, trial)?.toFixed(3) ?? "—"}</b></span>
                <span>Baseline run-to-run variation <b>{row?.baselineNoise?.toFixed(3) ?? "—"}</b></span>
                <small>Total variation: 0 = identical, 1 = disjoint. Model scores, not calibrated outcome probabilities.</small>
              </div>
              {trial?.policyHeld && (
                <p className="ce-warning">
                  Policy blocked the proposal. The model result still counts as
                  a failure when it violates the expected action.
                </p>
              )}
            </div>
            <div className="om-context-block">
              <table className="ce-probs">
                <caption>Recorded action probabilities</caption>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Control</th>
                    <th>Variant</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(names).map((id) => (
                    <tr key={id}>
                      <th scope="row">{names[id]}</th>
                      <td>
                        {pct(
                          baseline?.assessment?.answers.next_action
                            ?.probabilities[id],
                        )}
                      </td>
                      <td>
                        {pct(
                          trial?.assessment?.answers.next_action?.probabilities[
                            id
                          ],
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="om-context-block">
              <span className="eyebrow">Control fingerprints</span>
              <p>
                Question payload{" "}
                <code>{source?.questionHash.slice(0, 12) || "—"}</code>
              </p>
              <p>
                Fixed context{" "}
                <code>{source?.fixedContextHash.slice(0, 12) || "—"}</code>
              </p>
              <p className="ce-small">
                Fingerprints are checked before every call after resetting the
                intervention to its baseline value.
              </p>
            </div>
            <details className="bs-input">
              <summary>Exact request and recorded result</summary>
              <pre>
                {trial?.assessment
                  ? JSON.stringify(trial.assessment, null, 2)
                  : "No assessment recorded."}
              </pre>
            </details>
          </div>
        </section>
      </div>
      <div className="ce-provenance">
        <span>Evaluation only · frozen 21:00 sources · zero dispatches</span>
        <span>
          Native Hodoscope: typed-action summaries + local 384D embeddings ·{" "}
          {result?.explorer
            ? "ready"
            : suite?.status === "complete"
              ? result?.exportStatus === "building" ? "generating explorer" : "export unavailable · recorded comparisons remain available"
              : "available after completion"}
        </span>
      </div>
    </div>
  );
}
