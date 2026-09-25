import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { retrieve } from "../../docs/design/lab/logic.mjs";
import type { PersonId } from "./types";

type Episode = {
  id: string;
  title: string;
  text: string;
  category: string;
  vector: number[];
  position: number[];
  clusterId: string;
  recordIds: string[];
};
type Cluster = { id: string; label: string; color: string; size: number };
type Space = {
  manifest: {
    projection: { explainedVariance: number[] };
    clustering: { method: string; cosineSilhouette: number };
  };
  episodes: Episode[];
  clusters: Cluster[];
  records: { id: string; text: string }[];
  queries: { id: string; text: string; vector: number[]; position: number[] }[];
};

export function MemoryAtlas({
  person,
  name,
  incident,
  hasSignal,
}: {
  person: PersonId;
  name: string;
  incident: boolean;
  hasSignal: boolean;
}) {
  const [space, setSpace] = useState<Space | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [angle, setAngle] = useState(-28),
    [tilt, setTilt] = useState(0.3),
    [zoom, setZoom] = useState(1);
  const [group, setGroup] = useState<string | null>(null),
    [nearby, setNearby] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    angle: number;
    tilt: number;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch("/reference/design/lab/space.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Unavailable");
        return r.json();
      })
      .then((data: Space) => {
        if (
          !data.episodes?.length ||
          !data.clusters?.length ||
          !data.queries?.length ||
          !data.episodes.every(
            (r) => r.vector.length === 384 && r.position.length === 3,
          )
        )
          throw new Error("Incomplete clustering data");
        setSpace(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  const query = hasSignal
    ? space?.queries.find(
        (q) => q.id === `${person}-${incident ? "incident" : "base"}`,
      )
    : undefined;
  const ranked = useMemo(
    () => (space && query ? retrieve(space.episodes, query) : []),
    [space, query],
  );
  useEffect(() => {
    setSelected(null);
    setGroup(null);
    setNearby(false);
  }, [query?.id]);
  const closest = new Set(ranked.slice(0, 6).map((r) => r.id));
  const visible = (space?.episodes || []).filter((r) =>
    nearby ? closest.has(r.id) : group ? r.clusterId === group : true,
  );
  const visibleIds = new Set(visible.map((r) => r.id));
  const chosen =
    visible.find((r) => r.id === selected) ||
    ranked.find((r) => visibleIds.has(r.id)) ||
    visible[0];
  const chosenGroup = space?.clusters.find((c) => c.id === chosen?.clusterId);
  const similarity = ranked.find((r) => r.id === chosen?.id)?.similarity;
  const max = space
    ? Math.max(
        ...space.episodes.flatMap((r) => r.position.map(Math.abs)),
        ...(query?.position.map(Math.abs) || []),
      )
    : 1;
  const project = (v: number[]) => {
    const [x, y, z] = v.map((n) => (n / max) * 132 * zoom),
      a = (angle * Math.PI) / 180;
    const xx = x * Math.cos(a) + z * Math.sin(a),
      zz = -x * Math.sin(a) + z * Math.cos(a);
    const depth = y * Math.sin(tilt) + zz * Math.cos(tilt),
      scale = 1 / (1 - depth / 1600);
    return {
      x: 300 + xx * scale,
      y: 176 - (y * Math.cos(tilt) - zz * Math.sin(tilt)) * scale,
      z: depth,
      scale,
    };
  };
  const bound = max * 0.98,
    edges: number[][][] = [],
    floor: number[][][] = [];
  for (const x of [-bound, bound])
    for (const y of [-bound, bound])
      edges.push(
        [
          [x, y, -bound],
          [x, y, bound],
        ],
        [
          [x, -bound, y],
          [x, bound, y],
        ],
        [
          [-bound, x, y],
          [bound, x, y],
        ],
      );
  for (let n = -0.75; n < 1; n += 0.25)
    floor.push(
      [
        [n * bound, -bound, -bound],
        [n * bound, -bound, bound],
      ],
      [
        [-bound, -bound, n * bound],
        [bound, -bound, n * bound],
      ],
    );
  const polygons = [
    [
      [-bound, -bound, -bound],
      [bound, -bound, -bound],
      [bound, -bound, bound],
      [-bound, -bound, bound],
    ],
    [
      [-bound, -bound, -bound],
      [-bound, bound, -bound],
      [bound, bound, -bound],
      [bound, -bound, -bound],
    ],
  ];
  const reset = () => {
    setGroup(null);
    setNearby(false);
    setSelected(null);
    setAngle(-28);
    setTilt(0.3);
    setZoom(1);
  };
  const selectGroup = (id: string) => {
    setGroup(group === id ? null : id);
    setNearby(false);
    setSelected(null);
  };
  const fingerprintMax = chosen ? Math.max(...chosen.vector.map(Math.abs)) : 1;
  return (
    <section className="km-atlas" aria-label="Customer semantic memory atlas">
      <header>
        <div>
          <span className="km-kicker">
            01 / SEMANTIC MEMORY · {space?.episodes.length || "…"} EPISODES
          </span>
          <h2>Explore the neighbourhood.</h2>
        </div>
        <span className="km-model">
          MiniLM <b>384D</b>
        </span>
      </header>
      {space ? (
        <>
          <div
            className="km-clusters"
            aria-label="Filter by computed memory group"
          >
            {space.clusters.map((c) => (
              <button
                key={c.id}
                aria-pressed={group === c.id}
                onClick={() => selectGroup(c.id)}
                style={{ "--cluster": c.color } as CSSProperties}
              >
                <i />
                {c.label}
                <span>{c.size}</span>
              </button>
            ))}
          </div>
          <div className="km-atlas-toolbar">
            <button
              className="km-relevance"
              aria-pressed={nearby}
              disabled={!query}
              onClick={() => {
                setNearby(!nearby);
                setGroup(null);
                setSelected(null);
              }}
            >
              ◇ Relevant to {name}
            </button>
            <span>
              {nearby
                ? "6 closest in 384D"
                : group
                  ? `${visible.length} memories in this group`
                  : "5 computed groups · select to isolate"}
            </span>
            <button onClick={reset} aria-label="Reset memory atlas">
              ↺ Reset
            </button>
          </div>
          <div className="km-space">
            <svg
              viewBox="0 0 600 360"
              tabIndex={0}
              aria-label="Interactive memory cube. Drag to rotate, use arrow keys to turn, or select a memory point."
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  angle,
                  tilt,
                  moved: false,
                };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || !e.buttons) return;
                const dx = e.clientX - d.x,
                  dy = e.clientY - d.y;
                if (Math.abs(dx) + Math.abs(dy) > 4) {
                  d.moved = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setAngle(d.angle + dx * 0.5);
                  setTilt(Math.max(-0.7, Math.min(0.85, d.tilt + dy * 0.005)));
                }
              }}
              onPointerUp={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  if (e.key === "ArrowLeft" || e.key === "ArrowRight")
                    setAngle((a) => a + (e.key === "ArrowLeft" ? -8 : 8));
                  else
                    setTilt((t) =>
                      Math.max(
                        -0.7,
                        Math.min(
                          0.85,
                          t + (e.key === "ArrowUp" ? -0.08 : 0.08),
                        ),
                      ),
                    );
                }
              }}
            >
              <defs>
                <radialGradient id="memory-illumination">
                  <stop stopColor="#8664b6" stopOpacity=".24" />
                  <stop offset="1" stopColor="#171828" stopOpacity="0" />
                </radialGradient>
                {space.clusters.map((c) => (
                  <radialGradient key={c.id} id={`glow-${c.id}`}>
                    <stop
                      stopColor={c.color}
                      stopOpacity={group === c.id ? ".18" : ".10"}
                    />
                    <stop offset="1" stopColor={c.color} stopOpacity="0" />
                  </radialGradient>
                ))}
              </defs>
              <ellipse
                cx="300"
                cy="180"
                rx="270"
                ry="180"
                fill="url(#memory-illumination)"
              />
              {polygons.map((poly, i) => (
                <polygon
                  className={`km-plane km-plane-${i}`}
                  key={i}
                  points={poly
                    .map((v) => {
                      const p = project(v);
                      return `${p.x},${p.y}`;
                    })
                    .join(" ")}
                />
              ))}
              <g className="km-floor">
                {floor.map(([a, b], i) => {
                  const p = project(a),
                    q = project(b);
                  return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
                })}
              </g>
              <g className="km-grid">
                {edges.map(([a, b], i) => {
                  const p = project(a),
                    q = project(b);
                  return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
                })}
              </g>
              {space.clusters.map((c) => {
                const points = space.episodes
                  .filter((r) => r.clusterId === c.id)
                  .map((r) => project(r.position));
                const x = points.reduce((s, p) => s + p.x, 0) / points.length,
                  y = points.reduce((s, p) => s + p.y, 0) / points.length;
                const rx = Math.max(
                    24,
                    Math.sqrt(
                      points.reduce((s, p) => s + (p.x - x) ** 2, 0) /
                        points.length,
                    ) * 1.8,
                  ),
                  ry = Math.max(
                    22,
                    Math.sqrt(
                      points.reduce((s, p) => s + (p.y - y) ** 2, 0) /
                        points.length,
                    ) * 1.8,
                  );
                const active = !group || group === c.id;
                return (
                  <g
                    key={c.id}
                    opacity={active && !nearby ? 1 : 0.2}
                    className="km-region"
                  >
                    <ellipse
                      cx={x}
                      cy={y}
                      rx={rx + 15}
                      ry={ry + 15}
                      fill={`url(#glow-${c.id})`}
                    />
                    {group === c.id && (
                      <ellipse
                        cx={x}
                        cy={y}
                        rx={rx}
                        ry={ry}
                        fill="none"
                        stroke={c.color}
                        strokeOpacity=".4"
                        strokeDasharray="2 5"
                      />
                    )}
                  </g>
                );
              })}
              {query &&
                ranked
                  .slice(0, 6)
                  .filter((r) => visibleIds.has(r.id))
                  .map((r) => {
                    const p = project(r.position),
                      q = project(query.position);
                    return (
                      <line
                        className="km-neighbour"
                        key={r.id}
                        x1={p.x}
                        y1={p.y}
                        x2={q.x}
                        y2={q.y}
                      />
                    );
                  })}
              {space.episodes
                .map((r) => ({ ...r, p: project(r.position) }))
                .sort((a, b) => a.p.z - b.p.z)
                .map((r) => {
                  const active = visibleIds.has(r.id),
                    isSelected = chosen?.id === r.id,
                    color = space.clusters.find(
                      (c) => c.id === r.clusterId,
                    )!.color;
                  return (
                    <g
                      key={r.id}
                      transform={`translate(${r.p.x},${r.p.y})`}
                      className="km-point"
                      role="button"
                      tabIndex={active ? 0 : -1}
                      aria-label={`Inspect ${r.id}: ${r.title}`}
                      aria-pressed={isSelected}
                      aria-hidden={!active}
                      style={{
                        pointerEvents: active ? "auto" : "none",
                        opacity: active ? 1 : 0.1,
                      }}
                      onClick={() => {
                        if (!drag.current?.moved) setSelected(r.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(r.id);
                        }
                      }}
                    >
                      <title>{r.title}</title>
                      <circle r="11" fill="transparent" />
                      {isSelected && (
                        <circle
                          r="12"
                          fill={color}
                          fillOpacity=".13"
                          stroke={color}
                          strokeOpacity=".6"
                        />
                      )}
                      <circle
                        r={(isSelected ? 5.5 : 4) * r.p.scale}
                        fill={color}
                        stroke={isSelected ? "#fff" : color}
                        strokeWidth={isSelected ? 1.1 : 0.6}
                      />
                      <circle
                        r="1.2"
                        fill="#fff"
                        opacity={isSelected ? 1 : 0.48}
                      />
                    </g>
                  );
                })}
              {query && (
                <g
                  className="km-query"
                  transform={`translate(${project(query.position).x},${project(query.position).y})`}
                >
                  <circle
                    r="20"
                    fill="none"
                    stroke="#f3e7ff"
                    strokeOpacity=".22"
                    strokeDasharray="2 5"
                  />
                  <path
                    d="M0 -8L8 0L0 8L-8 0Z"
                    fill="#fff6e7"
                    stroke="#211c32"
                    strokeWidth="2"
                  />
                  <text x="-13" y="-20" textAnchor="end">
                    {name.toUpperCase()} / CONTEXT
                  </text>
                </g>
              )}
              <text className="km-plot-note" x="18" y="340">
                COSINE GROUPS / 3D PCA
              </text>
              <text className="km-plot-note" x="582" y="340" textAnchor="end">
                {(zoom * 100).toFixed(0)}%
              </text>
            </svg>
            <div className="km-zoom">
              <button
                onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
                disabled={zoom >= 1.8}
                aria-label="Zoom into memory cube"
              >
                +
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
                disabled={zoom <= 0.7}
                aria-label="Zoom out of memory cube"
              >
                −
              </button>
            </div>
          </div>
          <div className="km-orbit">
            <label>
              ORBIT{" "}
              <input
                aria-label="Rotate customer memory atlas"
                type="range"
                min="-180"
                max="180"
                value={((((angle + 180) % 360) + 360) % 360) - 180}
                onChange={(e) => setAngle(Number(e.target.value))}
              />
            </label>
            <span>
              DRAG TO EXPLORE ·{" "}
              {(
                space.manifest.projection.explainedVariance.reduce(
                  (a, b) => a + b,
                  0,
                ) * 100
              ).toFixed(1)}
              % VARIANCE
            </span>
          </div>
          <div className="km-retrieved" aria-live="polite">
            <div className="km-retrieved-heading">
              <span style={{ color: chosenGroup?.color }}>
                {chosenGroup?.label.toUpperCase()} / {chosen?.id}
              </span>
              <span>
                {similarity === undefined
                  ? "EXAMPLE MEMORY"
                  : `COSINE ${similarity.toFixed(3)}`}
              </span>
            </div>
            <p>{chosen?.title}</p>
            <div className="km-vector-row">
              <div
                className="km-fingerprint"
                role="img"
                aria-label="384-dimensional episode vector, averaged from three formulations"
              >
                {chosen?.vector.map((v, i) => (
                  <i
                    key={i}
                    title={`Dimension ${i + 1}: ${v.toFixed(5)}`}
                    style={{
                      background: v < 0 ? "#a99ad9" : "#81b8c6",
                      opacity: 0.18 + (0.82 * Math.abs(v)) / fingerprintMax,
                    }}
                  />
                ))}
              </div>
              <button onClick={() => dialog.current?.showModal()}>
                Read memory ↗
              </button>
            </div>
          </div>
          <dialog ref={dialog} className="evidence-dialog km-memory-dialog">
            <header>
              <span className="eyebrow">Example episode / {chosen?.id}</span>
              <button
                onClick={() => dialog.current?.close()}
                aria-label="Close memory details"
              >
                ×
              </button>
            </header>
            <h2>{chosen?.title}</h2>
            <p>
              {chosenGroup?.label} · computed group, editorial label.{" "}
              {similarity === undefined
                ? ""
                : `Cosine similarity to the saved customer context: ${similarity.toFixed(4)}.`}
            </p>
            <div className="km-formulations">
              {chosen?.recordIds.map((id) => (
                <div key={id}>
                  <code>{id}</code>
                  <p>{space.records.find((r) => r.id === id)?.text}</p>
                </div>
              ))}
            </div>
            <p className="km-detail-note">
              Three formulations of one authored synthetic episode, collapsed to
              one point. Groups use spherical k-means on the 384D mean vectors.
              Projected envelopes are visual guides; groups overlap. Similarity
              does not establish customer facts or authorise action.
            </p>
          </dialog>
        </>
      ) : (
        <div className="km-load" role="status">
          {error ? (
            <>
              The memory space could not load.
              <button onClick={() => setAttempt((n) => n + 1)}>
                Retry atlas
              </button>
            </>
          ) : (
            "Loading memory neighbourhoods…"
          )}
        </div>
      )}
    </section>
  );
}
