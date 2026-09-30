import { useState } from "react";
import "./future.css";

// A future vision, kept apart from the realistic story: in 2030 a customer's own AI agent deals
// with BT's agent. The architecture is the same; what changes is who is on the other side.
type Line = { from: "maya-agent" | "bt-agent" | "maya"; text: string; via: string };
type Beat = {
  title: string;
  lines: Line[];
  memory: string[];
  governance: { check: string; result: "pass" | "hold" | "note" }[];
  action: string;
};

const BEATS: Beat[] = [
  {
    title: "Maya’s agent asks, on Maya’s behalf",
    lines: [
      {
        from: "maya-agent",
        via: "Agent channel",
        text: "Hello, I act for Maya Patel under a household-services mandate. Two new devices joined the home network this week. What cover do you offer for devices, and is there a better broadband price now the contract has ended?",
      },
    ],
    memory: [
      "New on the network: Alex’s laptop (30 Oct) and a games console (2 Nov)",
      "Out of contract since May · £61 a month",
      "No marketing opt-in: BT does not start sales conversations with Maya",
    ],
    governance: [
      { check: "Who started this?", result: "note" },
      { check: "The customer’s own agent asked, so this is service, not unsolicited marketing", result: "pass" },
    ],
    action: "Verify the agent before answering anything.",
  },
  {
    title: "BT checks what the agent may agree to",
    lines: [
      {
        from: "bt-agent",
        via: "Agent channel",
        text: "Thanks. Before I answer, I’ve verified your mandate: household services for this account, spending up to £15 a month more, and any new product needs Maya’s own approval. I’ll quote within that.",
      },
    ],
    memory: ["Account holder: Maya Patel · Alex is a household member, not on the account"],
    governance: [
      { check: "Mandate signed by the account holder", result: "pass" },
      { check: "Scope: household services on this account", result: "pass" },
      { check: "Spend limit: up to £15 a month more", result: "pass" },
      { check: "New products need the customer’s own yes", result: "hold" },
    ],
    action: "Answer within the mandate; nothing binding yet.",
  },
  {
    title: "Memory shapes the answer",
    lines: [
      {
        from: "bt-agent",
        via: "Agent channel",
        text: "Two options. Device cover for the new laptop and console, plus the phones and tablet already at home: £9 a month, no excess on accidental damage. And if Maya renews broadband for 12 months, the price drops from £61 to £55.",
      },
    ],
    memory: [
      "Devices the hub can see, and roughly what they’re worth",
      "Current price and contract status",
      "The line was fixed overnight on 26 Sept, and Maya was told the next morning",
    ],
    governance: [
      { check: "Offer uses service data only for this account", result: "pass" },
      { check: "Price and terms are from the approved catalogue", result: "pass" },
    ],
    action: "Send two options, clearly separate, with no pressure to take both.",
  },
  {
    title: "Maya decides, by voice",
    lines: [
      {
        from: "maya-agent",
        via: "Voice, to Maya",
        text: "BT can cover Alex’s new laptop and the console for £9 a month, and cut your broadband by £6 if you renew for a year. Shall I say yes?",
      },
      { from: "maya", via: "Voice", text: "Yes to the cover. Not the contract, not yet." },
    ],
    memory: [],
    governance: [{ check: "The customer’s own approval for a new product", result: "pass" }],
    action: "Only the part Maya approved goes ahead.",
  },
  {
    title: "BT does exactly what was agreed",
    lines: [
      {
        from: "bt-agent",
        via: "Agent channel",
        text: "Done: device cover starts today at £9 a month; confirmation sent to Maya in the app. The renewal offer is noted as declined; we won’t raise it again for 90 days unless you ask.",
      },
    ],
    memory: ["Device cover added · renewal declined, not to be raised for 90 days"],
    governance: [
      { check: "Decision, mandate and consent recorded together", result: "pass" },
      { check: "A declined offer is not repeated", result: "pass" },
    ],
    action: "Set up cover; record the whole exchange for audit; respect the no.",
  },
];

const WHO = {
  "maya-agent": "Maya’s agent",
  "bt-agent": "BT’s agent",
  maya: "Maya",
} as const;

export function FutureView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const beat = BEATS[step];
  const shown = BEATS.slice(0, step + 1).flatMap((b, i) => b.lines.map((l) => ({ ...l, beat: i })));
  return (
    <div className="fv">
      <header className="fv-head">
        <div>
          <span className="eyebrow">A future vision · not part of tonight’s story</span>
          <h2>2030: Maya’s own agent talks to BT’s agent</h2>
          <p>
            Customers will increasingly send an AI agent to deal with companies for them. The same architecture holds:
            memory decides what’s relevant, governance decides what may be agreed, and every action is recorded.
          </p>
        </div>
        <button className="fv-back" onClick={onBack}>
          ← Back to tonight
        </button>
      </header>
      <ol className="fv-steps" aria-label="Steps">
        {BEATS.map((b, i) => (
          <li key={b.title}>
            <button aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {b.title}
            </button>
          </li>
        ))}
      </ol>
      <div className="fv-body">
        <section className="fv-thread" aria-label="Conversation">
          {shown.map((l, i) => (
            <div key={i} className={`fv-msg is-${l.from}${l.beat === step ? " is-new" : ""}`}>
              <small>
                {WHO[l.from]} · {l.via}
              </small>
              <p>{l.text}</p>
            </div>
          ))}
          <div className="fv-nav">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              ← Back
            </button>
            <button className="is-primary" onClick={() => setStep(Math.min(BEATS.length - 1, step + 1))} disabled={step === BEATS.length - 1}>
              Next step →
            </button>
          </div>
        </section>
        <aside className="fv-arch" aria-label="What BT’s architecture does">
          <span className="eyebrow">What BT’s architecture does · step {step + 1}</span>
          <h3>{beat.title}</h3>
          {beat.memory.length > 0 && (
            <div>
              <b>Customer memory used</b>
              <ul>
                {beat.memory.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <b>Governance</b>
            <ul className="fv-checks">
              {beat.governance.map((g) => (
                <li key={g.check} className={`is-${g.result}`}>
                  <i>{g.result === "pass" ? "✓" : g.result === "hold" ? "!" : "·"}</i>
                  {g.check}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <b>Action</b>
            <p>{beat.action}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
