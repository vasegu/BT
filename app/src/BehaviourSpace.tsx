import { expressionPairs } from "./expression-pairs";
import { useEffect, useState } from "react";
import type { BehaviourSpaceData, ContextContrast } from "./behaviour-types";
import type { Snapshot, SourceEvent } from "./types";
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
export const outcomeLabels = {
  verified: "Expected changes verified",
  pending: "Proof outstanding",
  mixed: "Some changes verified",
  reassess: "Contrary evidence",
  unknown: "No verification contract",
};
type Run = BehaviourSpaceData["runs"][number];
export const actionNames: Record<string, string> = {
  confirmation: "Confirm recovery",
  restoration: "Recovery follow-up",
  incident: "Explain incident",
  recovery: "Keep recovery plan",
  activation: "Support first use",
  callback: "Arrange callback",
  restart: "Restart hub",
  watch: "Observe quietly",
  offer: "Make an offer",
  defer: "Hold / review",
};
const actionName = (id: string) => actionNames[id] || id;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const label = (r: Run) => `${r.person} · ${time(r.time)}`;
const human = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
const value = (v: unknown) =>
  v === null || v === undefined
    ? "Not recorded"
    : typeof v === "boolean"
      ? v
        ? "Yes"
        : "No"
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);
export function contrastNarrative(a?: Run, b?: Run) {
  if (!a || !b)
    return "One quiet router. A routine, an incomplete start, or a promise BT needs to keep.";
  if (a.person !== b.person) {
    if (a.facts.statedPreference !== b.facts.statedPreference)
      return "A remembered routine can support a quiet watch. A service case or incomplete first use needs attention.";
    if (a.facts.activation !== b.facts.activation)
      return "An incomplete start and an existing service case need different plans. Delivered does not mean activated.";
    return "The same operational event reaches different customer histories. Compare the facts and permissions.";
  }
  if (a.facts.customerConfirmed !== b.facts.customerConfirmed)
    return "A restored line, a kept promise and customer confirmation are three separate pieces of evidence.";
  if (a.facts.callbackFulfilled !== b.facts.callbackFulfilled)
    return "The line can recover before the human commitment is fulfilled. Both need their own evidence.";
  if (a.facts.technicalRecovery !== b.facts.technicalRecovery)
    return "Fresh recovery evidence changes the next message; existing promises remain attached.";
  if (a.facts.incidentInScope !== b.facts.incidentInScope)
    return "Incident scope adds shared network context to the customer's existing story.";
  return "Compare what BT knew at each moment, the response it selected, and what still needed proof.";
}

export function useBehaviourSpace(snapshot: Snapshot) {
  const key = `${snapshot.session.id}/${snapshot.cutoff}/${snapshot.decisions.length}`;
  const [result, setResult] = useState<{
    key: string;
    data?: BehaviourSpaceData;
    error?: string;
  }>();
  useEffect(() => {
    const abort = new AbortController();
    fetch(
      `/api/behaviour-space?session=${snapshot.session.id}&at=${snapshot.cutoff}`,
      { signal: abort.signal },
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok)
          throw new Error(data.error || "Context space is unavailable.");
        return data as BehaviourSpaceData;
      })
      .then((data) => setResult({ key, data }))
      .catch((error) => {
        if (!abort.signal.aborted)
          setResult({ key, error: String(error.message) });
      });
    return () => abort.abort();
  }, [key, snapshot.session.id, snapshot.cutoff]);
  return result?.key === key ? result : { key };
}

export function ContextContrasts({
  data,
  selected,
  reference,
  filter,
  compare,
}: {
  data: BehaviourSpaceData;
  selected?: Run;
  reference?: Run;
  filter: string;
  compare: (a: string, b: string) => void;
}) {
  const [mode, setMode] = useState<"signal" | "time" | "action">("action");
  const visible = (mode === "action" ? expressionPairs(data.runs) : data.contrasts).filter((c) => {
    const a = data.runs.find((r) => r.id === c.a)!,
      b = data.runs.find((r) => r.id === c.b)!;
    return (
      (filter === "all" || (a.person === filter && b.person === filter)) &&
      (mode === "action"
        ? a.selectedAction === b.selectedAction && a.expression.messages.length > 0 && b.expression.messages.length > 0 && a.expression.summary !== b.expression.summary
        : (mode === "signal" ? a.revision === b.revision && !c.samePerson : c.samePerson) && (c.actionShift ?? 0) > 0.005)
    );
  });
  return (
    <div className="om-scroll cs-contrasts">
      <div className="om-context-block">
        <span className="eyebrow">A place to investigate</span>
        <h3>
          Similar context.
          <br />
          Different response.
        </h3>
        <p>Context can change the plan, or how the same plan is expressed.</p>
        <div className="cs-switch" aria-label="Compare contexts">
          <button aria-pressed={mode === "action"} onClick={() => setMode("action")}>Within an action</button>
          <button
            aria-pressed={mode === "signal"}
            onClick={() => setMode("signal")}
          >
            Same signal
          </button>
          <button
            aria-pressed={mode === "time"}
            onClick={() => setMode("time")}
          >
            Across time
          </button>
        </div>
      </div>
      {visible.slice(0, 12).map((c, i) => {
        const a = data.runs.find((r) => r.id === c.a)!,
          b = data.runs.find((r) => r.id === c.b)!;
        const chosen =
          (selected?.id === b.id && reference?.id === a.id) ||
          (selected?.id === a.id && reference?.id === b.id);
        return (
          <button
            className="cs-contrast"
            key={`${c.a}/${c.b}`}
            aria-pressed={chosen}
            onClick={() => compare(a.id, b.id)}
          >
            <span className="cs-contrast-top">
              <code>{String(i + 1).padStart(2, "0")}</code>
              <span>
                {c.samePerson ? a.person : `${a.person} / ${b.person}`}
              </span>
              <small>
                {time(a.time)}
                {a.time !== b.time ? ` → ${time(b.time)}` : ""}
              </small>
            </span>
            <strong>
              {actionName(a.selectedAction)} <span>→</span>{" "}
              {actionName(b.selectedAction)}
            </strong>
            <span className="cs-pair-metrics">
              <span>
                <b>{c.similarity?.toFixed(3) ?? "Actual"}</b> {mode === "action" ? "wording" : "similarity"}
              </span>
              <span>
                <b>{c.actionShift?.toFixed(2) ?? "Same"}</b> {mode === "action" ? "action" : "shift"}
              </span>
            </span>
            <span className={`cs-prompt-note ${c.samePrompt ? "stable" : ""}`}>
              {mode === "action" ? "Recorded expression comparison · no probability claim" : c.samePrompt ? "Same question payload" : "Prompt also changed"}
            </span>
          </button>
        );
      })}
      {!visible.length && (
        <p className="om-empty">
          {filter !== "all" && mode === "signal"
            ? "Choose all three people to compare the same signal across households, or compare this person across time."
            : "No comparable model distributions at this cutoff. Recorded policy decisions remain inspectable."}
        </p>
      )}
      <div className="om-context-block cs-method">
        <span className="eyebrow">Recorded contrasts</span>
        <p>
          The same plan can carry different commitments and wording. Compare the source context and actual response; a difference alone is not a failure.
        </p>
      </div>
    </div>
  );
}

export function BehaviourSpace({
  data,
  selected,
  reference,
  contrast,
  select,
  setReference,
  filter,
}: {
  data: BehaviourSpaceData;
  selected?: Run;
  reference?: Run;
  contrast?: ContextContrast;
  select: (id: string) => void;
  setReference: (id: string) => void;
  filter: string;
}) {
  const runs = data.runs.filter((r) => filter === "all" || r.person === filter);
  if (!selected)
    return (
      <div className="om-empty">
        Run the first scenario event to populate this space.
      </div>
    );
  const actions = [
    ...new Set([
      ...Object.keys(actionNames),
      ...Object.keys(selected.probabilities || {}),
      ...Object.keys(reference?.probabilities || {}),
    ]),
  ];
  const points = data.runs;
  const extent = (axis: number) => {
    const vs = points.map((r) => r.position[axis]);
    const lo = Math.min(...vs),
      hi = Math.max(...vs);
    return [lo, Math.max(0.03, hi - lo)];
  };
  const [x0, dx] = extent(0),
    [y0, dy] = extent(1);
  const xy = (r: Run) => [
    35 + ((r.position[0] - x0) / dx) * 120,
    208 - ((r.position[1] - y0) / dy) * 143,
  ];
  const stacks = new Map<string, Run[]>();
  for (const r of runs) {
    const key = r.position.map((n) => n.toFixed(6)).join("/");
    stacks.set(key, [...(stacks.get(key) || []), r]);
  }
  const hasModel = !!selected.probabilities;
  return (
    <>
      <div className="cs-pickers">
        <label>
          <i className="cs-key a">A</i>
          <select
            aria-label="Reference decision context"
            value={reference?.id || ""}
            onChange={(e) => setReference(e.target.value)}
          >
            <option value="" disabled>
              Choose reference
            </option>
            {runs
              .filter((r) => r.id !== selected.id)
              .map((r) => (
                <option value={r.id} key={r.id}>
                  {label(r)} · r{r.revision}
                </option>
              ))}
          </select>
        </label>
        <label>
          <i className="cs-key b">B</i>
          <select
            aria-label="Selected decision context"
            value={selected.id}
            onChange={(e) => select(e.target.value)}
          >
            {runs.map((r) => (
              <option value={r.id} key={r.id}>
                {label(r)} · r{r.revision}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="cs-stage">
        <svg
          viewBox="0 0 650 292"
          role="group"
          aria-label="Factual context neighbourhood connected to recorded action distributions"
        >
          <defs>
            <pattern
              id="cs-dots"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".6" fill="#d4cddf" />
            </pattern>
          </defs>
          <text x="17" y="19" className="cs-svg-heading">
            01 / CONTEXT NEIGHBOURHOOD
          </text>
          <text x="246" y="19" className="cs-svg-heading">
            02 / POSSIBLE ACTIONS
          </text>
          <rect
            x="17"
            y="37"
            width="169"
            height="195"
            rx="5"
            fill="#faf9fc"
            stroke="#e9e3f0"
          />
          <rect x="17" y="37" width="169" height="195" fill="url(#cs-dots)" />
          {[0.25, 0.5, 0.75].map((v) => (
            <g key={v} stroke="#ece7f2" strokeDasharray="2 4">
              <line x1={17 + 169 * v} x2={17 + 169 * v} y1="37" y2="232" />
              <line x1="17" x2="186" y1={37 + 195 * v} y2={37 + 195 * v} />
            </g>
          ))}
          {reference && (
            <line
              x1={xy(reference)[0]}
              y1={xy(reference)[1]}
              x2={xy(selected)[0]}
              y2={xy(selected)[1]}
              stroke="#aaa0b6"
              strokeDasharray="3 3"
            />
          )}
          {[...stacks.values()].map((stack) => {
            const r =
                stack.find((r) => r.id === selected.id) ||
                stack.find((r) => r.id === reference?.id) ||
                stack[0],
              [x, y] = xy(r);
            const b = stack.some((r) => r.id === selected.id),
              a = stack.some((r) => r.id === reference?.id);
            const pick = () =>
              select(
                stack[
                  (stack.findIndex((r) => r.id === selected.id) + 1) %
                    stack.length
                ].id,
              );
            return (
              <g
                key={stack[0].id}
                role="button"
                tabIndex={0}
                aria-pressed={b}
                className="bs-point"
                aria-label={`${label(r)}, ${stack.length} matching context ${stack.length === 1 ? "run" : "runs"}; select or cycle`}
                onClick={pick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick();
                  }
                }}
              >
                <title>
                  {stack
                    .map((r) => `${label(r)} / ${actionName(r.selectedAction)}`)
                    .join("; ")}
                </title>
                <circle cx={x} cy={y} r="12" fill="transparent" />
                {(a || b) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={a && !b ? 12 : 9}
                    fill="white"
                    stroke={a && b ? "#47837f" : b ? "#5514b4" : "#47837f"}
                    strokeWidth="1.5"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={a || b ? 4 : 3.5}
                  fill={b ? "#5514b4" : a ? "#47837f" : "#b4a9c7"}
                />
                {(a || b) && (
                  <text
                    x={a && !b ? x - 13 : x + 11}
                    textAnchor={a && !b ? "end" : "start"}
                    y={y - 9}
                    className="cs-point-label"
                    style={{ fill: a && !b ? "#47837f" : "#5514b4" }}
                  >
                    {a && b ? "A · B" : b ? "B" : "A"}
                  </text>
                )}
                {stack.length > 1 && (
                  <text x={x + 10} y={y + 13} className="cs-stack-count">
                    ×{stack.length}
                  </text>
                )}
              </g>
            );
          })}
          <text x="17" y="249" className="cs-svg-small">
            384D facts → 2D PCA
          </text>
          <text x="17" y="264" className="cs-svg-small">
            {pct(data.manifest.variance.slice(0, 2).reduce((a, b) => a + b, 0))}{" "}
            variance retained
          </text>
          <path d="M195 135H231" stroke="#c4b8d4" fill="none" />
          <path d="M226 131l5 4-5 4" stroke="#c4b8d4" fill="none" />
          <path
            d="M260 136Q340 37 409 41L409 259Q330 253 260 151Z"
            fill="#f7f4fb"
          />
          <text x="572" y="35" className="cs-svg-small" fill="#47837f">
            A
          </text>
          <text x="612" y="35" className="cs-svg-small" fill="#5514b4">
            B
          </text>
          {actions.map((action, i) => {
            const y = 48 + i * 23.1,
              pa = reference?.probabilities?.[action],
              pb = selected.probabilities?.[action];
            const blocked =
              !selected.eligibleActions.includes(action) && action !== "defer";
            return (
              <g key={action}>
                <path
                  d={`M260 136C320 136 330 ${y} 409 ${y}`}
                  stroke="#e3dce9"
                  strokeWidth=".6"
                  fill="none"
                />
                {pa !== undefined && pa > 0.001 && (
                  <path
                    d={`M260 136C320 136 330 ${y - 2} 409 ${y - 2}`}
                    stroke="#47837f"
                    strokeWidth={0.5 + pa * 7}
                    opacity=".65"
                    fill="none"
                  />
                )}
                {pb !== undefined && pb > 0.001 && (
                  <path
                    d={`M260 151C320 151 330 ${y + 2} 409 ${y + 2}`}
                    stroke="#5514b4"
                    strokeWidth={0.5 + pb * 7}
                    opacity=".8"
                    fill="none"
                  />
                )}
                <circle
                  cx="409"
                  cy={y}
                  r={selected.selectedAction === action ? 4 : 2}
                  fill={
                    selected.selectedAction === action ? "#5514b4" : "#c7bed4"
                  }
                />
                <text
                  x="422"
                  y={y + 3}
                  className={`cs-action-label ${selected.selectedAction === action ? "chosen" : ""}`}
                >
                  {actionName(action)}
                  {blocked ? " ×" : ""}
                </text>
                <text x="587" y={y + 3} textAnchor="end" className="cs-prob a">
                  {pa === undefined ? "—" : pct(pa)}
                </text>
                <text
                  x="629"
                  y={y + 3}
                  textAnchor="end"
                  className={`cs-prob ${pb && pb >= 0.7 ? "chosen" : ""}`}
                >
                  {pb === undefined ? "—" : pct(pb)}
                </text>
              </g>
            );
          })}
          <circle
            cx="260"
            cy="136"
            r="6"
            fill="#47837f"
            stroke="white"
            strokeWidth="2"
          />
          <circle
            cx="260"
            cy="151"
            r="6"
            fill="#5514b4"
            stroke="white"
            strokeWidth="2"
          />
          <text x="246" y="282" className="cs-svg-small">
            {hasModel
              ? "Width = recorded model probability · × = B policy excludes"
              : "Policy-only run · model probabilities unavailable"}
          </text>
        </svg>
      </div>
      <div className="cs-governed">
        <span className="eyebrow">03 / ACTION + EXPRESSION · B</span>
        <strong>{actionName(selected.selectedAction)}</strong>
        <span>
          {selected.modelChoice &&
          selected.modelChoice !== selected.selectedAction
            ? `Model preferred ${actionName(selected.modelChoice)}; policy held.`
            : `${selected.expression.channel} · ${selected.expression.modifiers[0].value}`}
        </span>
      </div>
      <p className="om-chart-note">
        {contrast
          ? `Context cosine ${contrast.similarity.toFixed(3)} · distribution shift ${contrast.actionShift.toFixed(2)} / 1. `
          : ""}
        The fan shows the plan; tone, commitments and exact wording are compared in the response inspector. No probability is invented for those modifiers.
      </p>
    </>
  );
}

export function ActionExpression({ run, reference }: { run: Run; reference?: Run }) {
  return <div className="om-context-block cs-expression">
    <span className="eyebrow">Inside the action / how it is expressed</span>
    <p>{reference?.selectedAction === run.selectedAction ? "Same plan. Context changes the delivery." : "Selecting a plan is only part of the response."}</p>
    <table><thead><tr><th>Modifier</th>{reference && <th>A · {reference.person}</th>}<th>B · {run.person}</th></tr></thead><tbody>
      {run.expression.modifiers.map((m,i)=><tr key={m.label}><th title={m.basis}>{m.label}</th>{reference && <td>{reference.expression.modifiers[i]?.value || "—"}</td>}<td>{m.value}</td></tr>)}
    </tbody></table>
    <details open={!!reference && reference.selectedAction === run.selectedAction}>
      <summary>Exact recorded wording · A / B</summary>
      {[reference,run].filter(Boolean).map((r,i)=><div className="cs-wording" key={r!.id}><code>{i === 0 && reference ? "A" : "B"} / {r!.person} / {time(r!.time)}</code>{r!.expression.messages.length ? r!.expression.messages.map(m=><blockquote key={m.id}><strong>{m.title}</strong><p>{m.body}</p></blockquote>) : <p>No new message was committed in this run.</p>}</div>)}
    </details>
    <small>{run.expression.provenance}. The model chooses the plan; this version does not generate free-form tone.</small>
  </div>;
}

export function BehaviourInspector({
  run,
  reference,
  contrast,
  data,
  snapshot,
  inspect,
  verify,
}: {
  run: Run;
  reference?: Run;
  contrast?: ContextContrast;
  data: BehaviourSpaceData;
  snapshot: Snapshot;
  inspect: (e: SourceEvent) => void;
  verify: (id: string) => void;
}) {
  const events = snapshot.events.filter((e) =>
    run.inputEvidenceIds.includes(e.id),
  );
  const flipped = contrast && contrast.b !== run.id;
  return (
    <div className="om-scroll bs-inspector">
      <div className="om-inspector-title">
        <span className="eyebrow">
          B / {label(run)} / REV {run.revision}
        </span>
        <h3>{run.title}</h3>
        <span className="om-status">{run.assessment}</span>
      </div>
      <ActionExpression run={run} reference={reference} />
      {contrast && reference && (
        <>
          <div className="om-context-block cs-reading">
            <span className="eyebrow">What changed between A and B?</span>
            <div className="cs-metrics">
              <span>
                <b>{contrast.similarity.toFixed(3)}</b>Context cosine
              </span>
              <span>
                <b>{contrast.actionShift.toFixed(2)}</b>Action shift / 1
              </span>
            </div>
            <p>
              {contrast.actionChanged
                ? "The governed action changed."
                : "The governed action stayed the same."}{" "}
              {contrast.samePerson
                ? "One customer, two recorded moments."
                : "Two households responding to the same scenario."}
            </p>
          </div>
          <div className="om-context-block">
            <span className="eyebrow">Factual differences / A → B</span>
            {contrast.facts.length ? (
              contrast.facts.map((f) => (
                <div className="cs-fact" key={f.key}>
                  <strong>{human(f.key)}</strong>
                  <div>
                    <span>{value(flipped ? f.after : f.before)}</span>
                    <i>→</i>
                    <span>{value(flipped ? f.before : f.after)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p>
                No differences in the factual fields embedded here. Check the
                other input sections below.
              </p>
            )}
          </div>
          <div className="om-context-block cs-control-check">
            <span className="eyebrow">Comparison controls</span>
            <strong>
              {contrast.samePrompt
                ? "Same question payload"
                : "Prompt also changed"}
            </strong>
            <p>
              {contrast.samePrompt
                ? "The questions and action wording match. Other retrieved context may still differ."
                : "The questions or action wording differ. This is an observational contrast, not evidence that one fact caused the shift."}
            </p>
            <div className="cs-hash">
              <span>A {reference.promptHash?.slice(0, 8) || "—"}</span>
              <span>B {run.promptHash?.slice(0, 8) || "—"}</span>
            </div>
            <p>
              Other changed inputs:{" "}
              {contrast.otherChanges.map(human).join(", ") || "none"}.
            </p>
            <p>
              Eligibility changed:{" "}
              {contrast.eligibilityChanged.map(actionName).join(", ") || "none"}
              .
            </p>
            <code>
              {run.model} · {run.promptVersion}
            </code>
            <details className="cs-method-details">
              <summary>How to establish sensitivity</summary>
              <p>
                Hold the model, questions, candidate policy and other context
                fixed. Change one supported fact, repeat the evaluation, and
                compare the action distributions. These recorded runs have not
                undergone that controlled test.
              </p>
              <p>
                Shift is total variation distance: 0 = identical distributions;
                1 = no overlap. Probabilities are model outputs, not calibrated
                outcome likelihoods.
              </p>
            </details>
          </div>
        </>
      )}
      {!contrast && (
        <div className="om-context-block">
          <p>
            {run.probabilities
              ? "Select another run with the same model to inspect the context contrast."
              : "This run has no successful model distribution. Its policy decision and source evidence remain available."}
          </p>
        </div>
      )}
      <details className="bs-input cs-probability-details">
        <summary>Inspect action probabilities & policy</summary>
        <table className="cs-probability-table">
          <caption>
            Recorded model probabilities. A:{" "}
            {reference ? label(reference) : "No reference"}. B: {label(run)}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col">A</th>
              <th scope="col">B</th>
              <th scope="col">B policy</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...new Set([
                ...Object.keys(actionNames),
                ...Object.keys(reference?.probabilities || {}),
                ...Object.keys(run.probabilities || {}),
              ]),
            ].map((id) => (
              <tr key={id}>
                <th scope="row">
                  {actionName(id)}
                  {run.selectedAction === id ? " · selected" : ""}
                </th>
                <td>
                  {reference?.probabilities?.[id] === undefined
                    ? "—"
                    : `${(reference.probabilities[id] * 100).toFixed(2)}%`}
                </td>
                <td>
                  {run.probabilities?.[id] === undefined
                    ? "—"
                    : `${(run.probabilities[id] * 100).toFixed(2)}%`}
                </td>
                <td>
                  {id === "defer"
                    ? "Fallback"
                    : run.eligibleActions.includes(id)
                      ? "Eligible"
                      : "Excluded"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Missing probabilities are shown as a dash. Model preference:{" "}
          {run.modelChoice ? actionName(run.modelChoice) : "unavailable"}.
          Governed selection: {actionName(run.selectedAction)}.
        </p>
      </details>
      <div className="om-context-block">
        <span className="eyebrow">Decision as recorded</span>
        <p>{run.reason}</p>
        <code>
          {run.id.slice(0, 8)} · {run.domain}
        </code>
        <p>
          {run.actionIds.length
            ? `${run.actionIds.length} committed customer action. Delivery is simulated.`
            : "No new customer action committed in this run."}
        </p>
        {snapshot.actions
          .filter((a) => run.actionIds.includes(a.id))
          .map((a) => (
            <div className="bs-receipt" key={a.id}>
              <strong>{a.title}</strong>
              <code>
                {a.id.slice(0, 8)} → {a.receiptId?.slice(0, 8) || "pending"}
              </code>
            </div>
          ))}
      </div>
      <div className="om-context-block">
        <span className="eyebrow">
          04 / Did it help? · as of {time(snapshot.clock)}
        </span>
        <p>
          {outcomeLabels[run.outcome]}. These observations concern this person;
          they do not attribute recovery to this action.
        </p>
        {snapshot.operations.outcomes
          .filter((o) => run.outcomeIds.includes(o.id))
          .map((o) => (
            <button
              className="om-source"
              key={o.id}
              onClick={() => verify(o.id)}
            >
              <span>
                <strong>{o.title}</strong>
                <small>{o.check.status} · inspect proof</small>
              </span>
              <span>↗</span>
            </button>
          ))}
      </div>
      <div className="om-context-block">
        <span className="eyebrow">Retrieved evidence / B decision time</span>
        {events.map((e) => (
          <button className="om-source" key={e.id} onClick={() => inspect(e)}>
            <span>
              <code>{e.type}</code>
              <small>
                {time(e.occurredAt)} · {e.id.slice(0, 8)}
              </small>
            </span>
            <span>↗</span>
          </button>
        ))}
      </div>
      <details className="bs-input">
        <summary>Exact embedding input & method</summary>
        <p>{run.input}</p>
        <code>
          {data.manifest.model} · {data.manifest.dimensions}D
        </code>
        <p>{data.manifest.fit}</p>
      </details>
    </div>
  );
}
