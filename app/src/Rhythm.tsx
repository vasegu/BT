import type { Snapshot, PersonId } from "./types";
import "./rhythm.css";

const DAYS = 30;
const HOUR = 3600e3;
// Six four-hour windows per day, ordered from morning so the night sits together at the
// bottom. Each router's windows keep their own phase, read from the data.
const BINS = [4, 8, 12, 16, 20, 24];
const londonHour = (ms: number) =>
  Number(new Date(ms).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }));
const london = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
  });

type Cell = { state: "full" | "partial" | "gap" | "silent" | "none" | "future" | "now"; ratio: number };

/** The router's heartbeat per four-hour window, from the recorded observation windows. */
export function rhythmGrid(snapshot: Snapshot, person: PersonId, DAYS = 30) {
  const clock = Date.parse(snapshot.clock);
  const windows = new Map<number, { expected: number; received: number; coverage: string }>();
  for (const e of snapshot.events) {
    if (e.subject !== person || e.type !== "router.observation_window") continue;
    const p = e.payload as { intervalStart?: string; expected?: number; received?: number; coverage?: string };
    if (!p.intervalStart) continue;
    windows.set(Date.parse(p.intervalStart), {
      expected: Number(p.expected) || 0,
      received: Number(p.received) || 0,
      coverage: String(p.coverage),
    });
  }
  if (!windows.size) return null;
  const today = Date.UTC(
    new Date(clock).getUTCFullYear(),
    new Date(clock).getUTCMonth(),
    new Date(clock).getUTCDate(),
  );
  const lastEvent = (types: string[]) =>
    snapshot.events
      .filter((e) => e.subject === person && types.includes(e.type) && e.revision > 0)
      .at(-1);
  const overdue = lastEvent(["router.heartbeat_overdue"]);
  const back = lastEvent(["router.heartbeat_received", "service.restored_observed", "activation.first_use_observed"]);
  const quietNow = !!overdue && (!back || Date.parse(back.occurredAt) < Date.parse(overdue.occurredAt));

  const phase = Math.max(...windows.keys()) % (4 * HOUR);
  const offsets = BINS.map((h) => h * HOUR + phase);
  const days = Array.from({ length: DAYS }, (_, i) => today - (DAYS - 1 - i) * 24 * HOUR);
  const grid: Cell[][] = offsets.map((offset) =>
    days.map((day) => {
      const start = day + offset;
      const w = windows.get(start);
      if (start <= clock && clock < start + 4 * HOUR)
        return { state: "now", ratio: 0 };
      if (start >= clock) return { state: "future", ratio: 0 };
      if (!w) return { state: "none", ratio: 0 };
      if (w.coverage === "no_telemetry") return { state: "silent", ratio: 0 };
      const ratio = w.expected ? w.received / w.expected : 0;
      return { state: ratio >= 0.95 ? "full" : ratio >= 0.5 ? "partial" : "gap", ratio };
    }),
  );

  const observed = grid.flat().filter((c) => ["full", "partial", "gap", "silent"].includes(c.state));
  const silent = observed.filter((c) => c.state === "silent").length;
  // A window counts as night when most of it falls between 20:00 and 08:00 London time.
  const night = offsets.map((o) => {
    const h = londonHour(today + o + 2 * HOUR);
    return h >= 20 || h < 8;
  });
  const gaps = grid
    .flatMap((row, r) => row.map((c, d) => ({ c, r, d })))
    .filter(({ c }) => c.state === "gap" || c.state === "partial");
  const nightGaps = gaps.filter(({ r }) => night[r]).length;
  // What the customer and the diagnostics said, which a management heartbeat cannot see.
  const faults = snapshot.events
    .filter(
      (e) =>
        e.subject === person &&
        // A fault is something that went wrong: a failed or intermittent test, or a fault case
        // (not an activation case, which is a setup still in progress).
        (e.type === "service.failure_observed" ||
          e.type === "line.drops_detected" ||
          (e.type === "diagnostic.completed" && ["intermittent", "not_resolved", "failed"].includes(String((e.payload as { result?: string }).result))) ||
          (e.type === "case.opened" && (e.payload as { owner?: string }).owner !== "Activation team")) &&
        Date.parse(e.receivedAt) <= clock,
    )
    .map((e) => ({ day: days.findIndex((d) => Date.parse(e.occurredAt) >= d && Date.parse(e.occurredAt) < d + 24 * HOUR), text: e.description }))
    .filter((f) => f.day >= 0);
  // Tonight's records only: a household's other products (Maya's mobile) have their own history.
  const tonightRecord = (type: string) =>
    snapshot.events.find((e) => e.subject === person && e.type === type && e.revision > 0 && Date.parse(e.receivedAt) <= clock);
  const firstUse = tonightRecord("activation.first_use_observed");
  const switchedOn = tonightRecord("router.setup_attempted");
  const summary = firstUse
    ? `Connected for the first time tonight, at ${new Date(firstUse.occurredAt).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })} · no history before`
    : switchedOn && silent && silent >= observed.length / 2
      ? "Switched on for the first time tonight · it has not connected yet"
      : !observed.length
    ? "No heartbeat windows recorded yet"
    : silent && silent >= observed.length / 2
      ? `No heartbeat since the hub was delivered · ${silent} silent windows`
      : gaps.length === 0 && faults.length
        ? "Hub always reachable, yet the line dropped this week · line monitoring caught it; the heartbeat alone would miss it"
        : gaps.length === 0
        ? "Management heartbeat steady for 30 days · tonight is the exception"
        : nightGaps / gaps.length > 0.7
          ? "Switched off most nights, back by morning"
          : `Heartbeat mostly steady · ${gaps.length} gaps this month`;

  return { grid, offsets, today, quietNow, summary, faults };
}

/** Thirty days of the router's heartbeat. */
export function Rhythm({ snapshot, person }: { snapshot: Snapshot; person: PersonId }) {
  const r = rhythmGrid(snapshot, person);
  if (!r) return null;
  const { grid, offsets, today, quietNow, summary, faults } = r;
  return (
    <figure className="rhythm" aria-label={`Router heartbeat over the last 30 days. ${summary}`}>
      <figcaption>
        <span className="eyebrow">Router rhythm · 30 days</span>
        <strong>{summary}</strong>
      </figcaption>
      <div className="rhythm-body">
        <div className="rhythm-hours" aria-hidden="true">
          {offsets.map((o) => (
            <span key={o}>{london(today + o)}</span>
          ))}
        </div>
        <div className="rhythm-grid" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}>
          {grid.map((row, r) =>
            row.map((c, d) => (
              <i
                key={`${r}-${d}`}
                className={`rc rc-${c.state}${c.state === "now" && quietNow ? " is-quiet" : ""}`}
                style={c.state === "partial" ? { opacity: 0.35 + c.ratio * 0.5 } : undefined}
              />
            )),
          )}
        </div>
      </div>
      {faults.length > 0 && (
        <div className="rhythm-faults" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}>
          {Array.from({ length: DAYS }, (_, d) => {
            const here = faults.filter((f) => f.day === d);
            return <i key={d} className={here.length ? "is-fault" : ""} title={here.map((f) => f.text).join("\n")} />;
          })}
        </div>
      )}
      <div className="rhythm-axis" aria-hidden="true">
        <span>−30d</span>
        <span>−15d</span>
        {faults.length > 0 && <span className="is-fault">▲ fault on record</span>}
        <span className={quietNow ? "is-quiet" : ""}>tonight{quietNow ? " · quiet now" : ""}</span>
      </div>
    </figure>
  );
}
