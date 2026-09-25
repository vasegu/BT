import { useEffect, useMemo, useState } from "react";
import { retrieve } from "../../docs/design/lab/logic.mjs";
import type { Decision, Household, Snapshot, SourceEvent } from "./types";

type Episode = {
  id: string;
  title: string;
  text: string;
  category: string;
  vector: number[];
  position: number[];
};
type Space = {
  manifest: { projection: { explainedVariance: number[] } };
  records: Episode[];
  queries: { id: string; text: string; vector: number[]; position: number[] }[];
  categories: { id: string; label: string; color: string }[];
};
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
const eventNames: Record<string, string> = {
  "contact.authority_recorded": "Authority",
  "case.opened": "Case opened",
  "diagnostic.completed": "Restart tried",
  "promise.created": "Promise made",
  "order.delivered": "Hub delivered",
  "preference.stated": "Habit stated",
  "pattern.recorded": "Pattern retained",
  "router.heartbeat_overdue": "Signal raised",
  "router.heartbeat_received": "Heartbeat back",
  "service.restored_observed": "Restored",
  "promise.fulfilled": "Promise kept",
  "customer.confirmed_working": "Confirmed",
};

export function CustomerMemory({
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
  const [space, setSpace] = useState<Space | null>(null);
  const [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [angle, setAngle] = useState(-28),
    [selected, setSelected] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch("/reference/design/lab/space.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Memory space unavailable");
        return r.json();
      })
      .then((data: Space) => {
        if (
          !data.records?.length ||
          !data.queries?.length ||
          !data.categories?.length ||
          !data.records.every(
            (r) => r.vector?.length === 384 && r.position?.length === 3,
          ) ||
          !data.queries.every(
            (q) => q.vector?.length === 384 && q.position?.length === 3,
          )
        )
          throw new Error("Incomplete embedding data");
        setSpace(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  // These saved lab queries describe the initial scenario, not an embedding of the live snapshot.
  const query = snapshot.cutoff
    ? space?.queries.find(
        (q) =>
          q.id ===
          `${h.id}-${snapshot.operations.incident ? "incident" : "base"}`,
      )
    : undefined;
  const ranked = useMemo(
    () => (space && query ? retrieve(space.records, query) : []),
    [space, query],
  );
  useEffect(() => {
    setSelected(null);
  }, [query?.id]);
  const chosen = ranked.find((r) => r.id === selected) || ranked[0];
  const events = h.evidence.filter((e) => e.subject === h.id);
  const event = events.find((e) => e.id === eventId) || events.at(-1);
  const knowledge =
    h.id === "maya"
      ? [
          ["Stated habit", h.habit || "No habit recorded"],
          [
            "Retained pattern",
            `${events.find((e) => e.type === "pattern.recorded")?.payload.sampleSize ?? "No"} recovered gaps · synthetic summary`,
          ],
          ["Latest observation", h.serviceState],
        ]
      : h.id === "daniel"
        ? [
            [
              "Earlier attempt",
              h.restartTried
                ? "Restart tried · unsuccessful"
                : "No restart result",
            ],
            [
              "Relationship",
              `${h.owner || "Unassigned"} · ${h.caseStatus} case`,
            ],
            [
              "Commitment",
              h.promise
                ? `${time(h.promise)} callback · ${h.promiseFulfilled ? "kept" : "outstanding"}`
                : "No promise recorded",
            ],
          ]
        : [
            ["Known history", "Hub delivery recorded"],
            ["Still unknown", "Activation and successful first use"],
            ["Latest observation", h.serviceState],
          ];
  const max = space
    ? Math.max(
        ...space.records.flatMap((r) => r.position.map(Math.abs)),
        ...(query?.position.map(Math.abs) || []),
      )
    : 1;
  const project = (v: number[]) => {
    const [x, y, z] = v.map((n) => (n / max) * 126),
      a = (angle * Math.PI) / 180;
    const xx = x * Math.cos(a) + z * Math.sin(a),
      zz = -x * Math.sin(a) + z * Math.cos(a);
    const depth = y * Math.sin(0.29) + zz * Math.cos(0.29),
      scale = 1 / (1 - depth / 1500);
    return {
      x: 457 + xx * scale,
      y: 169 - (y * Math.cos(0.29) - zz * Math.sin(0.29)) * scale,
      z: depth,
      scale,
    };
  };
  const bound = max * 0.96,
    edges: number[][][] = [];
  for (const x of [-bound, bound])
    for (const y of [-bound, bound]) {
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
    }
  const hot = new Set(ranked.slice(0, 6).map((r) => r.id));
  const fingerprintMax = chosen ? Math.max(...chosen.vector.map(Math.abs)) : 1;
  return (
    <div className="customer-memory">
      <div className="km-upper">
        <section
          className="km-atlas"
          aria-label="Customer semantic memory atlas"
        >
          <header>
            <div>
              <span className="km-kicker">
                01 / SEMANTIC MEMORY{" "}
                {space && `· ${space.records.length} EXAMPLES`}
              </span>
              <h2>Find the relevant history.</h2>
            </div>
            <span className="km-model">
              MiniLM <b>384D</b>
            </span>
          </header>
          {space ? (
            <>
              <div className="km-legend" aria-label="Authored topic colours">
                {space.categories.map((c) => (
                  <span key={c.id}>
                    <i style={{ background: c.color }} />
                    {c.label}
                  </span>
                ))}
              </div>
              <div className="km-space">
                <svg
                  viewBox="245 0 430 330"
                  aria-label="Rotate and inspect the lab's computed embedding space. Colours are authored topics; distances are a lossy PCA projection."
                >
                  <defs>
                    <radialGradient id="km-glow">
                      <stop stopColor="#744599" stopOpacity=".19" />
                      <stop offset="1" stopColor="#1b1427" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <ellipse
                    cx="450"
                    cy="175"
                    rx="290"
                    ry="175"
                    fill="url(#km-glow)"
                  />
                  <g className="km-grid">
                    {edges.map(([a, b], i) => {
                      const p = project(a),
                        q = project(b);
                      return (
                        <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
                      );
                    })}
                  </g>
                  {query &&
                    ranked.slice(0, 6).map((r) => {
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
                  {space.records
                    .map((r) => ({ ...r, p: project(r.position) }))
                    .sort((a, b) => a.p.z - b.p.z)
                    .map((r) => (
                      <g
                        key={r.id}
                        transform={`translate(${r.p.x} ${r.p.y})`}
                        role={query ? "button" : undefined}
                        tabIndex={query ? 0 : undefined}
                        aria-label={`Inspect ${r.id}: ${r.title}`}
                        aria-pressed={chosen?.id === r.id}
                        onClick={() => setSelected(r.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelected(r.id);
                          }
                        }}
                        className="km-point"
                      >
                        <title>{r.title}</title>
                        <circle r="10" fill="transparent" />
                        <circle
                          r={
                            (chosen?.id === r.id
                              ? 4.5
                              : hot.has(r.id)
                                ? 3.5
                                : 2.5) * r.p.scale
                          }
                          fill={
                            chosen?.id === r.id
                              ? "#fff"
                              : space.categories.find(
                                  (c) => c.id === r.category,
                                )?.color
                          }
                          opacity={
                            hot.has(r.id) || chosen?.id === r.id ? 1 : 0.6
                          }
                        />
                        {chosen?.id === r.id && (
                          <circle
                            r="9"
                            fill="none"
                            stroke="#dfc6fa"
                            strokeWidth=".7"
                          />
                        )}
                      </g>
                    ))}
                  {query && (
                    <g
                      className="km-query"
                      transform={`translate(${project(query.position).x} ${project(query.position).y})`}
                    >
                      <circle
                        r="17"
                        fill="none"
                        stroke="#ceb1f2"
                        strokeOpacity=".45"
                        strokeDasharray="2 4"
                      />
                      <path
                        d="M0 -7L7 0L0 7L-7 0Z"
                        fill="#f4eaff"
                        stroke="#1b1427"
                        strokeWidth="2"
                      />
                      <text x="-13" y="-17" textAnchor="end">
                        {h.name.split(" ")[0].toUpperCase()} / CONTEXT
                      </text>
                    </g>
                  )}
                </svg>
              </div>
              <div className="km-orbit">
                <label>
                  ORBIT{" "}
                  <input
                    aria-label="Rotate customer memory atlas"
                    type="range"
                    min="-180"
                    max="180"
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                  />
                </label>
                <span>
                  {(
                    space.manifest.projection.explainedVariance.reduce(
                      (a, b) => a + b,
                      0,
                    ) * 100
                  ).toFixed(1)}
                  % VARIANCE SHOWN
                </span>
              </div>
              <div className="km-retrieved" aria-live="polite">
                <div className="km-retrieved-heading">
                  <span>
                    RETRIEVED EXAMPLE / {chosen?.id || "AWAITING SIGNAL"}
                  </span>
                  <span>
                    {chosen ? `COSINE ${chosen.similarity.toFixed(3)}` : "—"}
                  </span>
                </div>
                <p>
                  {chosen?.title ||
                    "Run the scenario from the account to retrieve relevant episodes."}
                </p>
                {chosen && (
                  <div
                    className="km-fingerprint"
                    role="img"
                    aria-label="384 embedding components: purple negative, teal positive"
                  >
                    {chosen.vector.map((v, i) => (
                      <i
                        key={i}
                        title={`Dimension ${i + 1}: ${v.toFixed(5)}`}
                        style={{
                          background: v < 0 ? "#b78bdc" : "#65b9ab",
                          opacity: 0.18 + (0.82 * Math.abs(v)) / fingerprintMax,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
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
                "Loading computed vectors…"
              )}
            </div>
          )}
        </section>
        <aside className="km-understanding">
          <div className="km-person">
            <span className="km-kicker">02 / WHAT WE KNOW</span>
            <h2>
              {h.id === "maya"
                ? "An overnight rhythm."
                : h.id === "sam"
                  ? "A first-use gap."
                  : "A history to honour."}
            </h2>
            <p>
              {h.id === "maya"
                ? "Her stated habit changes how a quiet router is interpreted."
                : h.id === "sam"
                  ? "Delivered equipment does not establish a working connection."
                  : "Earlier attempts and promises stay attached to the relationship."}
            </p>
          </div>
          <dl className="km-facts">
            {knowledge.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="km-implication">
            <span className="km-kicker">03 / WHAT THIS CHANGES</span>
            <h3>{decision?.title || "Wait for the first signal."}</h3>
            <p>
              {decision?.reason ||
                "The source history is ready. No action has been selected."}
            </p>
            <span className="km-decision-tag">
              {decision
                ? `${decision.disposition} / rule-derived`
                : "No decision yet"}
            </span>
          </div>
          <p className="km-provenance">
            Atlas: saved lab scenario context,{" "}
            {snapshot.operations.incident
              ? "with incident scope"
              : "before incident scope"}
            . Readout and timeline: this session’s source records. Similarity is
            not confidence.
          </p>
        </aside>
      </div>
      <section className="km-history" aria-label="Customer memory over time">
        <header>
          <h2>Memory over time</h2>
          <span>{events.length} CUSTOMER RECORDS · SELECT TO TRACE</span>
        </header>
        <div className="km-timeline">
          {events.map((e) => (
            <button
              key={e.id}
              aria-pressed={event?.id === e.id}
              onClick={() => setEventId(e.id)}
              title={`${e.occurredAt}: ${e.description}`}
            >
              <time>
                {time(e.occurredAt)}
                <small>
                  {new Date(e.occurredAt).toLocaleDateString("en-GB", {
                    timeZone: "Europe/London",
                    day: "2-digit",
                    month: "short",
                  })}
                </small>
              </time>
              <i />
              <span>{eventNames[e.type] || e.type}</span>
            </button>
          ))}
        </div>
        {event && (
          <div className="km-evidence" aria-live="polite">
            <div>
              <code>{event.type}</code>
              <p>{event.description}</p>
            </div>
            <button
              onClick={() => inspect(event)}
              aria-label="Inspect selected source record"
            >
              Source record ↗
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
