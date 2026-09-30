import btLogo from "./assets/bt-logo.png";
import { useState } from "react";
import { Eve } from "./Eve";
import type { Snapshot, Household, DemoAction, SourceEvent } from "./types";
import "./phone.css";

export function PhoneIcon({
  kind,
}: {
  kind:
    | "home"
    | "services"
    | "help"
    | "account"
    | "chevron"
    | "clock"
    | "wifi"
    | "check"
    | "signal";
}) {
  const paths = {
    home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
    services: "M5 7h14v13H5ZM8 4h8M9 11h6M9 15h6",
    help: "M20 11a8 8 0 0 1-8 8H8l-5 3v-7a8 8 0 1 1 17-4ZM8 10h8M8 14h5",
    account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
    chevron: "m9 5 7 7-7 7",
    clock: "M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    wifi: "M2 8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8 16a5 5 0 0 1 8 0M12 20h.01",
    check: "m5 12 4 4L19 6",
    signal: "M4 20v-4M9 20v-8M14 20V8M19 20V4",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={kind === "signal" ? 3 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
const tabs = ["Home", "Services", "Help", "Account"] as const;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });

/** A customer-language reason for each record a decision relied on. */
function because(e: SourceEvent, h: Household): { text: string; used: string } | null {
  const p = e.payload as Record<string, unknown>;
  switch (e.type) {
    case "router.heartbeat_overdue":
      return { text: `Your hub stopped checking in with us at ${time(e.occurredAt)}.`, used: "Your hub’s status signal" };
    case "router.heartbeat_received":
      return { text: `Your hub checked in again at ${time(e.occurredAt)}.`, used: "Your hub’s status signal" };
    case "service.reprofiled":
      return { text: "We adjusted your line remotely to keep it stable.", used: "Tests already run on your line" };
    case "monitoring.completed":
      return { text: "We watched your line closely after the fix: no drops.", used: "Your hub’s status signal" };
    case "line.degradation_detected":
      return { text: "A routine overnight check found your line getting weaker.", used: "Tests already run on your line" };
    case "early_life.checkpoint":
      return { text: "Your plan includes BT TV and Netflix, and they weren’t set up yet.", used: "Your order" };
    case "product.activated":
      return { text: `You set up ${String(p.product ?? "a product")}.`, used: "Your order" };
    case "usage.observed":
      return { text: "Your household has been using everything.", used: "How you use your services" };
    case "usage.pattern":
      return { text: "Your household watches live sport on most weekends.", used: "How you use your services" };
    case "preference.offers_opt_in":
      return { text: "You said you’d like to hear about relevant offers.", used: "What you told us" };
    case "router.setup_attempted":
      return { text: `You switched on your new hub at ${time(e.occurredAt)}, and it hasn’t connected yet.`, used: "Your hub’s status signal" };
    case "incident.cleared":
      return { text: "The network fault in your area has been fixed.", used: "Our network fault register" };
    case "incident.confirmed":
      return h.incident
        ? { text: "Your line is part of a confirmed network fault in your area.", used: "Our network fault register" }
        : { text: "A nearby network fault does not include your line.", used: "Our network fault register" };
    case "diagnostic.completed":
      return p.result === "not_resolved" || p.result === "intermittent"
        ? { text: `A ${String(p.test ?? "test").replace("_", " ")} at ${time(e.occurredAt)} didn’t fix it, so we won’t ask you to repeat it.`, used: "Tests already run on your line" }
        : { text: `We ran a ${String(p.test ?? "test").replace("_", " ")} on your line at ${time(e.occurredAt)}.`, used: "Tests already run on your line" };
    case "service.restored_observed":
      return { text: `A line test at ${time(e.occurredAt)} shows your connection is back.`, used: "Tests already run on your line" };
    case "promise.created":
      return { text: `${h.owner ?? "Your adviser"} promised to call you at ${time(String(p.dueAt ?? e.occurredAt))}, and that still stands.`, used: "Your open case" };
    case "promise.fulfilled":
      return { text: `${h.owner ?? "Your adviser"} made the call promised for ${time(e.occurredAt)}.`, used: "Your open case" };
    case "case.opened":
      return { text: `You reported this on ${day(e.occurredAt)}.`, used: "Your open case" };
    case "order.delivered":
      return { text: `Your hub was delivered on ${day(e.occurredAt)}.`, used: "Your order" };
    case "activation.pending":
    case "activation.confirmed":
      return { text: e.type === "activation.pending" ? "Your line isn’t switched on yet." : "Your line is now switched on.", used: "Your order" };
    case "activation.first_use_observed":
      return { text: "We saw your connection being used for the first time.", used: "Your hub’s status signal" };
    case "customer.confirmed_working":
      return { text: "You told us it’s working again.", used: "What you told us" };
    case "preference.stated":
      return { text: `You told us: ${e.description}`, used: "What you told us" };
    default:
      return null;
  }
}

/** "Why am I seeing this?" — the decision behind a message, in the customer's language. */
function WhySheet({ action, snapshot, h, onClose }: { action: DemoAction; snapshot: Snapshot; h: Household; onClose: () => void }) {
  const decision = snapshot.decisions.find((d) => d.id === action.decisionId);
  const used = (decision?.evidenceIds ?? [])
    .map((id) => snapshot.events.find((e) => e.id === id))
    .filter((e): e is SourceEvent => !!e)
    // Old orders are real evidence but noise to a customer; only mention recent ones.
    .filter((e) => !/^(order|activation)\./.test(e.type) || Date.parse(snapshot.clock) - Date.parse(e.occurredAt) < 30 * 864e5)
    .map((e) => because(e, h))
    .filter((x): x is { text: string; used: string } => !!x);
  const reasons = [...new Map(used.map((u) => [u.text, u])).values()];
  const sources = [...new Set(used.map((u) => u.used))];
  const held = h.evidence.filter((e) => e.subject === h.id && !(decision?.evidenceIds ?? []).includes(e.id)).length;
  return (
    <div className="why-sheet" role="dialog" aria-label="Why am I seeing this?">
      <div className="why-grab" />
      <header>
        <strong>Why am I seeing this?</strong>
        <button onClick={onClose} aria-label="Close">×</button>
      </header>
      <h4>We sent this because</h4>
      <ol>
        {reasons.slice(0, 4).map((r) => (
          <li key={r.text}>{r.text}</li>
        ))}
        {!reasons.length && <li>{decision?.reason ?? "It relates to your service."}</li>}
      </ol>
      <h4>What we used</h4>
      <div className="why-chips">
        {sources.map((u) => (
          <span key={u}>{u}</span>
        ))}
      </div>
      <h4>What we didn’t use</h4>
      <p>
        {held} other records we hold about your service. Other people and products in your household are not used for
        service messages.
      </p>
      <h4>Who’s accountable</h4>
      <p>
        {h.owner ? `${h.owner}, your named BT adviser.` : "The BT service team."} This message was chosen by our service
        system with AI assistance and checked against our service policy{decision ? ` (${decision.policyVersion})` : ""}.
      </p>
      <footer>
        <span>You can ask for a person at any time.</span>
        <small>Ref {action.decisionId.slice(0, 8)} · demo · no real message sent</small>
      </footer>
    </div>
  );
}

/** The story's next step for an Eve message: what the customer can do next, in one tap. */
const NEXT_STEP: Record<string, { cta: string; title: string; lines: string[]; primary: string; secondary?: string; done: string; declined?: string }> = {
  "early-life": {
    cta: "Start setup",
    title: "Set up BT TV and Netflix",
    lines: [
      "Plug the BT TV box into your TV and into the hub.",
      "Switch it on. It finds your account by itself.",
      "Open Netflix on the box and sign in with the code we’ll send you.",
    ],
    primary: "I’ve done it",
    secondary: "Remind me tonight",
    done: "Great. Eve will check it’s all working.",
    declined: "No problem. Eve will remind you at 19:00.",
  },
  offer: {
    cta: "See the offer",
    title: "TNT Sports on your BT TV",
    lines: [
      "Why you’re seeing this: your household watched live sport through apps on 5 of the last 6 weekends.",
      "Watch it on the living-room TV instead. First month free, then £25 a month.",
      "Cancel any time in the app. If you say no, we won’t ask again for a while.",
    ],
    primary: "Start my free month",
    secondary: "No thanks",
    done: "Demo only: nothing has been ordered.",
    declined: "Got it. We won’t ask again for a while.",
  },
  "quiet-fix": {
    cta: "See what we fixed",
    title: "What we fixed overnight",
    lines: [
      "02:10 · A routine check found your line getting weaker (noise margin 3.1 dB; normally about 6 dB).",
      "03:40 · We adjusted your line remotely. Nobody needed to visit.",
      "Since then · Your line has been healthy. Nothing you need to do.",
    ],
    primary: "Thanks",
    done: "Glad it didn’t get in the way of your morning.",
  },
  "monitor-closed": {
    cta: "See the checks",
    title: "Your weekend of extra checks",
    lines: [
      "Friday 21:12 · Your line was adjusted remotely to stop the drops.",
      "Friday to Monday · We watched it closely: no drops at all.",
      "Monday 08:25 · Aisha closed your case.",
    ],
    primary: "Thanks",
    done: "You’re all set for the week.",
  },
};

function NextStepSheet({ step, onClose }: { step: (typeof NEXT_STEP)[string]; onClose: (note: string | null) => void }) {
  return (
    <div className="why-sheet next-sheet" role="dialog" aria-label={step.title}>
      <div className="why-grab" />
      <header>
        <strong>{step.title}</strong>
        <button onClick={() => onClose(null)} aria-label="Close">×</button>
      </header>
      <ol>
        {step.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ol>
      <div className="next-actions">
        <button className="next-primary" onClick={() => onClose(step.done)}>
          {step.primary}
        </button>
        {step.secondary && (
          <button className="next-secondary" onClick={() => onClose(step.declined ?? null)}>
            {step.secondary}
          </button>
        )}
      </div>
      <footer>
        <small>Demo · nothing is ordered or sent</small>
      </footer>
    </div>
  );
}

export function PhoneExperience({
  snapshot,
  customer: h,
  actions,
  startChat,
  busy,
  onConfirm,
  onSupport,
}: {
  snapshot: Snapshot;
  customer: Household;
  actions: DemoAction[];
  startChat: boolean;
  busy: boolean;
  onConfirm: () => void;
  onSupport: () => void;
}) {
  const [page, setPage] = useState<(typeof tabs)[number]>(
    startChat ? "Help" : "Home",
  );
  const messages = [...actions].reverse();
  // Today's conversation with a person at BT is part of this customer's own story.
  const clockDay = new Date(snapshot.clock).toDateString();
  const chat = snapshot.events
    .filter(
      (e) =>
        e.subject === h.id &&
        e.type === "conversation.message" &&
        Date.parse(e.receivedAt) <= Date.parse(snapshot.clock) &&
        new Date(e.occurredAt).toDateString() === clockDay,
    )
    .map((e) => {
      const p = e.payload as { speakerRole?: string; speaker?: string };
      return { who: p.speakerRole === "customer" ? "You" : p.speaker ?? "BT", text: e.description, at: e.occurredAt };
    });
  const [why, setWhy] = useState<DemoAction | null>(null);
  const [next, setNext] = useState<(typeof NEXT_STEP)[string] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const STEP_KEY: Record<string, string> = { "early-life": "early-life", offer: "offer", "quiet-fix-note": "quiet-fix", "monitor-close": "monitor-closed" };
  const stepFor = (a: DemoAction) => {
    const id = snapshot.decisions.find((d) => d.id === a.decisionId)?.trace?.selectedId;
    return id && STEP_KEY[id] ? NEXT_STEP[STEP_KEY[id]] : null;
  };
  // The headline follows the household's actual state rather than a marketing line. A recovery
  // is only news to a customer we told about the problem; a quiet watch stays quiet.
  // An open service case with a named owner is live before tonight's first signal.
  const openCase = h.caseStatus === "open" && !!h.owner && !h.activation.includes("unconfirmed");
  const headline = h.confirmed
    ? "All sorted."
    : h.firstUseObserved
      ? "You’re connected."
      : h.restored && actions.length
        ? "Your connection is back."
        : h.incident && h.incidentCleared && h.activation.includes("unconfirmed")
          ? "Ready when you are."
          : h.incident && !h.incidentCleared
          ? h.activation.includes("unconfirmed")
            ? "Hold off for now."
            : "We’re on it."
          : h.activation.includes("unconfirmed")
            ? "Let’s get you connected."
            : openCase
              ? "We’re looking into your connection."
              : "Your home, connected.";
  const open = (next: typeof page) => {
    if (next === "Help") onSupport();
    setPage(next);
  };
  const service = h.confirmed
    ? "Working · confirmed by you"
    : h.firstUseObserved
      ? "Connected · first use observed"
      : h.restored && actions.length && h.promise && h.owner
        ? h.promiseFulfilled
          ? `Line back · ${h.owner} called you`
          : `Line back · ${h.owner} will still call at ${time(h.promise)}`
        : h.restored && actions.length
          ? "Connection observed"
      : openCase && h.promise
        ? h.promiseFulfilled
          ? `Case open · ${h.owner} called you`
          : `Case open · ${h.owner} will call at ${time(h.promise)}`
        : openCase
          ? `Case open · ${h.owner} has it`
          : h.activation.includes("unconfirmed")
            ? "Hub delivered · not connected yet"
            : "Your home broadband";
  // A fault case that was open before tonight: what the customer reported and what was tried.
  const opened = h.evidence.filter((e) => e.type === "case.opened").at(-1);
  const tried = h.evidence.filter(
    (e) => e.type === "diagnostic.completed" && opened && Date.parse(e.occurredAt) >= Date.parse(opened.occurredAt),
  );
  // Title a conversation by what was promised in it, if anything.
  const chatTitle =
    chat
      .filter((m) => m.who !== "You")
      .flatMap((m) => m.text.split(/(?<=\.)\s+/))
      .find((line) => /\bcall\b/i.test(line))
      ?.replace(/,.*$/, "")
      .replace(/\.$/, "") ?? chat.find((m) => m.who !== "You")?.text.split(".")[0] ?? "Your conversation";
  const caseCard =
    openCase && opened && !h.confirmed ? (
      <div className="phone-case">
        <div className="phone-case-head">
          <strong>Your open case · {String((opened.payload as { caseId?: string }).caseId ?? "")}</strong>
          <small>Reported {day(opened.occurredAt)}</small>
        </div>
        <p>{opened.description.split(".")[0]}.</p>
        <ul>
          {tried.map((e) => (
            <li key={e.id}>
              {(e.payload as { test?: string }).test === "restart"
                ? `Restart at ${time(String(e.occurredAt))} didn’t fix it`
                : `${day(e.occurredAt)}: ${e.description.split(".")[0].toLowerCase()}`}
            </li>
          ))}
        </ul>
        {h.promise && (
          <small className="phone-case-next">
            {h.promiseFulfilled ? `${h.owner} called you at ${time(h.promise)}` : `${h.owner} will call you at ${time(h.promise)}`}
          </small>
        )}
      </div>
    ) : null;
  const eveEntry = (
    <button className="phone-eve-entry" onClick={() => open("Help")}>
      <i className="eve-entry-icon" aria-hidden="true">
        e<span>•</span>
      </i>
      <span>
        <strong>Talk to Eve</strong>
        <small>Your story, already in context.</small>
      </span>
      <PhoneIcon kind="chevron" />
    </button>
  );
  const callback = h.promise
    ? h.promiseFulfilled
      ? `${time(h.promise)} · completed`
      : `Today, ${time(h.promise)}`
    : "None arranged";
  return (
    <>
      <div
        className={`phone phone-native ${page === "Help" ? "phone-conversation" : ""}`}
      >
        <div className="island" aria-hidden="true" />
        {why && page === "Home" && <WhySheet action={why} snapshot={snapshot} h={h} onClose={() => setWhy(null)} />}
        {next && page === "Home" && (
          <NextStepSheet
            step={next}
            onClose={(n) => {
              setNext(null);
              setNote(n);
            }}
          />
        )}
        {note && page === "Home" && (
          <div className="phone-toast" role="status" onClick={() => setNote(null)}>
            {note}
          </div>
        )}
        <div className="phone-status">
          <strong>{time(snapshot.clock)}</strong>
          <span>
            <PhoneIcon kind="signal" />
            <PhoneIcon kind="wifi" />
            <i className="battery" />
          </span>
        </div>
        {page === "Help" ? (
          <Eve
            snapshot={snapshot}
            person={h.id}
            onBack={() => setPage("Home")}
          />
        ) : (
          <>
            <div className="phone-body" key={page}>
              <div className="phone-app-header">
                <img
                  src={btLogo}
                  alt="BT"
                />
                <strong>My BT</strong>
                <button
                  className="phone-avatar"
                  aria-label="Your account"
                  onClick={() => setPage("Account")}
                >
                  {h.name[0]}
                </button>
              </div>
              {page === "Home" ? (
                <>
                  <p className="phone-greeting">
                    Good evening, {h.name.split(" ")[0]}
                  </p>
                  <h2>{headline}</h2>
                  <button
                    className="phone-service"
                    onClick={() => setPage("Services")}
                  >
                    <PhoneIcon kind="wifi" />
                    <span>
                      <strong>Broadband</strong>
                      <small>{service}</small>
                    </span>
                    <PhoneIcon kind="chevron" />
                  </button>
                  {caseCard}
                  {eveEntry}
                  <div className="phone-section-title">
                    <span>Your updates</span>
                    <span>
                      {messages.length + (chat.length ? 1 : 0)
                        ? `${messages.length + (chat.length ? 1 : 0)} tonight`
                        : "All caught up"}
                    </span>
                  </div>
                  <div className="phone-messages">
                    {messages.length ? (
                      messages.map((a, i) => (
                        <details
                          className={`phone-message ${i ? "older" : ""}`}
                          key={a.id}
                          open={i === 0 ? true : undefined}
                        >
                          <summary>
                            <div className="message-meta">
                              <span>
                                <i className="eve-mini" aria-hidden="true">e</i>
                                Eve · BT
                              </span>
                              <time>{time(a.time)}</time>
                            </div>
                            <h3>
                              {a.title}
                              <PhoneIcon kind="chevron" />
                            </h3>
                          </summary>
                          <p>{a.body}</p>
                          {i === 0 && stepFor(a) && (
                            <button
                              className="next-cta"
                              onClick={(e) => {
                                e.preventDefault();
                                setNext(stepFor(a)!);
                              }}
                            >
                              {stepFor(a)!.cta} <PhoneIcon kind="chevron" />
                            </button>
                          )}
                          <div className="phone-ai-line">
                            <span>Sent automatically · AI-assisted</span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setWhy(a);
                              }}
                            >
                              Why am I seeing this?
                            </button>
                          </div>
                          {i === 0 &&
                            h.id === "daniel" &&
                            snapshot.nextStep === "confirm" &&
                            !snapshot.historical && (
                              <button
                                className="confirm-button"
                                disabled={busy}
                                onClick={onConfirm}
                              >
                                It’s working again <PhoneIcon kind="check" />
                              </button>
                            )}
                          {i === 0 && h.promise && !h.promiseFulfilled && (
                            <div className="phone-promise">
                              <PhoneIcon kind="clock" />
                              <div>
                                <strong>{h.owner} will call</strong>
                                <small>{callback} · your existing case</small>
                              </div>
                            </div>
                          )}
                        </details>
                      ))
                    ) : chat.length ? null : (
                      <div className="phone-quiet">
                        <span className="phone-quiet-check">
                          <PhoneIcon kind="check" />
                        </span>
                        <strong>You’re all caught up.</strong>
                        <p>
                          Your service updates will appear here.
                          <br />
                          Eve is here whenever you need a hand.
                        </p>
                      </div>
                    )}
                    {chat.length > 0 && (
                      // Tonight's conversation is one more update, oldest last, in the same list.
                      <details className={`phone-message phone-chat-item${messages.length ? " older" : ""}`} open={messages.length ? undefined : true}>
                        <summary>
                          <div className="message-meta">
                            <span>
                              <img src={btLogo} alt="" />
                              {chat.find((m) => m.who !== "You")?.who ?? "BT"} · your conversation
                            </span>
                            <time>{time(chat[0].at)}</time>
                          </div>
                          <h3>
                            {chatTitle}
                            <PhoneIcon kind="chevron" />
                          </h3>
                        </summary>
                        <div className="phone-chat">
                          {chat.map((m, i) => (
                            <p key={i} className={m.who === "You" ? "is-you" : ""}>
                              <b>{m.who}</b> {m.text}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </>
              ) : page === "Services" ? (
                <>
                  <p className="phone-greeting">Made for your everyday</p>
                  <h2>Your services.</h2>
                  <div className="phone-service-detail">
                    <span className="phone-service-icon">
                      <PhoneIcon kind="wifi" />
                    </span>
                    <h3>Home broadband</h3>
                    <p>{service}</p>
                  </div>
                  <div className="phone-section-title">
                    <span>Service & support</span>
                  </div>
                  <dl className="phone-native-list">
                    <div>
                      <dt>Connection</dt>
                      <dd>{h.serviceState}</dd>
                    </div>
                    <div>
                      <dt>Your case</dt>
                      <dd>
                        {h.caseStatus === "none"
                          ? "No open case"
                          : h.caseStatus === "closed"
                            ? h.confirmed
                              ? "Closed · you confirmed it works"
                              : "Closed · connection observed"
                            : "Open"}
                      </dd>
                    </div>
                    <div>
                      <dt>Case owner</dt>
                      <dd>{h.owner || "None assigned"}</dd>
                    </div>
                    <div>
                      <dt>Callback</dt>
                      <dd>{callback}</dd>
                    </div>
                  </dl>
                  {eveEntry}
                </>
              ) : (
                <>
                  <p className="phone-greeting">My BT</p>
                  <h2>Your account.</h2>
                  <div className="phone-account-identity">
                    <span>
                      {h.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <h3>{h.name}</h3>
                    <p>Home broadband</p>
                  </div>
                  <div className="phone-section-title">
                    <span>How we support you</span>
                  </div>
                  <dl className="phone-native-list">
                    <div>
                      <dt>Service updates</dt>
                      <dd>
                        {h.contactAllowed
                          ? "In-app updates allowed"
                          : "Permission not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt>Named support</dt>
                      <dd>{h.owner || "No case owner assigned"}</dd>
                    </div>
                  </dl>
                  {h.habit && (
                    <div className="phone-preference">
                      <small>You told us</small>
                      <p>“We switch the hub off at night.”</p>
                      <span>
                        Used as context when looking at your connection.
                      </span>
                    </div>
                  )}
                  {eveEntry}
                </>
              )}
            </div>
            <div className="phone-bottom">
              <nav className="phone-tabs" aria-label="My BT navigation">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    className={page === tab ? "active" : ""}
                    aria-current={page === tab ? "page" : undefined}
                    onClick={() => open(tab)}
                    aria-label={tab === "Help" ? "Help — talk to Eve" : tab}
                  >
                    <PhoneIcon
                      kind={
                        tab.toLowerCase() as
                          | "home"
                          | "services"
                          | "help"
                          | "account"
                      }
                    />
                    <small>{tab}</small>
                  </button>
                ))}
              </nav>
              <div className="home-indicator" aria-hidden="true" />
            </div>
          </>
        )}
        {page === "Help" && (
          <div className="home-indicator" aria-hidden="true" />
        )}
      </div>
      <p className="phone-caption">
        {page === "Help"
          ? "Live AI · scoped to this customer’s server state."
          : h.id === "maya"
            ? "A quiet phone is intentional. Support is always available."
            : "Customer updates follow the persisted action record."}
      </p>
    </>
  );
}
