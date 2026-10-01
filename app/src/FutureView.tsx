import { useEffect, useState } from "react";
import "./future.css";

// 2030, played as its own scenario: new signals arrive for the Morgan household over a month,
// BT's architecture weighs them, and BT's agent starts one conversation with the household's own
// agent. Illustrative: no live product, price or mandate integration sits behind it.
type Signal = { type: string; source: string; detail: string };
type Check = { check: string; result: "pass" | "hold" | "note" };
type Proposal = { title: string; state: "eligible" | "held" | "accepted" | "declined" | "proven"; why: string };
type Line = { from: "bt" | "agent" | "sam"; via: string; text: string };
type Beat = {
  at: string;
  title: string;
  lead: string;
  signals: Signal[];
  memory: string[];
  ops: string[];
  proposals: Proposal[];
  decision: string;
  governance: Check[];
  lines: Line[];
  outcomes?: { what: string; state: "tracking" | "proven" }[];
};

const BEATS: Beat[] = [
  {
    at: "Mon 1 Apr 2030 · 18:12",
    title: "Two new devices join the network",
    lead: "The hub sees two devices it hasn’t met before. One reason to talk to the Morgans, but not yet a good enough one.",
    signals: [
      { type: "device.joined", source: "hub_telemetry", detail: "laptop · named “Ava’s laptop” at setup" },
      { type: "device.joined", source: "hub_telemetry", detail: "vr_headset · household" },
    ],
    memory: ["Household: Sam, Priya, Leo (20) and Ava (16)", "No device cover on the account", "Opted in to offers since 18 Sept 2026"],
    ops: ["14 devices on the network, up from 12", "New devices worth about £1,300 at list price"],
    proposals: [{ title: "Device cover", state: "eligible", why: "New devices, nothing covering them" }],
    decision: "Hold for now. One offer on its own isn’t worth an interruption; look again if more evidence arrives this month.",
    governance: [
      { check: "Commercial consent on record (opted in 2026)", result: "pass" },
      { check: "Contact now? Not yet: avoid offer fatigue", result: "note" },
    ],
    lines: [],
  },
  {
    at: "Sun 14 Apr 2030 · 21:40",
    title: "Evenings are getting crowded",
    lead: "Evening use has climbed for two months and the line is hitting its plan limit most nights. The network is fine; the plan is the bottleneck.",
    signals: [
      { type: "usage.trend", source: "network_analytics", detail: "evening peak +41% over 60 days" },
      { type: "line.utilisation", source: "network_analytics", detail: "≥90% of plan, 20:00–22:00, 11 of 14 nights" },
      { type: "qos.contention", source: "hub_telemetry", detail: "23 video stalls this week" },
    ],
    memory: ["Out of contract since Sept 2028 · £79 a month", "Usage note: family evenings, several screens at once"],
    ops: ["Line supports 1.6 Gb; the plan is 500 Mb", "Congestion is at the plan limit, not in the network"],
    proposals: [
      { title: "Device cover", state: "eligible", why: "New devices, nothing covering them" },
      { title: "Faster plan on renewal", state: "eligible", why: "1.6 Gb for the same £79 on a 12-month renewal" },
    ],
    decision: "Still hold. Two reasons now; check whether anything else matters to this household this month.",
    governance: [{ check: "Price and terms from the approved catalogue", result: "pass" }],
    lines: [],
  },
  {
    at: "Mon 22 Apr 2030 · 09:00",
    title: "Exam season",
    lead: "Sam told Eve in March that Ava’s GCSEs start on 11 May. Homework hours are when the house is busiest online.",
    signals: [
      { type: "memory.recalled", source: "eve_conversation", detail: "12 Mar: “Ava’s GCSEs start 11 May”" },
      { type: "calendar.public", source: "exam_board_calendar", detail: "GCSE window 11 May – 19 Jun" },
      { type: "usage.window", source: "hub_telemetry", detail: "weekdays 16:00–19:00: 3 game + 2 video streams" },
    ],
    memory: ["Sam told us about Ava’s exams on 12 Mar", "Ava is 16: a minor in the household"],
    ops: ["Homework hours collide with gaming and streaming", "Priority for one device is possible remotely, for free"],
    proposals: [
      { title: "Study boost for Ava’s laptop", state: "eligible", why: "Free: priority on weekdays 16:00–19:00 until 19 Jun" },
      { title: "Device cover", state: "eligible", why: "New devices, nothing covering them" },
      { title: "Faster plan on renewal", state: "eligible", why: "Same price, three times the speed" },
    ],
    decision: "Three reasons, one conversation. Lead with the free help; the offers come second.",
    governance: [
      { check: "Uses only what Sam told us", result: "pass" },
      { check: "Never Ava’s browsing or content", result: "pass" },
      { check: "Nothing addressed to Ava, a minor", result: "pass" },
    ],
    lines: [],
  },
  {
    at: "Mon 22 Apr 2030 · 09:05",
    title: "BT’s agent starts the conversation",
    lead: "The Morgans use a household agent. BT verifies its mandate, then opens with one message instead of three.",
    signals: [{ type: "agent.mandate_verified", source: "agent_registry", detail: "Sam’s household agent · household services · up to £15/mo" }],
    memory: [],
    ops: [],
    proposals: [
      { title: "Study boost for Ava’s laptop", state: "eligible", why: "Within the mandate: free service" },
      { title: "Device cover", state: "held", why: "£9/mo is within the limit, but a new product needs Sam’s yes" },
      { title: "Faster plan on renewal", state: "held", why: "A contract change needs Sam’s yes" },
    ],
    decision: "Send one message, most useful first, terms attached. Nothing changes without a yes.",
    governance: [
      { check: "Mandate signed by the account holder", result: "pass" },
      { check: "Agent may hear proposals", result: "pass" },
      { check: "Spend limit up to £15 a month", result: "pass" },
      { check: "New products need Sam’s own approval", result: "hold" },
    ],
    lines: [
      {
        from: "bt",
        via: "Agent channel",
        text:
          "Hi, it’s BT. Good luck to Ava with her exams next month! If it helps, we can give her laptop the best connection after school while she revises. It’s free and switches off when exams finish. We also have a couple of optional extras if you’re interested: cover for your new gadgets, and a faster plan for the same price. No rush either way.",
      },
    ],
  },
  {
    at: "Mon 22 Apr 2030 · 12:30",
    title: "Sam decides, by voice",
    lead: "The household agent accepts what its mandate allows and asks Sam about the rest.",
    signals: [{ type: "agent.reply", source: "agent_channel", detail: "study boost accepted · 2 items referred to Sam" }],
    memory: [],
    ops: [],
    proposals: [
      { title: "Study boost for Ava’s laptop", state: "accepted", why: "Accepted by the agent within its mandate" },
      { title: "Device cover", state: "accepted", why: "Sam said yes" },
      { title: "Faster plan on renewal", state: "declined", why: "Sam: “leave it until the summer”" },
    ],
    decision: "Act on exactly what was agreed.",
    governance: [{ check: "The customer’s own approval for a new product", result: "pass" }],
    lines: [
      { from: "agent", via: "Agent channel", text: "Thanks! The study boost sounds great, please go ahead. I’ll check with Sam about the extras." },
      { from: "agent", via: "To Sam, by voice", text: "BT offered to boost Ava’s laptop after school while she revises, for free, so I said yes. They also mentioned gadget cover for £9 a month and a faster plan for the same price. Interested in either?" },
      { from: "sam", via: "Voice", text: "Cover’s a good idea. Let’s leave the plan for now." },
    ],
  },
  {
    at: "Mon 22 Apr 2030 · 12:31",
    title: "BT does exactly what was agreed",
    lead: "Two things switched on, one respected no, and every expectation written down so it can be checked.",
    signals: [
      { type: "action.committed", source: "bt_orchestrator", detail: "study_profile · weekdays 16:00–19:00 · ends 19 Jun" },
      { type: "action.committed", source: "bt_orchestrator", detail: "device_cover · £9/mo · from 22 Apr" },
      { type: "offer.declined", source: "bt_orchestrator", detail: "faster_plan · suppressed until 21 Jul" },
    ],
    memory: ["Plan declined 22 Apr: don’t raise again before 21 Jul", "Device cover active from 22 Apr"],
    ops: ["Study profile scheduled on the hub", "Cover confirmation sent to the BT app"],
    proposals: [
      { title: "Study boost for Ava’s laptop", state: "accepted", why: "Starts tomorrow 16:00" },
      { title: "Device cover", state: "accepted", why: "Active today" },
      { title: "Faster plan on renewal", state: "declined", why: "Not raised again for 90 days" },
    ],
    decision: "Commit, confirm and track.",
    governance: [
      { check: "Decision, mandate and consent recorded together", result: "pass" },
      { check: "A declined offer is not repeated", result: "pass" },
    ],
    lines: [
      { from: "bt", via: "Agent channel", text: "All set. Ava’s study boost starts tomorrow after school and stops when exams finish on 19 June. Gadget cover starts today at £9 a month, and the details are in the BT app. We’ll leave the plan for now." },
    ],
    outcomes: [
      { what: "Study profile in use on most weekdays · check 3 May", state: "tracking" },
      { what: "Homework-hour stalls under 5 a week · check 3 May", state: "tracking" },
      { what: "Profile switched off on 19 Jun", state: "tracking" },
    ],
  },
  {
    at: "Fri 3 May 2030 · 09:00",
    title: "Did it work?",
    lead: "The outcomes are checked against the record, and what was learned goes back into policy.",
    signals: [
      { type: "outcome.checked", source: "outcome_monitor", detail: "study profile active 9 of 9 weekdays" },
      { type: "qos.contention", source: "hub_telemetry", detail: "homework-hour stalls: 2 this week, down from 23" },
    ],
    memory: ["Free help first, offers second: accepted 2 of 3"],
    ops: ["Homework hours are calm; evenings still hit the plan limit"],
    proposals: [
      { title: "Study boost for Ava’s laptop", state: "proven", why: "Used every weekday; stalls down 91%" },
      { title: "Device cover", state: "proven", why: "Active and confirmed" },
      { title: "Faster plan on renewal", state: "declined", why: "Eligible again from 21 Jul" },
    ],
    decision: "Record the result for the governed learning loop; wake again on 21 Jul.",
    governance: [{ check: "Any policy change is signed off by a named role", result: "note" }],
    lines: [{ from: "bt", via: "Agent channel", text: "Quick update: Ava’s study boost has been on every weekday and homework time has been much smoother. It switches off on 19 June. Good luck to her!" }],
    outcomes: [
      { what: "Study profile in use on most weekdays", state: "proven" },
      { what: "Homework-hour stalls under 5 a week", state: "proven" },
      { what: "Profile switched off on 19 Jun", state: "tracking" },
    ],
  },
];

const WHO = { bt: "BT’s agent", agent: "Sam’s household agent", sam: "Sam" } as const;

export function FutureView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const beat = BEATS[step];
  useEffect(() => {
    if (!playing) return;
    if (step === BEATS.length - 1) return setPlaying(false);
    const t = setTimeout(() => setStep((s) => s + 1), 6500);
    return () => clearTimeout(t);
  }, [playing, step]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.stopPropagation(); setStep((s) => Math.min(BEATS.length - 1, s + 1)); }
      if (e.key === "ArrowLeft") { e.stopPropagation(); setStep((s) => Math.max(0, s - 1)); }
      if (e.key === "Escape") onBack();
    };
    addEventListener("keydown", key, true);
    return () => removeEventListener("keydown", key, true);
  }, [onBack]);
  const feed = BEATS.slice(0, step + 1).flatMap((b, i) => b.signals.map((s) => ({ ...s, at: b.at, now: i === step })));
  const thread = BEATS.slice(0, step + 1).flatMap((b, i) => b.lines.map((l) => ({ ...l, now: i === step })));
  const outcomes = [...BEATS.slice(0, step + 1)].reverse().find((b) => b.outcomes)?.outcomes ?? [];
  const memory = BEATS.slice(0, step + 1).flatMap((b, i) => b.memory.map((m) => ({ m, now: i === step })));
  const ops = beat.ops.length ? beat.ops : (BEATS.slice(0, step).reverse().find((b) => b.ops.length)?.ops ?? []);
  return (
    <div className="fx" role="dialog" aria-label="2030 scenario">
      <header className="fx-bar">
        <div className="fx-brand">
          <span className="fx-badge">2030</span>
          <div>
            <strong>The Morgans, four years on</strong>
            <small>BT’s agent starts the conversation · illustrative, not a live integration</small>
          </div>
        </div>
        <ol className="fx-clock" aria-label="Scenario steps">
          {BEATS.map((b, i) => (
            <li key={b.at} className={i === step ? "is-now" : i < step ? "is-past" : ""}>
              <button onClick={() => { setPlaying(false); setStep(i); }} title={b.title}>
                <i />
                <time>{b.at.replace(/^\w+ /, "").replace(/ 2030/, "")}</time>
              </button>
            </li>
          ))}
        </ol>
        <div className="fx-controls">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} aria-label="Previous">←</button>
          <button className="is-play" onClick={() => (step === BEATS.length - 1 ? (setStep(0), setPlaying(true)) : setPlaying(!playing))}>
            {playing ? "❚❚ Pause" : step === BEATS.length - 1 ? "↺ Replay" : "▶ Play"}
          </button>
          <button onClick={() => setStep(Math.min(BEATS.length - 1, step + 1))} disabled={step === BEATS.length - 1} aria-label="Next">→</button>
          <button className="fx-exit" onClick={onBack}>Back to 2026 ✕</button>
        </div>
      </header>
      <section className="fx-moment" key={step}>
        <span>{beat.at}</span>
        <h2>{beat.title}</h2>
        <p>{beat.lead}</p>
      </section>
      <div className="fx-stage">
        <aside className="fx-feed" aria-label="Signals">
          <b className="fx-label">Signals · {feed.length}</b>
          <ol>
            {[...feed].reverse().map((s, i) => (
              <li key={`${s.at}${s.type}${s.detail}`} className={s.now ? "is-new" : ""} style={{ animationDelay: `${(feed.length - 1 - i) * 0}ms` }}>
                <code>{s.type}</code>
                <span>{s.detail}</span>
                <small>{s.source} · {s.at.replace(/^\w+ /, "").replace(/ 2030/, "")}</small>
              </li>
            ))}
          </ol>
        </aside>
        <div className="fx-arch" key={`a${step}`}>
          <article className="fx-card">
            <b className="fx-label">Customer memory</b>
            <ul>{memory.slice(-5).map((x, i) => <li key={i} className={x.now ? "is-new" : ""}>{x.m}</li>)}</ul>
          </article>
          <article className="fx-card">
            <b className="fx-label">Operational memory</b>
            <ul>{ops.map((x) => <li key={x} className={beat.ops.length ? "is-new" : ""}>{x}</li>)}</ul>
          </article>
          <article className="fx-card fx-arbiter">
            <b className="fx-label">Arbiter · proposals</b>
            <ul className="fx-props">
              {beat.proposals.map((p) => (
                <li key={p.title} className={`is-${p.state}`}>
                  <strong>{p.title}</strong>
                  <em>{p.state}</em>
                  <small>{p.why}</small>
                </li>
              ))}
            </ul>
            <p className="fx-decision">{beat.decision}</p>
          </article>
          <article className="fx-card">
            <b className="fx-label">Governance</b>
            <ul className="fx-checks">
              {beat.governance.map((g) => (
                <li key={g.check} className={`is-${g.result}`}>
                  <i>{g.result === "pass" ? "✓" : g.result === "hold" ? "!" : "·"}</i>
                  {g.check}
                </li>
              ))}
            </ul>
          </article>
          <article className="fx-card fx-outcomes">
            <b className="fx-label">Tracking</b>
            {outcomes.length ? (
              <ul>{outcomes.map((o) => <li key={o.what} className={`is-${o.state}`}><em>{o.state}</em>{o.what}</li>)}</ul>
            ) : (
              <p className="fx-quiet">Nothing committed yet, so nothing to track.</p>
            )}
          </article>
        </div>
        <aside className="fx-thread" aria-label="Conversation">
          <b className="fx-label">Conversation</b>
          {thread.length === 0 ? (
            <p className="fx-quiet">No one has been contacted. BT is still gathering reasons.</p>
          ) : (
            thread.map((l, i) => (
              <div key={i} className={`fx-msg is-${l.from}${l.now ? " is-new" : ""}`}>
                <small>{WHO[l.from]} · {l.via}</small>
                <p>{l.text}</p>
              </div>
            ))
          )}
        </aside>
      </div>
    </div>
  );
}
