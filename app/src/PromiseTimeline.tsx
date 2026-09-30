import type { Household, Snapshot, SourceEvent } from "./types";
import "./promise-timeline.css";

// "Fixed isn't the same as kept": network recovery, system decisions, the human promise
// and the customer's experience on one clock. Built only from recorded events,
// decisions and actions for the household in focus.
const W = 1200,
  LEFT = 150,
  RIGHT = 36,
  LANE = 78,
  TOP = 26;
const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const trim = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Mark = {
  lane: number;
  t: number;
  label: string;
  sub?: string;
  tone: "network" | "system" | "human" | "customer" | "restore" | "promise" | "alert";
  shape?: "dot" | "hollow" | "star";
  event?: SourceEvent;
};

export function PromiseTimeline({
  snapshot,
  person,
  onInspect,
}: {
  snapshot: Snapshot;
  person: Household;
  onInspect?: (e: SourceEvent) => void;
}) {
  const clock = Date.parse(snapshot.clock);
  // The axis is spaced by moment, not by minute: each recorded clock stop gets equal width
  // (time is interpolated between stops), so the busy 21:12–21:18 stretch stays readable.
  const stops = ["19:45", "20:00", "20:03", "20:12", "20:15", "20:18", "20:21"].map((t) => Date.parse(`2026-09-25T${t}:00Z`));
  const start = stops[0],
    end = stops.at(-1)!;
  const x = (t: number) => {
    const v = Math.min(Math.max(t, start), end);
    const i = Math.max(0, stops.findIndex((s, k) => v >= s && v <= stops[k + 1]));
    const f = (v - stops[i]) / (stops[i + 1] - stops[i] || 1);
    return LEFT + ((i + f) / (stops.length - 1)) * (W - LEFT - RIGHT);
  };
  const historicalPromise = snapshot.events.find((e) => e.subject === person.id && e.type === "promise.created" && Date.parse(e.occurredAt) >= start && Date.parse(e.occurredAt) <= end);
  const owner = (historicalPromise?.payload as { owner?: string } | undefined)?.owner;
  const lanes = ["Network", "System", owner || person.owner || "No named owner", person.name.split(" ")[0]];
  const H = TOP + lanes.length * LANE + 24;
  const y = (lane: number) => TOP + lane * LANE + LANE / 2;
  const at = (e: SourceEvent) => Date.parse(e.occurredAt);
  const mine = snapshot.events.filter((e) => e.subject === person.id && at(e) >= start && at(e) <= Math.min(clock, end));
  const shared = snapshot.events.filter(
    (e) => e.subject === "shared" && (e.type === "incident.confirmed" || e.type === "incident.cleared") && person.incident,
  );
  const marks: Mark[] = [];
  const net: Record<string, [string, Mark["tone"]]> = {
    "router.heartbeat_overdue": ["Heartbeat lost", "alert"],
    "router.setup_attempted": ["Hub switched on · no sync", "alert"],
    "incident.cleared": ["Incident cleared", "restore"],
    "router.heartbeat_received": ["Heartbeat back", "restore"],
    "service.restored_observed": ["Line test passed", "restore"],
    "activation.first_use_observed": ["First use observed", "restore"],
  };
  // Tonight only: the weeks after have their own view.
  for (const e of [...mine, ...shared].filter((x) => at(x) <= end)) {
    if (net[e.type]) marks.push({ lane: 0, t: at(e), label: net[e.type][0], tone: net[e.type][1], event: e });
    if (e.type === "incident.confirmed") marks.push({ lane: 0, t: at(e), label: "Incident confirmed", sub: "service in scope", tone: "alert", event: e });
    if (e.type === "promise.created")
      marks.push({ lane: 2, t: at(e), label: "Promise made", sub: `call at ${clockTime(String((e.payload as { dueAt?: string }).dueAt || e.occurredAt))}`, tone: "promise", event: e });
    if (e.type === "promise.fulfilled") marks.push({ lane: 2, t: at(e), label: "Called · promise kept", tone: "promise", event: e });
    if (e.type === "customer.confirmed_working")
      marks.push({ lane: 3, t: at(e), label: `“${String((e.payload as { statement?: string }).statement || "It’s working")}”`, sub: "loop closed", tone: "customer", shape: "star", event: e });
  }
  const decisions = snapshot.decisions.filter((d) => d.person === person.id && Date.parse(d.time) >= start && Date.parse(d.time) <= Math.min(clock, end));
  decisions.forEach((d, i) => {
    const changed = i === 0 || decisions[i - 1].title !== d.title;
    if (changed) marks.push({ lane: 1, t: Date.parse(d.time), label: trim(d.title, 28), sub: d.disposition, tone: "system", shape: "hollow" });
  });
  const actions = snapshot.actions.filter((a) => a.person === person.id && Date.parse(a.time) >= start && Date.parse(a.time) <= Math.min(clock, end));
  for (const a of actions) marks.push({ lane: 3, t: Date.parse(a.time) + 60e3, label: trim(a.title, 30), sub: "update received", tone: "customer" });
  const quiet = !actions.length && decisions.some((d) => d.disposition === "watch" || d.disposition === "suppress");

  const promise = mine.find((e) => e.type === "promise.created");
  const kept = mine.find((e) => e.type === "promise.fulfilled");
  const restored = mine.find((e) => e.type === "service.restored_observed" || e.type === "router.heartbeat_received" || e.type === "activation.first_use_observed");
  const confirmed = mine.find((e) => e.type === "customer.confirmed_working");
  // Each home teaches a different lesson; the headline and status follow that home's story.
  const firstUse = mine.some((e) => e.type === "activation.first_use_observed");
  const kind = promise ? "promise" : mine.some((e) => e.type === "router.setup_attempted") || firstUse ? "setup" : "quiet";
  const signal = mine.some((e) => e.revision > 0);
  const switchedOn = mine.some((e) => e.type === "router.setup_attempted");
  const clearedNow = shared.some((e) => e.type === "incident.cleared" && at(e) <= Math.min(clock, end));
  const headline =
    kind === "promise"
      ? restored && !kept
        ? "The line is back. The promise is still open."
        : kept && confirmed
          ? "Fixed, kept, and confirmed by the customer."
          : kept
            ? "The promise is kept. Waiting for the customer’s word."
            : "A promise is running alongside the fault."
      : kind === "setup"
        ? firstUse
          ? "Connected for the first time. First use is its own proof."
          : clearedNow
            ? "Told to go ahead once the network cleared."
            : person.incident
              ? "Setup paused by a network issue."
              : switchedOn
                ? "Switched on, not connected yet."
                : "Delivered, not connected yet."
        : !signal
          ? "A normal evening so far."
          : restored
            ? "The hub came back on its own. Nothing was sent."
            : "Nothing sent. The quiet was the right answer.";
  const lesson = { promise: "Fixed isn’t the same as kept", setup: "Delivered isn’t the same as connected", quiet: "Quiet isn’t the same as broken" }[kind];
  const status: [string, boolean][] =
    kind === "promise"
      ? [
          [`Line ${restored ? "back" : "not verified"}`, !!restored],
          [`Promise ${kept ? "kept" : "open"}`, !!kept],
          [`Customer ${confirmed ? "confirmed" : "not yet"}`, !!confirmed],
        ]
      : kind === "setup"
        ? [
            [`Hub ${firstUse ? "connected" : switchedOn ? "switched on" : "not switched on"}`, !!firstUse],
            [`Go-ahead ${clearedNow ? "sent" : person.incident ? "on hold" : "not needed yet"}`, clearedNow],
            [`First use ${firstUse ? "observed" : "not yet"}`, !!firstUse],
          ]
        : [
            [`Hub ${!signal ? "normal" : restored ? "back" : "quiet"}`, !signal || !!restored],
            [`Messages sent ${actions.length}`, actions.length === 0],
            ["Nothing owed", true],
          ];

  // Stagger labels above/below so near-simultaneous marks stay readable.
  const placed = [...marks].sort((a, b) => a.lane - b.lane || a.t - b.t).map((m) => ({ ...m, up: true }));
  const flip = new Map<number, boolean>();
  for (const m of placed) {
    m.up = !(flip.get(m.lane) ?? false);
    flip.set(m.lane, m.up);
  }
  const ticks = stops.slice(0, -1);
  const curve = (x1: number, y1: number, x2: number, y2: number) =>
    `M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
  const firstAction = (after: number) => actions.map((a) => Date.parse(a.time)).find((t) => t >= after);
  return (
    <section className="promise-timeline" aria-label="Promise timeline">
      <header>
        <div>
          <span className="eyebrow">{lesson} · {person.name} · Fri 25 Sep 2026, 20:45–21:21 BST</span>
          <h3>{headline}</h3>
        </div>
        <div className="pt-status">
          {status.map(([text, met]) => (
            <span key={text} className={met ? "is-met" : ""}>
              {text}
            </span>
          ))}
        </div>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={headline}>
        {lanes.map((name, i) => (
          <g key={name + i}>
            <rect x={0} y={TOP + i * LANE} width={W} height={LANE} className={i % 2 ? "pt-band is-alt" : "pt-band"} />
            <text x={16} y={y(i) + 4} className={i >= 2 ? "pt-lane is-human" : "pt-lane"}>
              {i >= 2 ? name : name.toUpperCase()}
            </text>
            <line x1={LEFT} x2={W - RIGHT} y1={y(i)} y2={y(i)} className="pt-rail" />
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP} y2={H - 24} className="pt-tick" />
            <text x={x(t)} y={H - 8} className="pt-time" textAnchor="middle">
              {clockTime(new Date(t).toISOString())}
            </text>
          </g>
        ))}
        <line x1={x(clock)} x2={x(clock)} y1={TOP - 8} y2={H - 24} className="pt-now" />
        <text x={x(clock)} y={TOP - 12} className="pt-now-label" textAnchor="middle">
          {clock > end ? "episode end 21:21" : `now ${clockTime(snapshot.clock)}`}
        </text>
        {/* the promise thread: open until the call is made */}
        {promise && (
          <path
            d={`M${x(at(promise))} ${y(2)} L${x(kept ? at(kept) : clock)} ${y(2)}`}
            className={kept ? "pt-thread-promise is-kept" : "pt-thread-promise"}
          />
        )}
        {promise && !kept && (
          <text x={x(clock) - 8} y={y(2) - 12} className="pt-open" textAnchor="end">
            promise held open — survives the incident and the restoration
          </text>
        )}
        {kept && confirmed && <path d={curve(x(at(kept)), y(2), x(at(confirmed)), y(3))} className="pt-thread-promise is-kept" />}
        {/* the recovery thread: network → system → customer */}
        {restored && (() => {
          const tr = at(restored),
            sent = firstAction(tr);
          return (
            <>
              <path d={curve(x(tr), y(0), x(tr) + 6, y(1))} className="pt-thread-restore" />
              {sent !== undefined && <path d={curve(x(tr) + 6, y(1), x(sent + 60e3), y(3))} className="pt-thread-restore" />}
              {confirmed && sent !== undefined && <path d={curve(x(sent + 60e3), y(3), x(at(confirmed)), y(3))} className="pt-thread-restore" />}
            </>
          );
        })()}
        {/* every message: system → customer */}
        {actions.map((a) => (
          <path key={a.id} d={curve(x(Date.parse(a.time)), y(1), x(Date.parse(a.time) + 60e3), y(3))} className="pt-thread-message" />
        ))}
        {quiet && (
          <text x={x(clock) - 8} y={y(3) + 4} className="pt-quiet" textAnchor="end">
            no message sent — by design
          </text>
        )}
        {placed.map((m, i) => {
          const cx = x(m.t),
            cy = y(m.lane),
            ty = m.up ? (m.sub ? cy - 28 : cy - 16) : cy + 25;
          return (
            <g key={i} className={`pt-mark tone-${m.tone}${m.event && onInspect ? " is-link" : ""}`} onClick={m.event && onInspect ? () => onInspect(m.event!) : undefined}>
              {m.shape === "star" ? (
                <>
                  <circle cx={cx} cy={cy} r={12} />
                  <text x={cx} y={cy + 4} textAnchor="middle" className="pt-star">✓</text>
                </>
              ) : (
                <circle cx={cx} cy={cy} r={m.shape === "hollow" ? 6 : 7} className={m.shape === "hollow" ? "is-hollow" : ""} />
              )}
              <text x={cx} y={ty} textAnchor="middle" className="pt-label">
                {m.label}
              </text>
              {m.sub && (
                <text x={cx} y={ty + 13} textAnchor="middle" className="pt-sub">
                  {m.sub}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
