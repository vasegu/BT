import { useEffect, useMemo, useState } from "react";
import type { Household, PersonId, Snapshot, SourceEvent } from "./types";
import type { MemoryLayer, MemoryMapData } from "./memory-map-types";
import { moments } from "./presentation";
import { GRID_W, GRID_H, CONTOUR_LEVELS, CONTOUR_ALPHAS, gaussianKDE, makeContourPaths, niceTicks } from "./hodoscope-specs";
import "./memory-map.css";

// Small multiples: one memory space per person, built from their own records alone, drawn
// identically. The same alarm lands in each; what it sits closest to is what it reminds us
// of in that person's history. Individual memory, not a segment.
const PEOPLE: PersonId[] = ["daniel", "sam", "maya"];
const LAYERS: [MemoryLayer, string, string][] = [
  ["identity", "Identity", "#6d6875"],
  ["behavioural", "Behavioural", "#8c7ab8"],
  ["service", "Service", "#2a78d6"],
  ["context", "Context", "#c2416b"],
  ["emotional", "Emotional", "#d08a3c"],
  ["intentional", "Intentional", "#0e9aa7"],
];
const LAYER_NAME = Object.fromEntries(LAYERS.map(([k, n]) => [k, n])) as Record<MemoryLayer, string>;
const LAYER_TINT = Object.fromEntries(LAYERS.map(([k, , c]) => [k, c])) as Record<MemoryLayer, string>;
const STAR = "M0,-7 L2,-2.2 7,-2.2 3,1 4.5,6.2 0,3.1 -4.5,6.2 -3,1 -7,-2.2 -2,-2.2Z";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
type Point = MemoryMapData["points"][number];

let baked: Promise<MemoryMapData> | null = null;
function useMemoryMap() {
  const [state, setState] = useState<{ data?: MemoryMapData; error?: string }>({});
  useEffect(() => {
    let live = true;
    baked ||= fetch("/memory-map.json").then(async (r) => {
      if (!r.ok) throw new Error("The memory map has not been built. Run npm run build:memory.");
      return (await r.json()) as MemoryMapData;
    });
    baked.then(
      (data) => live && setState({ data }),
      (e) => {
        baked = null;
        if (live) setState({ error: (e as Error).message });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

function Space({
  points,
  query,
  trail,
  layer,
  hover,
  setHover,
  open,
}: {
  points: Point[];
  query?: MemoryMapData["queries"][number];
  trail: MemoryMapData["queries"];
  layer: MemoryLayer | null;
  hover: string | null;
  setHover: (id: string | null) => void;
  open: (id: string) => void;
}) {
  const S = 320,
    L = 8,
    T = 8,
    P = S - 16;
  const range = [-1.14, 1.14];
  const px = (v: number) => L + ((v - range[0]) / (range[1] - range[0])) * P;
  const py = (v: number) => T + P - ((v - range[0]) / (range[1] - range[0])) * P;
  const ticks = niceTicks(-1, 1, 5);
  // Density bands per layer: where each kind of memory gathers for this person.
  const bands = useMemo(() => {
    const cell = P / GRID_W;
    const map = (gi: number, gj: number): [number, number] => [L + gi * cell, T + P - gj * (P / GRID_H)];
    return LAYERS.flatMap(([k]) => {
      if (layer && layer !== k) return [];
      const pts = points.filter((p) => p.layer === k).flatMap((p) => Array.from({ length: Math.min(4, p.count) }, () => p));
      if (pts.length < 2) return [];
      const grid = gaussianKDE(pts, range[0], range[1], range[0], range[1], 0.2);
      let max = 0;
      for (const v of grid) max = Math.max(max, v);
      for (let i = 0; i < grid.length; i++) grid[i] /= max || 1;
      return [{ k, paths: makeContourPaths(grid, CONTOUR_LEVELS, map) }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, layer]);
  const byId = new Map(points.map((p) => [p.id, p]));
  const near = new Map(query?.neighbours.map((n) => [n.id, n.similarity]));
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mm-svg" onMouseLeave={() => setHover(null)}>
      <rect x={L} y={T} width={P} height={P} className="mm-frame" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={px(t)} y1={T} x2={px(t)} y2={T + P} className="mm-grid" />
          <line x1={L} y1={py(t)} x2={L + P} y2={py(t)} className="mm-grid" />
        </g>
      ))}
      {bands.map((b) => (
        <g key={b.k} pointerEvents="none">
          {b.paths.map((p, i) => {
            const a = CONTOUR_ALPHAS[CONTOUR_LEVELS.indexOf(p.value)] ?? 0.1;
            return <path key={i} d={p.d} fill={LAYER_TINT[b.k]} fillOpacity={a * 0.8} stroke={LAYER_TINT[b.k]} strokeOpacity={a + 0.1} strokeWidth={0.5} />;
          })}
        </g>
      ))}
      {query?.neighbours.map((n) => {
        const p = byId.get(n.id);
        return p ? <line key={n.id} x1={px(query.x)} y1={py(query.y)} x2={px(p.x)} y2={py(p.y)} className="mm-link" style={{ opacity: 0.2 + n.similarity * 0.7 }} /> : null;
      })}
      {trail.length > 1 && <polyline points={trail.map((q) => `${px(q.x)},${py(q.y)}`).join(" ")} className="mm-trail" />}
      {trail.slice(0, -1).map((q) => (
        <circle key={q.revision} cx={px(q.x)} cy={py(q.y)} r={1.8} className="mm-past">
          <title>{moments[q.revision].time}</title>
        </circle>
      ))}
      {points.map((p) => {
        const off = layer && p.layer !== layer;
        const isNear = near.has(p.id);
        return (
          <circle
            key={p.id}
            cx={px(p.x)}
            cy={py(p.y)}
            r={2.4 + Math.sqrt(p.count) * 0.8 + (hover === p.id ? 1.8 : 0)}
            fill={LAYER_TINT[p.layer]}
            stroke={isNear ? "#1c1a22" : "#fff"}
            strokeWidth={isNear ? 1.4 : 0.8}
            opacity={off ? 0.12 : 1}
            className="mm-dot"
            onMouseEnter={() => setHover(p.id)}
            onClick={() => open(p.id)}
          />
        );
      })}
      {query && (
        <g transform={`translate(${px(query.x)}, ${py(query.y)}) scale(1.25)`} pointerEvents="none">
          <path d={STAR} className="mm-star" />
          <text y={-10} textAnchor="middle" className="mm-star-label">
            {moments[query.revision].time}
          </text>
        </g>
      )}
    </svg>
  );
}

export function MemoryMap({
  h,
  snapshot,
  inspect,
  onPerson,
}: {
  h: Household;
  snapshot: Snapshot;
  inspect: (e: SourceEvent) => void;
  onPerson: (p: PersonId) => void;
}) {
  const { data, error } = useMemoryMap();
  const [hover, setHover] = useState<string | null>(null);
  const [layer, setLayer] = useState<MemoryLayer | null>(null);
  const clock = Date.parse(snapshot.clock);
  if (error) return <p className="cm-none">{error}</p>;
  if (!data) return <p className="cm-none">Placing every memory in its space…</p>;
  const visible = data.points.filter((p) => Date.parse(p.knownAt) <= clock);
  const byId = new Map(data.points.map((p) => [`${p.person}/${p.id}`, p]));
  const first = (p: string) => (snapshot.households.find((x) => x.id === p)?.name ?? p).split(" ")[0];
  const open = (id: string) => {
    const e = snapshot.events.find((x) => x.id === id);
    if (e) inspect(e);
  };
  return (
    <div className="mm">
      <div className="mm-panels">
        {PEOPLE.map((person) => {
          const points = visible.filter((p) => p.person === person);
          const query = data.queries.find((q) => q.person === person && q.revision === snapshot.cutoff);
          const trail = data.queries.filter((q) => q.person === person && q.revision <= snapshot.cutoff).sort((a, b) => a.revision - b.revision);
          const top = query && byId.get(`${person}/${query.neighbours[0].id}`);
          const hovered = hover?.startsWith(`${person}/`) ? byId.get(hover) : undefined;
          const records = points.reduce((n, p) => n + p.count, 0);
          return (
            <figure key={person} className={`mm-panel${person === h.id ? " is-focus" : ""}`}>
              <figcaption>
                <button onClick={() => onPerson(person)}>{first(person)}</button>
                <small>
                  {records} records · {points.length} distinct memories
                </small>
              </figcaption>
              <div className="mm-space">
                <Space
                  points={points}
                  query={query}
                  trail={trail}
                  layer={layer}
                  hover={hover?.startsWith(`${person}/`) ? hover.slice(person.length + 1) : null}
                  setHover={(id) => setHover(id ? `${person}/${id}` : null)}
                  open={open}
                />
                {hovered && (
                  <div className="mm-tip">
                    <span>
                      <i style={{ background: LAYER_TINT[hovered.layer] }} />
                      {LAYER_NAME[hovered.layer]} · {hovered.count > 1 ? `${hovered.count} records since ${day(hovered.knownAt)}` : day(hovered.knownAt)}
                    </span>
                    <b>{hovered.text}</b>
                  </div>
                )}
              </div>
              <div className="mm-reminds">
                {top ? (
                  <>
                    <span className="cm-label">Tonight reminds us of</span>
                    <button onClick={() => open(top.id)}>“{top.text}”</button>
                    <small>
                      <i style={{ background: LAYER_TINT[top.layer] }} />
                      {LAYER_NAME[top.layer]} · {day(top.knownAt)} · cos {query!.neighbours[0].similarity.toFixed(2)}
                    </small>
                  </>
                ) : (
                  <span className="mm-muted">No signal yet. This is what we hold.</span>
                )}
              </div>
            </figure>
          );
        })}
      </div>
      <div className="mm-foot">
        <div className="mm-layers" role="group" aria-label="Filter by memory layer">
          <button className={!layer ? "is-on" : ""} onClick={() => setLayer(null)}>
            All layers
          </button>
          {LAYERS.map(([k, n, c]) => (
            <button key={k} className={layer === k ? "is-on" : ""} onClick={() => setLayer(layer === k ? null : k)}>
              <i style={{ background: c }} />
              {n}
            </button>
          ))}
        </div>
        <p className="mm-legend">
          <svg width="11" height="11" viewBox="-8 -8 16 16">
            <path d={STAR} className="mm-star" />
          </svg>
          tonight’s signal in that person’s space · <b className="mm-ring" /> the five earlier memories it sits closest to · dotted path = earlier moments
        </p>
        <details className="mm-method">
          <summary>How these spaces are made</summary>
          <p>{data.method}</p>
        </details>
      </div>
    </div>
  );
}
