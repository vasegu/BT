import { reviewExamples } from "./review-examples";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PersonId } from "./types";
import type { SwayData, SwayPoint } from "./context-sway-types";
import { moments, householdNames } from "./presentation";
import {
  GRID_W,
  GRID_H,
  CONTOUR_LEVELS,
  CONTOUR_ALPHAS,
  DIFF_LEVELS,
  niceTicks,
  gaussianKDE,
  divergingColor,
  makeContourPaths,
} from "./hodoscope-specs";
import "./actions-view.css";
import "./sway.css";
import { ARCHITECTURE } from "./FocusHeader";
import { ScopeTag } from "./Scope";

// Visual language follows the Jio CX Hodoscope action map: warm neutrals, hairlines,
// letterspaced mono labels, square equal-aspect plot, KDE contour bands.
export const actionLabels: Record<string, string> = {
  monitor: "Continue monitoring",
  "quiet-fix-note": "Notify after overnight fix",
  "monitor-close": "Close verified monitoring",
  "early-life-complete": "Confirm included-product use",
  steady: "No further action",
  "early-life": "Guide included products",
  offer: "Present approved offer",
  recovery: "Keep recovery plan",
  restoration: "Recovery follow-up",
  confirmation: "Confirm recovery",
  incident: "Coordinate incident",
  activation: "Check activation",
  "first-use": "Confirm first use",
  watch: "Observe quietly",
  no_plan: "No eligible plan",
  engineer: "Engineer visit (sign-off)",
  defer: "Hold / review",
};
export const ACTION_TINT: Record<string, string> = {
  monitor: "#0f7b5f", "monitor-close": "#0f7b5f", "quiet-fix-note": "#2a78d6", "early-life": "#a15c07", "early-life-complete": "#0e9aa7", offer: "#5514b4", steady: "#8a8494",
  // The app's own palette: brand purple, the household/status colours used across the panels.
  incident: "#c2416b",
  recovery: "#5514b4",
  restoration: "#0f7b5f",
  confirmation: "#2a78d6",
  activation: "#a15c07",
  "first-use": "#0e9aa7",
  watch: "#8a8494",
  no_plan: "#3b3544",
  engineer: "#b0103f",
  defer: "#b9b3c1",
};
const PERSON_TINT: Record<PersonId, string> = { daniel: "#5514b4", sam: "#0f7b5f", maya: "#a15c07" };
const KIND_TINT: Record<SwayPoint["kind"], string> = { recorded: "#2a2a2a", base: "#5514b4", single: "#c2416b", pair: "#b9b3c1" };
const KIND_LABEL: Record<SwayPoint["kind"], string> = {
  recorded: "fixture rules decision",
  base: "policy replay",
  single: "what-if · one fact changed",
  pair: "what-if · two facts changed",
};
const MOMENT_TINT = ["#E4DAF5", "#C9B5EC", "#A88BDC", "#8460C8", "#5514B4", "#3A0C80", "#0f7b5f", "#a15c07", "#2a78d6"];
const nameOf = (a: string) => actionLabels[a] || a;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const who = (p: SwayPoint) => householdNames[p.person].split(" ")[0];
const when = (p: SwayPoint) => moments[p.revision]?.time ?? "";
/** A what-if in plain English. Removing a fact the customer had, or adding one they didn't. */
function whatIf(p: SwayPoint, base: SwayPoint | undefined, factors: SwayData["factors"], short = false) {
  if (p.kind === "recorded") return short ? "fixture" : "The rules decision recorded in the static fixture.";
  if (p.kind === "base") return short ? "replay" : "The same moment replayed through the policy, nothing changed.";
  const name = who(p);
  const parts = p.flips.map((id) => {
    const f = factors.find((x) => x.id === id);
    const label = (f?.label ?? id).replace(/^Customer claims /, "");
    if (f?.promptOnly) return short ? "+ fake gamer claim" : `${name} had claimed ${label} (${name} never said this)`;
    const had = base?.known?.includes(id);
    return short ? `${had ? "−" : "+"} ${label.toLowerCase()}` : had ? `we had not known: ${label.toLowerCase()}` : `this had been true: ${label.toLowerCase()}`;
  });
  return short ? parts.join(" ") : `What if ${parts.join(", and ")}?`;
}

type ColorBy = "action" | "person" | "moment" | "kind" | "changed";

/** The structured facts the agent saw, read back from the first lines of the embedded context. */
function factsOf(p: SwayPoint): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of p.text.split("\n").slice(0, 3))
    for (const m of line.matchAll(/([A-Z][A-Za-z ]+?): ([^.]+)\./g)) out[m[1].trim()] = m[2].trim();
  return out;
}
/** For one action: what its contexts usually look like, and which ones got there unusually. */
function triggers(points: SwayPoint[]) {
  const facts = points.map((p) => ({ p, f: factsOf(p) }));
  const keys = [...new Set(facts.flatMap((x) => Object.keys(x.f)))];
  const typical = keys
    .map((k) => {
      const counts = new Map<string, number>();
      for (const x of facts) counts.set(x.f[k] ?? "—", (counts.get(x.f[k] ?? "—") || 0) + 1);
      const [value, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
      return { key: k, value, share: n / facts.length };
    })
    .filter((t) => t.share >= 0.6);
  const unusual = facts
    .map(({ p, f }) => ({
      p,
      diffs: typical.filter((t) => (f[t.key] ?? "—") !== t.value).map((t) => ({ key: t.key, value: f[t.key] ?? "—", usual: t.value })),
    }))
    .filter((x) => x.diffs.length)
    .sort((a, b) => b.diffs.length - a.diffs.length || Number(b.p.kind === "recorded") - Number(a.p.kind === "recorded") || b.p.outlier - a.p.outlier);
  return { typical, unusual };
}
type Density = "off" | "groups" | "diff";

// The all-customer review is baked at build time (scripts/build-context-sway.ts): the replay
// is deterministic, so it is loaded once and is always available, independent of the session.
let baked: Promise<SwayData> | null = null;
export function useSway() {
  const [state, setState] = useState<{ data?: SwayData; error?: string }>({});
  useEffect(() => {
    let live = true;
    baked ||= fetch("/context-sway.json").then(async (r) => {
      if (!r.ok) throw new Error("The agent review has not been built. Run npm run build:sway.");
      return (await r.json()) as SwayData;
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

function useModel(data: SwayData) {
  return useMemo(() => {
    const base = new Map(data.points.filter((p) => p.kind === "base").map((p) => [`${p.person}/${p.revision}`, p]));
    const changed = (p: SwayPoint) =>
      p.kind === "single" || p.kind === "pair" ? base.get(`${p.person}/${p.revision}`)?.action !== p.action : false;
    return { base, changed };
  }, [data.fingerprint]);
}
function grouping(colorBy: ColorBy, changed: (p: SwayPoint) => boolean) {
  const key = (p: SwayPoint) =>
    colorBy === "action"
      ? p.action
      : colorBy === "person"
        ? p.person
        : colorBy === "moment"
          ? String(p.revision)
          : colorBy === "kind"
            ? p.kind
            : changed(p)
              ? "changed"
              : "same";
  const label = (k: string) =>
    colorBy === "action"
      ? nameOf(k)
      : colorBy === "person"
        ? householdNames[k as PersonId]
        : colorBy === "moment"
          ? `${moments[Number(k)]?.time} · ${moments[Number(k)]?.title}`
          : colorBy === "kind"
            ? KIND_LABEL[k as SwayPoint["kind"]]
            : k === "changed"
              ? "action changed by the what-if"
              : "same action as replay";
  const color = (k: string) =>
    colorBy === "action"
      ? ACTION_TINT[k] || "#8a8494"
      : colorBy === "person"
        ? PERSON_TINT[k as PersonId]
        : colorBy === "moment"
          ? MOMENT_TINT[Number(k)] || "#5514B4"
          : colorBy === "kind"
            ? KIND_TINT[k as SwayPoint["kind"]]
            : k === "changed"
              ? "#c2416b"
              : "#d6d0de";
  return { key, label, color };
}

// ── Scatter: square, equal data-aspect plot with density bands (after the Jio action map) ──
function Scatter({
  rows,
  allRows,
  groupKey,
  colorOf,
  density,
  densityGroup,
  selectedId,
  hoverId,
  onHover,
  onPick,
  labels,
  axis = "UMAP",
  compact = false,
}: {
  rows: SwayPoint[];
  allRows: SwayPoint[];
  groupKey: (p: SwayPoint) => string;
  colorOf: (k: string) => string;
  density: Density;
  densityGroup: string;
  selectedId?: string;
  hoverId?: string;
  onHover?: (p: SwayPoint | null, x: number, y: number) => void;
  onPick?: (p: SwayPoint) => void;
  labels: Record<string, string>;
  axis?: string;
  compact?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  useEffect(() => {
    const measure = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      setSize({ w: Math.max(220, r.width), h: Math.max(220, r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const g = useMemo(() => {
    const xs = allRows.map((r) => r.x),
      ys = allRows.map((r) => r.y);
    const [xmin, xmax, ymin, ymax] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const half = (Math.max(xmax - xmin, ymax - ymin) / 2) * 1.06;
    const xRange = [(xmax + xmin) / 2 - half, (xmax + xmin) / 2 + half],
      yRange = [(ymax + ymin) / 2 - half, (ymax + ymin) / 2 + half];
    const pad = compact ? { l: 18, r: 6, t: 6, b: 20 } : { l: 38, r: 14, t: 12, b: 28 };
    const innerW = size.w - pad.l - pad.r,
      innerH = size.h - pad.t - pad.b;
    const plot = Math.max(20, Math.min(innerW, innerH));
    const plotL = pad.l + (innerW - plot) / 2,
      plotT = pad.t + (innerH - plot) / 2;
    const px = (v: number) => plotL + ((v - xRange[0]) / (xRange[1] - xRange[0])) * plot;
    const py = (v: number) => plotT + plot - ((v - yRange[0]) / (yRange[1] - yRange[0])) * plot;
    return { xRange, yRange, plot, plotL, plotT, px, py };
  }, [allRows, size, compact]);
  const { xRange, yRange, plot, plotL, plotT, px, py } = g;
  const xTicks = niceTicks(xRange[0], xRange[1], compact ? 4 : 6),
    yTicks = niceTicks(yRange[0], yRange[1], compact ? 4 : 5);
  const bandwidth = Math.max(xRange[1] - xRange[0], yRange[1] - yRange[0]) / 18;
  const layers = useMemo(() => {
    if (density === "off") return null;
    const groups: Record<string, SwayPoint[]> = {};
    // Bands follow what is on the map (after filters); axes stay pinned to the full dataset.
    for (const r of rows) (groups[groupKey(r)] ||= []).push(r);
    const s = plot / GRID_W;
    const map = (gi: number, gj: number): [number, number] => [plotL + gi * s, plotT + plot - gj * (plot / GRID_H)];
    if (density === "groups")
      return {
        mode: "groups" as const,
        out: Object.entries(groups)
          .filter(([, pts]) => pts.length >= 3)
          .map(([key, pts]) => {
            const grid = gaussianKDE(pts, xRange[0], xRange[1], yRange[0], yRange[1], bandwidth);
            let max = 0;
            for (const v of grid) max = Math.max(max, v);
            for (let k = 0; k < grid.length; k++) grid[k] /= max || 1;
            return { key, color: colorOf(key), paths: makeContourPaths(grid, CONTOUR_LEVELS, map) };
          }),
      };
    if (!densityGroup || !groups[densityGroup]) return null;
    const rest = Object.entries(groups).flatMap(([k, v]) => (k === densityGroup ? [] : v));
    const a = gaussianKDE(groups[densityGroup], xRange[0], xRange[1], yRange[0], yRange[1], bandwidth),
      b = gaussianKDE(rest, xRange[0], xRange[1], yRange[0], yRange[1], bandwidth);
    let amax = 0;
    const diff = new Float32Array(a.length);
    for (let k = 0; k < a.length; k++) amax = Math.max(amax, Math.abs((diff[k] = a[k] - b[k])));
    for (let k = 0; k < a.length; k++) diff[k] /= amax || 1;
    return { mode: "diff" as const, paths: makeContourPaths(diff, DIFF_LEVELS, map) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, densityGroup, rows, groupKey, plot, plotL, plotT]);
  const clip = `clip-${compact ? "c" : "f"}`;
  return (
    <svg ref={ref} width="100%" height="100%" className="hodo-svg" onMouseLeave={() => onHover?.(null, 0, 0)}>
      <defs>
        <clipPath id={clip}>
          <rect x={plotL} y={plotT} width={plot} height={plot} />
        </clipPath>
      </defs>
      {xTicks.map((t) => (
        <line key={`gx${t}`} x1={px(t)} y1={plotT} x2={px(t)} y2={plotT + plot} className="hodo-grid" />
      ))}
      {yTicks.map((t) => (
        <line key={`gy${t}`} x1={plotL} y1={py(t)} x2={plotL + plot} y2={py(t)} className="hodo-grid" />
      ))}
      {layers?.mode === "groups" &&
        layers.out.map((l) => (
          <g key={l.key} pointerEvents="none" clipPath={`url(#${clip})`}>
            {l.paths.map((p, i) => {
              const a = CONTOUR_ALPHAS[CONTOUR_LEVELS.indexOf(p.value)] ?? 0.1;
              return <path key={i} d={p.d} fill={l.color} fillOpacity={a} stroke={l.color} strokeOpacity={a + 0.08} strokeWidth={0.5} />;
            })}
          </g>
        ))}
      {layers?.mode === "diff" && (
        <g pointerEvents="none" clipPath={`url(#${clip})`}>
          {layers.paths.map((p, i) => (
            <path key={i} d={p.d} fill={divergingColor(p.value)} fillOpacity={0.42} stroke={divergingColor(p.value)} strokeOpacity={0.55} strokeWidth={0.5} />
          ))}
        </g>
      )}
      <line x1={plotL} y1={plotT + plot} x2={plotL + plot} y2={plotT + plot} className="hodo-axis" />
      <line x1={plotL} y1={plotT} x2={plotL} y2={plotT + plot} className="hodo-axis" />
      {!compact && xTicks.map((t) => (
        <g key={`xt${t}`}>
          <line x1={px(t)} y1={plotT + plot} x2={px(t)} y2={plotT + plot + 4} className="hodo-axis" />
          <text x={px(t)} y={plotT + plot + 16} className="hodo-tick" textAnchor="middle">{t}</text>
        </g>
      ))}
      {!compact && yTicks.map((t) => (
        <g key={`yt${t}`}>
          <line x1={plotL - 4} y1={py(t)} x2={plotL} y2={py(t)} className="hodo-axis" />
          <text x={plotL - 7} y={py(t) + 3} className="hodo-tick" textAnchor="end">{t}</text>
        </g>
      ))}
      {compact && (
        <>
          <text x={plotL + plot / 2} y={plotT + plot + 15} className="hodo-axis-label is-compact" textAnchor="middle">
            similar contexts sit close together →
          </text>
          <text x={plotL - 9} y={plotT + plot / 2} className="hodo-axis-label is-compact" textAnchor="middle" transform={`rotate(-90, ${plotL - 9}, ${plotT + plot / 2})`}>
            context space (UMAP) →
          </text>
        </>
      )}
      {!compact && (
        <>
          <text x={plotL + plot / 2} y={plotT + plot + 27} className="hodo-axis-label" textAnchor="middle">{axis} x</text>
          <text x={plotL - 28} y={plotT + plot / 2} className="hodo-axis-label" textAnchor="middle" transform={`rotate(-90, ${plotL - 28}, ${plotT + plot / 2})`}>{axis} y</text>
        </>
      )}
      {rows.map((r) => {
        const sel = r.id === selectedId,
          hov = r.id === hoverId,
          label = labels[r.id];
        const radius = sel ? 8 : hov ? 7 : (compact ? 3 : 3.5) + Math.max(0, (r.outlier - 0.6) * 5) + (r.kind === "recorded" ? 1.5 : 0);
        const stroke = label === "investigate" ? "#c2416b" : label === "expected" ? "#0f7b5f" : sel || r.kind === "recorded" ? "#2a2a2a" : "transparent";
        return (
          <circle
            key={r.id}
            cx={px(r.x)}
            cy={py(r.y)}
            r={radius}
            fill={colorOf(groupKey(r))}
            fillOpacity={sel ? 1 : hov ? 0.95 : 0.85}
            stroke={stroke}
            strokeWidth={label || sel || r.kind === "recorded" ? 1.6 : 0}
            onClick={onPick ? () => onPick(r) : undefined}
            onMouseEnter={onHover ? () => onHover(r, px(r.x), py(r.y)) : undefined}
            className={onPick ? "hodo-dot" : undefined}
          />
        );
      })}
    </svg>
  );
}

// ── atoms ──
function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="hodo-stat">
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}
function VerticalStep({ step, title, hint }: { step: string; title: string; hint?: string }) {
  return (
    <div className="hodo-vstep">
      <div>
        <span className="hodo-vstep-step">{step}</span>
        <span className="hodo-vstep-title">{title}</span>
        {hint && <span className="hodo-vstep-hint">{hint}</span>}
      </div>
    </div>
  );
}
function StackedSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="hodo-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
function HowToRead() {
  // Fixed to the viewport so the scrolling controls column and the plot can't clip it.
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!at) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as Element).closest(".hodo-pop, .hodo-howto > button")) setAt(null);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", () => setAt(null), { once: true, capture: true });
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [at]);
  const toggle = () => {
    const r = button.current?.getBoundingClientRect();
    setAt(at || !r ? null : { top: r.bottom + 6, left: r.left });
  };
  return (
    <div className="hodo-howto">
      <button ref={button} aria-expanded={!!at} onClick={toggle}>
        ⓘ how to read this
      </button>
      {at && (
        <div className="hodo-pop" role="dialog" aria-label="How to read the context map" style={{ top: at.top, left: at.left }}>
          <div className="hodo-pop-title">Reading the context map</div>
          <p>
            Each dot is one context the arbiter could face: a recorded moment, or a <em>what-if test</em> of that
            moment with one or two facts changed. What-if tests are not customer records: we remove a fact the customer
            had, or add one they did not (even a fake one, like “I’m a gamer”), to see whether the policy would act
            differently. Position is UMAP over the 384-d embedding of <em>what the agent saw</em> (facts, latest observations,
            task prompt). <em>Distance</em> = similarity of context, not of customer or time.
          </p>
          <p>
            Colour is <em>what it did</em>. A region of one colour means similar contexts get the same action. Colours
            mixing where contexts are nearly identical is where a small fact sways the decision — read those first.
          </p>
          <p>
            Filter by an action to see what usually leads to it, and which contexts reached it for an unusual reason.
          </p>
          <button onClick={() => setAt(null)}>close</button>
        </div>
      )}
    </div>
  );
}

function DensityScale({ mode }: { mode: Density }) {
  if (mode === "groups") {
    const stops = CONTOUR_LEVELS.slice().reverse();
    return (
      <div className="hodo-scale">
        <span>peak</span>
        <svg width="14" height="120">
          {stops.map((t, i) => (
            <rect key={i} x={0} y={(i / stops.length) * 120} width={14} height={120 / stops.length} fill="#5514b4" fillOpacity={CONTOUR_ALPHAS[CONTOUR_LEVELS.indexOf(t)]} />
          ))}
        </svg>
        <span>tail</span>
        <span className="hodo-vertical">density (% of peak)</span>
      </div>
    );
  }
  if (mode === "diff") {
    const stops = Array.from({ length: 11 }, (_, i) => divergingColor(1 - (i / 10) * 2));
    return (
      <div className="hodo-scale">
        <span className="is-over">+over</span>
        <svg width="14" height="180">
          <defs>
            <linearGradient id="hodo-divg" x1="0" x2="0" y1="0" y2="1">
              {stops.map((c, i) => (
                <stop key={i} offset={`${i * 10}%`} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
          <rect width="14" height="180" fill="url(#hodo-divg)" />
        </svg>
        <span className="is-under">−under</span>
        <span className="hodo-vertical">group vs rest</span>
      </div>
    );
  }
  return null;
}

// ── sixth overview tile ──
export function SwayTile() {
  const { data, error } = useSway();
  if (error) return <p className="hodo-empty">{error}</p>;
  if (!data) return <p className="hodo-empty">Loading the global static rules fixture…</p>;
  return <TileBody data={data} />;
}
function TileBody({ data }: { data: SwayData }) {
  const { changed } = useModel(data);
  const g = useMemo(() => grouping("action", changed), [changed]);
  const counts = new Map<string, number>();
  data.points.forEach((p) => counts.set(p.action, (counts.get(p.action) || 0) + 1));
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <div className="hodo hodo-tile-wrap">
      <p className="hodo-tile-sub">
        Global static rules fixture · <b>{data.points.length}</b> contexts · independent of selected customer and replay
      </p>
      <div className="hodo-tile">
        <Scatter compact rows={data.points} allRows={data.points} groupKey={g.key} colorOf={g.color} density="groups" densityGroup="" labels={{}} />
      </div>
      <div className="hodo-tile-key">
        {top.map(([k]) => (
          <span key={k}>
            <i style={{ background: g.color(k) }} />
            {nameOf(k)}
          </span>
        ))}
        <span className="is-more">colour = action taken</span>
      </div>
    </div>
  );
}

// ── expanded review ──
export function SwayReview({ onLegacy }: { onLegacy: () => void }) {
  const { data, error } = useSway();
  if (error) return <p className="hodo-empty">{error}</p>;
  if (!data) return <p className="hodo-empty">Loading the global static rules fixture…</p>;
  return <Review data={data} onLegacy={onLegacy} />;
}

function Review({ data, onLegacy }: { data: SwayData; onLegacy: () => void }) {
  const { base, changed } = useModel(data);
  const [colorBy, setColorBy] = useState<ColorBy>("action");
  const [density, setDensity] = useState<Density>("groups");
  const [densityGroup, setDensityGroup] = useState("");
  const [fact, setFact] = useState("all");
  const [person, setPerson] = useState("all");
  const [kind, setKind] = useState("all");
  const [action, setAction] = useState("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [hover, setHover] = useState<{ p: SwayPoint; x: number; y: number } | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const storageKey = `bt-sway:${data.fingerprint}`;
  useEffect(() => {
    try {
      setLabels(JSON.parse(localStorage.getItem(storageKey) || "{}"));
    } catch {
      setLabels({});
    }
  }, [storageKey]);
  const g = useMemo(() => grouping(colorBy, changed), [colorBy, changed]);
  const groupKey = useCallback((p: SwayPoint) => g.key(p), [g]);
  const rows = data.points.filter(
    (p) =>
      (fact === "all" || p.flips.includes(fact) || p.kind === "recorded" || p.kind === "base") &&
      (person === "all" || p.person === person) &&
      (kind === "all" || p.kind === kind) &&
      (action === "all" || p.action === action),
  );
  const groups = [...new Set(data.points.map(groupKey))];
  const counts = new Map<string, number>();
  rows.forEach((p) => counts.set(groupKey(p), (counts.get(groupKey(p)) || 0) + 1));
  const top = data.factors[0],
    claim = data.factors.find((f) => f.promptOnly);
  // Triage: every single-fact flip that changed the action, ordered by how much that fact sways overall.
  const rank = new Map(data.factors.map((f, i) => [f.id, i]));
  const decisive = data.points
    .filter((p) => p.kind === "single" && changed(p))
    .sort((a, b) => (rank.get(a.flips[0])! - rank.get(b.flips[0])!) || a.revision - b.revision);
  const selected = data.points.find((p) => p.id === selectedId);
  // The three questions a reviewer actually asks, answered from the replay.
  const INTENDED = new Set(["incident", "case", "promise", "habit", "restart", "restored", "delivered", "confirmed", "contact"]);
  const swaying = data.factors.filter((f) => !f.promptOnly && f.sway > 0);
  const unexpected = swaying.filter((f) => !INTENDED.has(f.id));
  // One example per fact, so a reviewer sees different kinds of risk rather than one repeated.
  const handoffs = [
    ...new Map(data.points.filter((p) => p.kind === "single" && p.action === "no_plan").map((p) => [p.flips[0], p])).values(),
  ].slice(0, 3);
  const mark = (id: string, verdict: string) => {
    const next = { ...labels, [id]: labels[id] === verdict ? "" : verdict };
    setLabels(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };
  return (
    <div className="hodo hodo-page">
      <header className="av-head">
        <div>
          <span className="eyebrow">Static rules review · three synthetic households · fixture moments</span>
          <h2>Which facts change the rules decision?</h2>
          <p>Global static rules fixture across three synthetic households; this is not the selected customer’s evaluation and does not follow the replay clock or test the live Jev model. Fingerprint {data.fingerprint.slice(0, 12)}. {data.provenance
            ? `Dataset ${data.provenance.datasetVersion} · policy ${data.provenance.policyVersions.join(", ")} · built ${data.provenance.builtAt} · source ${data.provenance.sourceHash.slice(0, 12)}.`
            : "Legacy artifact: dataset, policy and build provenance are unavailable; a match to this replay is not verified."}</p>
          <p className="av-arch">
            <span>Architecture</span>
            {ARCHITECTURE["Agent review"].component}
            <span>Accountable</span>
            {ARCHITECTURE["Agent review"].owner}
            <ScopeTag scope="standing" />
          </p>
        </div>
        <div className="av-verified">
          <strong>{data.points.length}</strong>
          <small>contexts replayed</small>
        </div>
      </header>
      <section className="hodo-guided" aria-label="Guided context comparisons">
        <header><span className="eyebrow">Start here · change one input</span><h3>Should this context change the action?</h3><p>Points are input contexts, coloured by the resulting action. The axes are a semantic projection, not business scores. An outlier is a reason to inspect, not proof of an error.</p></header>
        <div>{reviewExamples(data).map(example => {
          const before=data.points.find(p=>p.id===example.baselineId)!;
          const after=data.points.find(p=>p.id===example.variantId)!;
          const invariant=before.action===after.action;
          return <article key={example.variantId}><span className="eyebrow">{example.expected==='invariant'?'Irrelevant claim':'Relevant context'}</span><p>{example.explanation}</p><strong>{nameOf(before.action)} → {nameOf(after.action)}</strong><small>{who(before)} · {when(before)} · {invariant?'Action unchanged':'Action changed'}{example.expected==='invariant'&&!invariant?' · needs review':''}</small><div><button onClick={()=>setSelectedId(before.id)}>Inspect original</button><button onClick={()=>setSelectedId(after.id)}>Inspect changed input ↗</button></div></article>;
        })}</div>
        <small>This fixture tests action selection. Tone and wording are not captured here; inspect frozen model requests in the model evaluation view for that evidence.</small>
      </section>
      <div className="hodo-questions">
        <article className={unexpected.length ? "is-flag" : "is-ok"}>
          <span>01</span>
          <h3>Did any fact swing a decision it shouldn’t have?</h3>
          <p>
            <b>{unexpected.length ? "Review flagged factors." : "No unexpected factor families flagged."}</b>{" "}
            {unexpected.length
              ? unexpected.map((f) => `${f.label} (${pct(f.sway)} of moments)`).join(", ")
              : `Changed decisions involve expected factor families; each individual transition still needs review. The strongest: ${swaying
                  .slice(0, 3)
                  .map((f) => `${f.label.toLowerCase()} (${pct(f.sway)})`)
                  .join(", ")}.`}
          </p>
        </article>
        <article className={claim && claim.sway > 0 ? "is-flag" : "is-ok"}>
          <span>02</span>
          <h3>Did claim wording change the rules result?</h3>
          <p>
            <b>{claim && claim.sway > 0 ? "Rules changed." : "Policy facts stayed unchanged."}</b> Claim wording was varied across {data.bases} fixture moments. Rules decisions changed {claim ? pct(claim.sway) : "0%"}. This does not measure live-model resistance to customer claims.
          </p>
        </article>
        <article className={handoffs.length ? "is-look" : "is-ok"}>
          <span>03</span>
          <h3>Where should a person look first?</h3>
          {handoffs.length ? (
            <>
              <p>Where changing one fact left no safe plan, so a person must step in:</p>
              <ul>
                {handoffs.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => setSelectedId(p.id)}>
                      {who(p)} · {when(p)} · {whatIf(p, base.get(`${p.person}/${p.revision}`), data.factors, true)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              <b>Nowhere urgent.</b> Every tested change still left the policy a safe plan.
            </p>
          )}
        </article>
      </div>
      <div className="hodo-explore-label">Explore the replay · every moment, every fact changed</div>
      <div className="hodo-stats">
        <Stat label="Moments" value={data.bases} />
        <Stat label="Facts tested" value={data.factors.length} />
        <Stat label="Top sway" value={pct(top.sway)} sub={top.label.toLowerCase()} />
        {claim && <Stat label="Claim sway" value={pct(claim.sway)} sub="unverified claim" />}
        <Stat label="Fixture = rules replay" value={data.policyAgreement === null ? "—" : pct(data.policyAgreement)} />
        <Stat label="Flagged" value={Object.values(labels).filter((v) => v === "investigate").length} />
      </div>
      <div className="hodo-body">
        <section className="hodo-card hodo-observe">
          <VerticalStep step="01 · observe" title="Context map" hint="UMAP · context + prompt embeddings" />
          <div className="hodo-controls">
            <HowToRead />
            <StackedSelect
              label="filter · action"
              value={action}
              onChange={setAction}
              options={[
                ["all", "all"],
                ...[...new Set(data.points.map((p) => p.action))].map((a): [string, string] => [a, nameOf(a)]),
              ]}
            />
            <StackedSelect
              label="colour"
              value={colorBy}
              onChange={(v) => {
                setColorBy(v as ColorBy);
                setDensityGroup("");
              }}
              options={[
                ["action", "by action"],
                ["changed", "by sway (changed?)"],
                ["person", "by household"],
                ["moment", "by moment"],
                ["kind", "by variant"],
              ]}
            />
            <StackedSelect label="density" value={density} onChange={(v) => setDensity(v as Density)} options={[["off", "off"], ["groups", "per group"], ["diff", "diff vs rest"]]} />
            {density === "diff" && (
              <StackedSelect label="group" value={densityGroup} onChange={setDensityGroup} options={[["", "— pick —"], ...groups.map((k): [string, string] => [k, g.label(k)])]} />
            )}
            <StackedSelect label="filter · fact" value={fact} onChange={setFact} options={[["all", "all"], ...data.factors.map((f): [string, string] => [f.id, f.label])]} />
            <StackedSelect label="filter · household" value={person} onChange={setPerson} options={[["all", "all"], ["daniel", "Daniel"], ["sam", "Sam"], ["maya", "Maya"]]} />
            <StackedSelect label="filter · variant" value={kind} onChange={setKind} options={[["all", "all"], ["recorded", "fixture decisions"], ["base", "policy replays"], ["single", "what-if · one fact"], ["pair", "what-if · two facts"]]} />
            <div className="hodo-count">{rows.length} / {data.points.length}</div>
            <div className="hodo-legend">
              <span className="hodo-label">Legend</span>
              {groups
                .filter((k) => counts.has(k))
                .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))
                .map((k) => (
                  <span key={k} className="hodo-legend-row">
                    <i style={{ background: g.color(k) }} />
                    {g.label(k)}
                    <small>{counts.get(k)}</small>
                  </span>
                ))}
              <span className="hodo-legend-row is-key">
                <i className="is-ring" />
                fixture rules decision
              </span>
            </div>
          </div>
          <div className="hodo-plot">
            <div className="hodo-square">
              <Scatter
                rows={rows}
                allRows={data.points}
                groupKey={groupKey}
                colorOf={g.color}
                density={density}
                densityGroup={densityGroup}
                selectedId={selectedId}
                hoverId={hover?.p.id}
                onHover={(p, x, y) => setHover(p ? { p, x, y } : null)}
                onPick={(p) => setSelectedId(p.id)}
                labels={labels}
              />
              {hover && (
                <div className="hodo-tip" style={{ left: hover.x + 14, top: hover.y + 10 }}>
                  <div className="hodo-tip-head">
                    {who(hover.p).toLowerCase()} · {when(hover.p)} · {whatIf(hover.p, base.get(`${hover.p.person}/${hover.p.revision}`), data.factors, true)}
                  </div>
                  <div className="hodo-tip-body">{hover.p.title}</div>
                  <div className="hodo-tip-foot">
                    {nameOf(hover.p.action)}
                    {changed(hover.p) && ` · was ${nameOf(base.get(`${hover.p.person}/${hover.p.revision}`)!.action)}`} · outlier {pct(hover.p.outlier)}
                  </div>
                </div>
              )}
            </div>
            <DensityScale mode={density === "diff" && !densityGroup ? "off" : density} />
          </div>
        </section>
        <section className="hodo-card hodo-triage">
          <VerticalStep step="02 · triage" title="What sways the action" hint="ranked by how often changing that one fact changes the action" />
          <div className="hodo-rail">
            {action !== "all" && (() => {
              const { typical, unusual } = triggers(data.points.filter((p) => p.action === action));
              return (
                <div className="hodo-led">
                  <div className="hodo-rail-sep">What led to “{nameOf(action)}”</div>
                  <dl className="hodo-typical">
                    {typical.map((t) => (
                      <div key={t.key}>
                        <dt>{t.key}</dt>
                        <dd>
                          {t.value} <small>{pct(t.share)}</small>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="hodo-rail-sep">Unusual triggers · {unusual.length}</div>
                  {unusual.slice(0, 8).map(({ p, diffs }, i) => (
                    <button key={p.id} className="hodo-item is-odd" aria-pressed={selectedId === p.id} onClick={() => setSelectedId(p.id)}>
                      <div className="hodo-item-head">
                        <span>
                          <i style={{ background: ACTION_TINT[p.action] }} />#{i + 1} · {who(p).toUpperCase()} · {when(p)}
                        </span>
                        <span>{whatIf(p, base.get(`${p.person}/${p.revision}`), data.factors, true)}</span>
                      </div>
                      {diffs.slice(0, 3).map((d) => (
                        <p key={d.key} className="hodo-diff">
                          <b>{d.key}:</b> {d.value} <small>usually {d.usual}</small>
                        </p>
                      ))}
                    </button>
                  ))}
                  {!unusual.length && <p className="hodo-empty">Every context behind this action looks alike.</p>}
                  <div className="hodo-rail-sep">What sways any action</div>
                </div>
              );
            })()}
            {data.factors.map((f, i) => (
              <button
                key={f.id}
                className="hodo-item"
                aria-pressed={fact === f.id}
                onClick={() => {
                  setFact(fact === f.id ? "all" : f.id);
                  setColorBy("changed");
                }}
              >
                <div className="hodo-item-head">
                  <span>
                    <i style={{ background: f.sway ? "#5514b4" : "#d6d0de" }} />#{i + 1} · {f.id.toUpperCase()}
                    {f.promptOnly && " · PROMPT"}
                  </span>
                  <span>{pct(f.sway)}</span>
                </div>
                <p>{f.label}</p>
                <small>
                  {f.changed} of {f.bases} moments change
                  {f.moves[0] && ` · mostly ${nameOf(f.moves[0].move.split("→")[0])} → ${nameOf(f.moves[0].move.split("→")[1])}`}
                </small>
              </button>
            ))}
            <div className="hodo-rail-sep">What-ifs that changed the action · {decisive.length}</div>
            {decisive.map((p, i) => {
              const from = base.get(`${p.person}/${p.revision}`)!;
              return (
                <button key={p.id} className="hodo-item" aria-pressed={selectedId === p.id} onClick={() => setSelectedId(p.id)}>
                  <div className="hodo-item-head">
                    <span>
                      <i style={{ background: ACTION_TINT[p.action] }} />#{i + 1} · {who(p).toUpperCase()} · {when(p)}
                    </span>
                    <span>{whatIf(p, from, data.factors, true)}</span>
                  </div>
                  <p>
                    {nameOf(from.action)} → {nameOf(p.action)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <footer className="hodo-foot">
        <details>
          <summary>method & provenance</summary>
          <p>{data.method}</p>
          <code>{data.fingerprint.slice(0, 16)}</code>
        </details>
        <button onClick={onLegacy}>response wording contrasts ↗</button>
      </footer>
      {selected && (
        <Drawer
          point={selected}
          from={base.get(`${selected.person}/${selected.revision}`)}
          whatIfText={whatIf(selected, base.get(`${selected.person}/${selected.revision}`), data.factors)}
          fingerprint={data.fingerprint}
          label={labels[selected.id]}
          onMark={(v) => mark(selected.id, v)}
          onClose={() => setSelectedId(undefined)}
        />
      )}
    </div>
  );
}

// ── 03 · decide drawer (after the Jio DECIDE drawer) ──
function Drawer({
  point,
  from,
  whatIfText,
  fingerprint,
  label,
  onMark,
  onClose,
}: {
  point: SwayPoint;
  from?: SwayPoint;
  whatIfText: string;
  fingerprint: string;
  label?: string;
  onMark: (v: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const moved = from && from.action !== point.action && point.kind !== "recorded" && point.kind !== "base";
  return (
    <aside className="hodo-drawer" role="dialog" aria-label="Review this context">
      <header>
        <div>
          <code>
            {point.id.split("/").slice(0, 2).join(" · ")} · {fingerprint.slice(0, 8)}
          </code>
          <h3>
            {householdNames[point.person]} · {when(point)}
          </h3>
          <small>
            {KIND_LABEL[point.kind]} · outlier {pct(point.outlier)}
          </small>
        </div>
        <button onClick={onClose} aria-label="Close">×</button>
      </header>
      <div className="hodo-drawer-body">
        {point.flips.length > 0 ? (
          <p className="hodo-whatif">
            <b>What-if test · not a real record.</b> {whatIfText} We changed this on purpose to test the policy; the
            fixture {householdNames[point.person].split(" ")[0]} at {when(point)} is the fixture rules decision.
          </p>
        ) : (
          <p className="hodo-whatif is-real">
            <b>{point.kind === "recorded" ? "Real decision." : "Policy replay."}</b> {whatIfText}
          </p>
        )}
        <h4>Input the agent saw</h4>
        <pre>{point.text}</pre>
        <h4>Decision it made</h4>
        <pre>{`${point.title}.\n${point.reason}`}</pre>
        <span className="hodo-chip" style={{ color: ACTION_TINT[point.action], background: `${ACTION_TINT[point.action]}1f` }}>
          {nameOf(point.action).toUpperCase()}
        </span>
        <h4>What changing it did</h4>
        {moved ? (
          <p className="hodo-quote">
            “It moved the plan from {nameOf(from!.action).toLowerCase()} to {nameOf(point.action).toLowerCase()}.”
          </p>
        ) : (
          <p className="hodo-quote">
            {point.kind === "recorded"
              ? "“This is the rules decision recorded in the static fixture.”"
              : point.kind === "base"
                ? "“Policy replay of the recorded context, with no facts changed.”"
                : "“Same action as the real decision: this change did not sway the plan.”"}
          </p>
        )}
        <h4>Human review</h4>
        <div className="hodo-review">
          <button aria-pressed={label === "expected"} onClick={() => onMark("expected")}>Expected sway</button>
          <button aria-pressed={label === "investigate"} onClick={() => onMark("investigate")}>Investigate</button>
        </div>
        <small className="hodo-faint">Saved in this browser · no prompt or policy changes automatically</small>
      </div>
    </aside>
  );
}
