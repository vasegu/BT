import { useEffect, useRef, useState } from "react";
import type { BehaviourSpaceData } from "./behaviour-types";
import type { Snapshot, SourceEvent } from "./types";
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
const colors = {
  verified: "#47837f",
  pending: "#b1894e",
  mixed: "#7f71a4",
  reassess: "#ae655e",
  unknown: "#98929f",
};
export const outcomeLabels = {
  verified: "Expected changes verified",
  pending: "Proof outstanding",
  mixed: "Some changes verified",
  reassess: "Contrary evidence",
  unknown: "No verification contract",
};
const groups = ["#7552a5", "#47837f", "#a48757"];
type Run = BehaviourSpaceData["runs"][number];
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
          throw new Error(data.error || "Behaviour space is unavailable.");
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
function hull(points: number[][]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (list: number[][]) => {
    const out: number[][] = [];
    for (const p of list) {
      while (out.length > 1 && cross(out.at(-2)!, out.at(-1)!, p) <= 0)
        out.pop();
      out.push(p);
    }
    return out;
  };
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
}
export function BehaviourSpace({
  data,
  selected,
  select,
  filter,
}: {
  data: BehaviourSpaceData;
  selected?: Run;
  select: (id: string) => void;
  filter: string;
}) {
  const [colour, setColour] = useState<"outcome" | "cluster">("outcome");
  const plot = useRef<HTMLDivElement>(null);
  const [plotHeight, setPlotHeight] = useState(322);
  const runs = data.runs;
  useEffect(() => {
    if (!plot.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height)
        setPlotHeight(Math.max(160, Math.round((height * 660) / width)));
    });
    observer.observe(plot.current);
    return () => observer.disconnect();
  }, [runs.length]);
  if (!runs.length)
    return (
      <div className="om-empty">
        No recorded decisions yet. Run the first scenario event to populate this
        space.
      </div>
    );
  const xs = runs.map((r) => r.position[0]),
    ys = runs.map((r) => r.position[1]);
  const range = (values: number[]) => {
    const lo = Math.min(...values),
      hi = Math.max(...values),
      pad = Math.max(0.05, (hi - lo) * 0.18);
    return [lo - pad, hi + pad];
  };
  const [x0, x1] = range(xs),
    [y0, y1] = range(ys);
  const floor = plotHeight - 43;
  const x = (v: number) => 62 + ((v - x0) / (x1 - x0)) * 535,
    y = (v: number) => floor - 12 - ((v - y0) / (y1 - y0)) * (floor - 52);
  const active = runs.filter((r) => filter === "all" || r.person === filter);
  const stacks = new Map<string, Run[]>();
  for (const r of active) {
    const key = r.position.map((n) => n.toFixed(6)).join("/");
    stacks.set(key, [...(stacks.get(key) || []), r]);
  }
  const lineage = active.filter((r) => r.person === selected?.person);
  const clusterIds = [...new Set(runs.map((r) => r.cluster))];
  const shade = (run: Run) =>
    colour === "outcome"
      ? colors[run.outcome]
      : groups[run.cluster % groups.length];
  return (
    <>
      <div className="bs-toolbar">
        <span>
          <b>{active.length}</b> / {runs.length} runs ·{" "}
          <b>{data.manifest.uniqueInputs}</b> distinct inputs
        </span>
        <label>
          Colour
          <select
            aria-label="Colour behaviour space"
            value={colour}
            onChange={(e) => setColour(e.target.value as typeof colour)}
          >
            <option value="outcome">Observed change</option>
            <option value="cluster">Semantic group</option>
          </select>
        </label>
      </div>
      <div className="bs-plot-wrap" ref={plot}>
        <svg
          className="bs-plot"
          viewBox={`0 0 660 ${plotHeight}`}
          aria-label="Hodoscope-style map of embedded decision runs"
        >
          <defs>
            <pattern
              id="bs-grid"
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".6" fill="#d4cddf" />
            </pattern>
            <marker
              id="bs-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0 0L8 4L0 8" fill="none" stroke="#9987b1" />
            </marker>
          </defs>
          <rect
            x="42"
            y="23"
            width="573"
            height={floor - 15}
            fill="#fbfafc"
            stroke="#ece8f0"
          />
          <rect
            x="42"
            y="23"
            width="573"
            height={floor - 15}
            fill="url(#bs-grid)"
            opacity=".6"
          />
          {(plotHeight < 240 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map(
            (t) => (
              <g key={t}>
                <line
                  x1={x(x0 + t * (x1 - x0))}
                  x2={x(x0 + t * (x1 - x0))}
                  y1="23"
                  y2={floor + 8}
                  stroke="#e9e4ef"
                  strokeDasharray="2 4"
                />
                <text
                  x={x(x0 + t * (x1 - x0))}
                  y={floor + 22}
                  textAnchor="middle"
                  className="bs-axis"
                >
                  {(x0 + t * (x1 - x0)).toFixed(2)}
                </text>
                <line
                  x1="42"
                  x2="615"
                  y1={y(y0 + t * (y1 - y0))}
                  y2={y(y0 + t * (y1 - y0))}
                  stroke="#e9e4ef"
                  strokeDasharray="2 4"
                />
                <text
                  x="36"
                  y={y(y0 + t * (y1 - y0)) + 3}
                  textAnchor="end"
                  className="bs-axis"
                >
                  {(y0 + t * (y1 - y0)).toFixed(2)}
                </text>
              </g>
            ),
          )}
          <text x="48" y="15" className="bs-axis">
            PC2 · {(data.manifest.variance[1] * 100).toFixed(1)}%
          </text>
          <text x="615" y={plotHeight - 3} textAnchor="end" className="bs-axis">
            PC1 · {(data.manifest.variance[0] * 100).toFixed(1)}%
          </text>
          {clusterIds.map((cluster) => {
            const members = runs.filter((r) => r.cluster === cluster),
              points = members.map((r) => [x(r.position[0]), y(r.position[1])]);
            const unique = [
                ...new Map(points.map((p) => [p.join("/"), p])).values(),
              ],
              boundary = hull(unique);
            const minX = Math.min(...points.map((p) => p[0])),
              minY = Math.min(...points.map((p) => p[1]));
            const commonDomain = [
              ...new Set(members.map((r) => r.domain)),
            ].sort(
              (a, b) =>
                members.filter((r) => r.domain === b).length -
                members.filter((r) => r.domain === a).length,
            )[0];
            return (
              <g key={cluster} pointerEvents="none">
                <path
                  d={
                    unique.length === 1
                      ? `M${unique[0]}h.01`
                      : `M${(boundary.length ? boundary : unique).map((p) => p.join(",")).join("L")}Z`
                  }
                  stroke={groups[cluster]}
                  strokeWidth="25"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill={groups[cluster]}
                  opacity=".09"
                />
                <text
                  x={minX - 5}
                  y={minY - 21}
                  fill={groups[cluster]}
                  className="bs-cluster-label"
                >
                  C{cluster + 1} · {commonDomain.toUpperCase()} /{" "}
                  {members.length}
                </text>
              </g>
            );
          })}
          {lineage.slice(1).map((r, i) => {
            const previous = lineage[i];
            return (
              <path
                key={r.id}
                d={`M${x(previous.position[0])},${y(previous.position[1])}L${x(r.position[0])},${y(r.position[1])}`}
                fill="none"
                stroke="#9987b1"
                strokeWidth="1.2"
                markerEnd="url(#bs-arrow)"
                opacity=".6"
              />
            );
          })}
          {[...stacks.values()].map((stack) => {
            const run = stack.find((r) => r.id === selected?.id) || stack[0],
              cx = x(run.position[0]),
              cy = y(run.position[1]),
              chosen = stack.some((r) => r.id === selected?.id);
            const pick = () =>
              select(
                stack[
                  (stack.findIndex((r) => r.id === selected?.id) + 1) %
                    stack.length
                ].id,
              );
            return (
              <g
                key={stack[0].id}
                role="button"
                tabIndex={0}
                className="bs-point"
                aria-pressed={chosen}
                aria-label={`${run.person}, revision ${run.revision}: ${run.title}${stack.length > 1 ? `, ${stack.length} overlapping runs; activate to cycle` : ""}`}
                onClick={pick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick();
                  }
                }}
              >
                <title>
                  {run.title} · {time(run.time)} · {outcomeLabels[run.outcome]}
                  {stack.length > 1
                    ? ` · ${stack.length} matching vectors`
                    : ""}
                </title>
                <circle cx={cx} cy={cy} r="14" fill="transparent" />
                {chosen && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="11"
                    fill="white"
                    stroke="#5514b4"
                    strokeWidth="1.2"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={stack.length > 1 ? 6 : 4.5}
                  fill={shade(run)}
                  stroke="white"
                  strokeWidth="1.5"
                />
                {(chosen || stack.length > 1) && (
                  <text x={cx + 13} y={cy + 4} className="bs-point-label">
                    {chosen ? `${run.person} · ${time(run.time)}` : ""}
                    {stack.length > 1 ? ` ×${stack.length}` : ""}
                  </text>
                )}
              </g>
            );
          })}
          {selected && (
            <text x="52" y={floor + 4} className="bs-axis">
              {selected.person.toUpperCase()} PATH · REVISIONS{" "}
              {lineage.map((r) => r.revision).join(" → ")}
            </text>
          )}
        </svg>
      </div>
      <div className="bs-legend">
        {colour === "outcome"
          ? [...new Set(runs.map((r) => r.outcome))].map((status) => (
              <span key={status}>
                <i style={{ background: colors[status] }} />
                {outcomeLabels[status]}
              </span>
            ))
          : clusterIds.map((c) => (
              <span key={c}>
                <i style={{ background: groups[c] }} />C{c + 1} · cosine group
              </span>
            ))}
      </div>
      <p className="om-chart-note">
        Closer means similar context + action. Envelopes mark 384D cosine
        groups; axes are a lossy projection. Colour shows the person’s
        associated observations at this cutoff, not causal success.
      </p>
    </>
  );
}
export function BehaviourInspector({
  run,
  data,
  snapshot,
  inspect,
  select,
  verify,
}: {
  run: Run;
  data: BehaviourSpaceData;
  snapshot: Snapshot;
  inspect: (e: SourceEvent) => void;
  select: (id: string) => void;
  verify: (id: string) => void;
}) {
  const events = snapshot.events.filter((e) => run.evidenceIds.includes(e.id));
  return (
    <div className="om-scroll bs-inspector">
      <div className="om-inspector-title">
        <span className="eyebrow">
          {run.person} / {time(run.time)} / REV {run.revision}
        </span>
        <h3>{run.title}</h3>
        <span className="om-status">{run.assessment}</span>
      </div>
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
          Associated expectations / AS OF {time(snapshot.clock)}
        </span>
        <p>
          {outcomeLabels[run.outcome]}. These contracts concern this person;
          they do not attribute recovery to this one action.
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
        <span className="eyebrow">Nearest runs / original 384D cosine</span>
        {run.neighbours.map((n) => {
          const neighbour = data.runs.find((r) => r.id === n.id)!;
          return (
            <button
              className="bs-neighbour"
              key={n.id}
              onClick={() => select(n.id)}
            >
              <span>
                <strong>
                  {neighbour.person} · rev {neighbour.revision}
                </strong>
                <small>{neighbour.title}</small>
              </span>
              <code>{n.similarity.toFixed(3)} ↗</code>
            </button>
          );
        })}
      </div>
      <div className="om-context-block">
        <span className="eyebrow">Source evidence at decision time</span>
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
        <summary>Exact embedding input</summary>
        <p>{run.input}</p>
        <code>{data.manifest.model} · 384D</code>
        <p>{data.manifest.fit}</p>
      </details>
    </div>
  );
}
