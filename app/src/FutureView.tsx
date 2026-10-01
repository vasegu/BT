import { useEffect, useRef, useState } from "react";
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
      { check: "Device cover is insurance: product information sent with the offer", result: "pass" },
      { check: "BT’s agent says it is an automated agent", result: "pass" },
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


/** What each signal would come from today. */
const BASIS: Record<string, string> = {
  "device.joined": "Hub device inventory · Broadband Forum TR-369 (USP) / TR-181",
  "usage.trend": "Aggregated line statistics · volumes only, no content",
  "line.utilisation": "Aggregated line statistics · volumes only, no content",
  "qos.contention": "Hub Wi-Fi counters · TR-181 data model",
  "memory.recalled": "Customer-stated, in a recorded Eve conversation",
  "calendar.public": "JCQ’s published GCSE timetable · dates illustrative",
  "usage.window": "Hub statistics by device · TR-369",
  "agent.mandate_verified": "A2A agent card + signed intent mandate (AP2-style)",
  "agent.reply": "A2A task message",
  "action.committed": "Hub priority rule via TR-369 · cover issued by the insurer",
  "offer.declined": "Contact-suppression record",
  "outcome.checked": "Outcome contract check against hub statistics",
};
/** The rule behind each governance check. */
const REF: Record<string, string> = {
  "Commercial consent on record (opted in 2026)": "UK GDPR · PECR reg. 22 (electronic marketing)",
  "Contact now? Not yet: avoid offer fatigue": "BT contact policy (illustrative)",
  "Price and terms from the approved catalogue": "Ofcom General Conditions · C1 contract information",
  "Out of contract: a better-value plan is something BT should tell them about": "Ofcom end-of-contract and annual best-tariff notices",
  "Uses only what Sam told us": "UK GDPR Art. 5(1)(b) purpose limitation",
  "Never Ava’s browsing or content": "ICO Age Appropriate Design Code · profiling off by default",
  "Nothing addressed to Ava, a minor": "ICO Age Appropriate Design Code",
  "Mandate signed by the account holder": "AP2 intent mandate · W3C Verifiable Credential",
  "Agent may hear proposals": "Scope written into the intent mandate",
  "Spend limit up to £15 a month": "Constraint written into the intent mandate",
  "New products need Sam’s own approval": "AP2 human-present cart mandate",
  "Device cover is insurance: product information sent with the offer": "FCA ICOBS · IPID · Consumer Duty fair value",
  "BT’s agent says it is an automated agent": "Transparency: users are told they are dealing with AI",
  "The customer’s own approval for a new product": "AP2 cart mandate, signed by Sam",
  "Decision, mandate and consent recorded together": "Audit trail · UK GDPR accountability",
  "A declined offer is not repeated": "Consumer Duty · avoiding unwanted contact",
  "Any policy change is signed off by a named role": "Governance: named accountable owner",
};
const REAL: [string, string][] = [
  ["TR-369 (USP) and TR-181", "Broadband Forum standards for managing home hubs remotely, including the list of connected devices and line statistics."],
  ["A2A (Agent2Agent)", "Open protocol for agents to find and talk to each other. Announced by Google in April 2025, a Linux Foundation project since June 2025."],
  ["AP2 (Agent Payments Protocol)", "Google, September 2025. Signed ‘mandates’: an intent mandate sets an agent’s limits; a cart mandate records exactly what the person approved."],
  ["Ofcom General Conditions", "Providers must tell customers when their contract ends and remind them of their best available deals each year."],
  ["ICO Age Appropriate Design Code", "High privacy by default for under-18s, with profiling switched off."],
  ["FCA insurance rules and Consumer Duty", "Device cover is insurance: it needs a product information document (IPID) and must offer fair value."],
  ["JCQ", "Publishes the GCSE exam timetable each year."],
];
const ASSUMED = [
  "Households commonly run their own agent, with a mandate they have signed.",
  "BT runs an A2A-compatible service agent alongside Eve.",
  "Prices, dates and results here are illustrative.",
];

const WHO = { bt: "BT’s agent", agent: "Sam’s household agent", sam: "Sam" } as const;

/* ---------- The household picture ---------- */

type Kind = "phone" | "laptop" | "tv" | "console" | "speaker" | "tablet" | "camera" | "headset";
const ICON: Record<Kind, string> = {
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2",
  laptop: "M5 6h14v9H5zM3 18h18",
  tv: "M3 5h18v11H3zM9 20h6",
  console: "M6 9h12a3 3 0 0 1 3 3v2a3 3 0 0 1-5 2l-1-1H9l-1 1a3 3 0 0 1-5-2v-2a3 3 0 0 1 3-3zM8 11v3M6.5 12.5h3",
  speaker: "M8 3h8v18H8zM12 14a2 2 0 1 0 0-.01M12 7h.01",
  tablet: "M6 3h12v18H6zM11 18h2",
  camera: "M12 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 18v3",
  headset: "M3 10h18v6a2 2 0 0 1-2 2h-4l-3-2-3 2H5a2 2 0 0 1-2-2zM7 13h.01M17 13h.01",
};
const PEOPLE = [
  { name: "Sam", role: "Account holder" },
  { name: "Priya", role: "Partner" },
  { name: "Leo", role: "20" },
  { name: "Ava", role: "16 · GCSEs" },
];
const DEVICES: { kind: Kind; owner: string; isNew?: boolean }[] = [
  { kind: "phone", owner: "Sam" }, { kind: "phone", owner: "Priya" }, { kind: "phone", owner: "Leo" }, { kind: "phone", owner: "Ava" },
  { kind: "laptop", owner: "Priya" }, { kind: "laptop", owner: "Leo" }, { kind: "tv", owner: "Living room" }, { kind: "tv", owner: "Bedroom" },
  { kind: "console", owner: "Leo" }, { kind: "speaker", owner: "Kitchen" }, { kind: "tablet", owner: "Home" }, { kind: "camera", owner: "Doorbell" },
  { kind: "laptop", owner: "Ava", isNew: true }, { kind: "headset", owner: "Home", isNew: true },
];
const Icon = ({ kind }: { kind: Kind }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICON[kind]} />
  </svg>
);

/** Weekday evening demand, Mb/s, from 16:00 to 23:00, against a 500 Mb plan. */
const HOURS = [16, 17, 18, 19, 20, 21, 22, 23];
const DEMAND = {
  normal: [170, 240, 280, 320, 430, 460, 470, 330],
  crowded: [230, 330, 390, 430, 560, 610, 600, 440],
};
const AVA = [70, 70, 70];
const PLAN = 500;

function UsageChart({ step }: { step: number }) {
  const data = step === 0 ? DEMAND.normal : DEMAND.crowded;
  const homework = step >= 2;
  const boost = step >= 5;
  const W = 420, H = 210, B = 20, T = 10, max = 700;
  const bw = W / HOURS.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fx-chart" role="img" aria-label="Evening demand against the plan limit">
      {homework && <rect x={0} y={T} width={bw * 3} height={H - T - B} className="fx-band" />}
      {homework && <text x={4} y={T + 9} className="fx-band-label">homework hours</text>}
      {data.map((v, i) => {
        const over = v > PLAN && !(step >= 6 && i < 3);
        const h = (H - T - B) * (Math.min(v, max) / max);
        return (
          <g key={i}>
            <rect x={i * bw + 6} y={y(v)} width={bw - 12} height={h} rx={2} className={over ? "fx-bar-over" : "fx-bar"} />
            {boost && i < 3 && (
              <rect x={i * bw + 6} y={y(AVA[i])} width={bw - 12} height={(H - T - B) * (AVA[i] / max)} rx={2} className={step >= 6 ? "fx-bar-ava" : "fx-bar-ava is-planned"} />
            )}
            <text x={i * bw + bw / 2} y={H - 5} className="fx-axis">{HOURS[i]}</text>
          </g>
        );
      })}
      <line x1={0} x2={W} y1={y(PLAN)} y2={y(PLAN)} className="fx-limit" />
      <text x={W - 2} y={y(PLAN) - 4} className="fx-limit-label">plan limit 500 Mb</text>
    </svg>
  );
}

/** April to June, with the exam window and today. */
function Calendar({ step }: { step: number }) {
  const start = Date.UTC(2030, 3, 1), end = Date.UTC(2030, 6, 1);
  const pos = (d: number) => `${((d - start) / (end - start)) * 100}%`;
  const today = [Date.UTC(2030, 3, 1), Date.UTC(2030, 3, 14), Date.UTC(2030, 3, 22), Date.UTC(2030, 3, 22), Date.UTC(2030, 3, 22), Date.UTC(2030, 3, 22), Date.UTC(2030, 4, 3)][step];
  const examFrom = Date.UTC(2030, 4, 11), examTo = Date.UTC(2030, 5, 19), boostFrom = Date.UTC(2030, 3, 23);
  return (
    <div className="fx-cal">
      <div className="fx-cal-track">
        {step >= 2 && <span className="fx-cal-exam" style={{ left: pos(examFrom), width: `calc(${pos(examTo)} - ${pos(examFrom)})` }}>GCSEs</span>}
        {step >= 5 && <span className="fx-cal-boost" style={{ left: pos(boostFrom), width: `calc(${pos(examTo)} - ${pos(boostFrom)})` }}>study boost</span>}
        <i className="fx-cal-today" style={{ left: pos(today) }} />
      </div>
      <div className="fx-cal-months"><span>Apr</span><span>May</span><span>Jun</span></div>
    </div>
  );
}

/** Help or offers: BT only gets in touch when it has something useful to say. */
function ReasonGauge({ step }: { step: number }) {
  const slots = [
    { label: "Device cover", kind: "offer", from: 0 },
    { label: "Faster plan", kind: "offer", from: 1 },
    { label: "Study boost", kind: "help", from: 2 },
  ];
  const help = step >= 2;
  return (
    <div className="fx-gauge">
      <div className="fx-gauge-slots">
        {slots.map((s) => (
          <span key={s.label} className={`is-${s.kind}${step >= s.from ? " is-on" : ""}`}>
            <small>{s.kind}</small>
            {s.label}
          </span>
        ))}
      </div>
      <p className={help ? "is-go" : ""}>{help ? "Something genuinely useful to offer: get in touch, help first." : "Offers only: not a reason to interrupt. Wait."}</p>
    </div>
  );
}

/* ---------- The scenario ---------- */

export function FutureView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [real, setReal] = useState(false);
  const threadRef = useRef<HTMLElement>(null);
  const beat = BEATS[step];
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [step]);
  useEffect(() => {
    if (!playing) return;
    if (step === BEATS.length - 1) return setPlaying(false);
    const t = setTimeout(() => setStep((s) => s + 1), 7000);
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
  const thread = BEATS.slice(0, step + 1).flatMap((b, i) => b.lines.map((l) => ({ ...l, at: b.at, now: i === step })));
  const outcomes = [...BEATS.slice(0, step + 1)].reverse().find((b) => b.outcomes)?.outcomes ?? [];
  const memory = beat.memory.length ? beat.memory : (BEATS.slice(0, step).reverse().find((b) => b.memory.length)?.memory ?? []);
  const ops = beat.ops.length ? beat.ops : (BEATS.slice(0, step).reverse().find((b) => b.ops.length)?.ops ?? []);
  const stalls = step >= 6 ? 2 : step >= 1 ? 23 : 6;
  return (
    <div className="fx" role="dialog" aria-label="2030 scenario">
      <header className="fx-bar">
        <div className="fx-brand">
          <span className="fx-badge">2030</span>
          <div>
            <strong>The Morgans, four years on</strong>
            <small>Built on today’s standards · illustrative</small>
          </div>
        </div>
        <ol className="fx-clock" aria-label="Scenario steps">
          {BEATS.map((b, i) => (
            <li key={b.at} className={i === step ? "is-now" : i < step ? "is-past" : ""}>
              <button onClick={() => { setPlaying(false); setStep(i); }} title={b.title}>
                <i />
                <time>
                  {b.at.replace(/^\w+ /, "").replace(/ 2030.*$/, "")}
                  <small>{b.at.split(" · ")[1]}</small>
                </time>
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
          <button className={real ? "is-on" : ""} onClick={() => setReal(!real)}>What’s real</button>
          <button className="fx-exit" onClick={onBack}>Back to 2026 ✕</button>
        </div>
      </header>

      <section className="fx-moment">
        <span>Step {step + 1} of {BEATS.length} · {beat.at}</span>
        <h2>{beat.title}</h2>
        <p>{beat.lead}</p>
      </section>

      <div className="fx-top">
        <section className="fx-home" aria-label="The Morgan household">
          <div className="fx-home-col is-left">
            <b className="fx-label">The household</b>
            <ul className="fx-people">
              {PEOPLE.map((p) => (
                <li key={p.name} className={p.name === "Ava" && step >= 2 ? "is-lit" : ""}>
                  <strong>{p.name}</strong>
                  <small>{p.role}</small>
                </li>
              ))}
            </ul>
            <b className="fx-label">On the network · 14 devices · 2 new this month</b>
            <ul className="fx-devices">
              {DEVICES.map((d, i) => (
                <li key={i} className={d.isNew ? (step === 0 ? "is-new is-flash" : "is-new") : ""} title={`${d.kind} · ${d.owner}`}>
                  <Icon kind={d.kind} />
                  <small>{d.owner}</small>
                </li>
              ))}
            </ul>
            <div className="fx-sees">
              <div>
                <b className="fx-label">BT can see</b>
                <ul>
                  <li>Device types and when they joined</li>
                  <li>How much the line carries, hour by hour</li>
                  <li>What Sam has told us</li>
                </ul>
              </div>
              <div>
                <b className="fx-label">BT can’t see</b>
                <ul className="is-no">
                  <li>What anyone browses or watches</li>
                  <li>Messages, searches or content</li>
                  <li>Anything about Ava beyond what Sam said</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="fx-home-col is-chart">
            <b className="fx-label">Weekday evenings · demand vs plan</b>
            <UsageChart step={step} />
            <p className="fx-chart-note">
              Video stalls this week <strong className={stalls > 5 ? "is-bad" : "is-good"}>{stalls}</strong>
              {step >= 5 && <> · Ava’s laptop <span className="fx-key-ava" /> prioritised after school</>}
            </p>
            <b className="fx-label">April – June</b>
            <Calendar step={step} />
          </div>
        </section>

        <section className="fx-thread" aria-label="Conversation" ref={threadRef}>
          <b className="fx-label">Conversation · A2A agent channel</b>
          {thread.length === 0 ? (
            <div className="fx-silence">
              <strong>No one has been contacted.</strong>
              <span>BT is noticing, not selling. It waits until it has something worth saying.</span>
            </div>
          ) : (
            thread.map((l, i) => (
              <div key={i} className={`fx-msg is-${l.from}${l.now ? " is-new" : ""}`}>
                <small>{WHO[l.from]} · {l.via}</small>
                <p>{l.text}</p>
              </div>
            ))
          )}
        </section>
      </div>

      <section className="fx-chain" aria-label="From signal to tracking">
        <article>
          <b className="fx-label">01 · Signals</b>
          <ul className="fx-sig">
            {beat.signals.map((s) => (
              <li key={s.type + s.detail} title={BASIS[s.type]}>
                <code>{s.type}</code>
                <span>{s.detail}</span>
                <small>{BASIS[s.type] ?? s.source}</small>
              </li>
            ))}
          </ul>
        </article>
        <article>
          <b className="fx-label">02 · Memory & operations</b>
          <ul className="fx-notes">
            {[...memory.slice(0, 2), ...ops.slice(0, 2)].map((m) => <li key={m}>{m}</li>)}
          </ul>
        </article>
        <article className="fx-arb">
          <b className="fx-label">03 · Arbiter</b>
          <ReasonGauge step={step} />
          <ul className="fx-props">
            {beat.proposals.map((p) => (
              <li key={p.title} className={`is-${p.state}`}>
                <em>{p.state}</em>
                <strong>{p.title}</strong>
              </li>
            ))}
          </ul>
          <p className="fx-decision">{beat.decision}</p>
        </article>
        <article>
          <b className="fx-label">04 · Governance</b>
          <ul className="fx-checks">
            {beat.governance.slice(0, 4).map((g) => (
              <li key={g.check} className={`is-${g.result}`}>
                <i>{g.result === "pass" ? "✓" : g.result === "hold" ? "!" : "·"}</i>
                <span>{g.check}</span>
                {REF[g.check] && <small>{REF[g.check]}</small>}
              </li>
            ))}
            {beat.governance.length > 4 && <li className="fx-more">+{beat.governance.length - 4} more checks</li>}
          </ul>
        </article>
        <article>
          <b className="fx-label">05 · Tracking</b>
          {outcomes.length ? (
            <ul className="fx-outs">{outcomes.map((o) => <li key={o.what} className={`is-${o.state}`}><em>{o.state}</em>{o.what}</li>)}</ul>
          ) : (
            <p className="fx-quiet">Nothing committed, so nothing to track yet.</p>
          )}
        </article>
      </section>

      {real && (
        <aside className="fx-real" aria-label="What this is built on">
          <header>
            <b className="fx-label">What’s real today</b>
            <button onClick={() => setReal(false)} aria-label="Close">✕</button>
          </header>
          <dl>
            {REAL.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <b className="fx-label">Assumed for 2030</b>
          <ul>{ASSUMED.map((a) => <li key={a}>{a}</li>)}</ul>
        </aside>
      )}
    </div>
  );
}
