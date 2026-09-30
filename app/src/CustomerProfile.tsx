import type { Household, HouseholdProfile } from "./types";
import "./customer-profile.css";

// Customer memory beyond tonight: the household, the relationship, the history and the hour.
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const KIND_NAME: Record<string, string> = { laptop: "Laptops", phone: "Phones", tv: "TVs", speaker: "Speakers", tablet: "Tablets", console: "Consoles" };

export function HouseholdCard({ p, compact = false }: { p: HouseholdProfile; compact?: boolean }) {
  const kinds = [...new Set(p.devices.map((d) => d.kind))];
  return (
    <div className="cp-household">
      <div>
        <span className="cm-label">Who lives here · {p.members.length}</span>
        <ul className="cp-members">
          {p.members.map((m) => (
            <li key={m.name}>
              <b>{m.name}</b>
              <small>{m.relation}</small>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <span className="cm-label">On the network · {p.devices.length} devices</span>
        {p.devices.length ? (
          <ul className="cp-devices">
            {kinds.map((k) => (
              <li key={k}>
                <small>{KIND_NAME[k] ?? k}</small>
                <span>
                  {compact ? <em>{p.devices.filter(d => d.kind === k).length} observed</em> : p.devices
                    .filter((d) => d.kind === k)
                    .map((d) => (
                      <em key={d.name} title={`${d.owner} · first seen ${shortDay(d.since)}`}>
                        {d.name}
                      </em>
                    ))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cm-none">No device observations are available at this replay time.</p>
        )}
      </div>
    </div>
  );
}

export function RelationshipCard({ p }: { p: HouseholdProfile }) {
  const c = p.contract;
  return (
    <div className="cp-relationship">
      <div>
        <span className="cm-label">What they buy from BT and EE</span>
        <ul className="cp-products">
          {p.products.map((x) => (
            <li key={x.key}>
              <span className={`cp-brand is-${x.brand.toLowerCase()}`}>{x.brand}</span>
              <div>
                <b>{x.name}</b>
                <small>{x.detail}</small>
              </div>
              <i className={`cp-status is-${x.status.replace(/\s+/g, "-")}`}>{x.status}</i>
            </li>
          ))}
        </ul>
      </div>
      <dl className="cp-facts">
        {c && (
          <>
            <div>
              <dt>Contract</dt>
              <dd>
                {c.outOfContract ? (
                  <>Out of contract since {shortDay(c.end)}</>
                ) : (
                  <>
                    Renews {day(c.end)} · <b>{c.monthsLeft <= 3 ? `${Math.max(0, c.monthsLeft)} months left` : `${c.monthsLeft} months left`}</b>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Revenue</dt>
              <dd>
                £{c.arpu} a month{c.extra ? ` · ${c.extra}` : ""}
              </dd>
            </div>
          </>
        )}
        {p.churn && (
          <div className={`cp-churn is-${p.churn.level}`}>
            <dt>Churn risk</dt>
            <dd>
              <span className="cp-meter" aria-hidden="true">
                <i style={{ width: `${Math.round(p.churn.score * 100)}%` }} />
              </span>
              <b>{p.churn.level}</b> · {Math.round(p.churn.score * 100)}%
              <ul>
                {p.churn.drivers.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {p.preferences && (
          <div>
            <dt>Preferences</dt>
            <dd>
              {p.preferences.channel}
              {p.preferences.quietHours ? ` · quiet ${p.preferences.quietHours}` : ""} ·{" "}
              {p.preferences.offers ? (p.preferences.offersNote ?? "Open to offers") : "No marketing offers"}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function HistoryCard({ p, sent }: { p: HouseholdProfile; sent: { at: string; title: string }[] }) {
  const items = [
    ...p.contacts.map((c) => ({ at: c.at, channel: c.channel, who: c.with, topic: c.topic, outcome: c.outcome })),
    ...sent.map((s) => ({ at: s.at, channel: "In-app", who: "BT", topic: s.title, outcome: "Sent automatically" })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return (
    <ol className="cp-history">
      {items.map((x, i) => (
        <li key={i}>
          <time>
            {shortDay(x.at)} · {time(x.at)}
          </time>
          <span className="cm-channel">{x.channel}</span>
          <div>
            <b>{x.topic}</b>
            <small>
              {x.who} · {x.outcome}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function RightNowCard({ p }: { p: HouseholdProfile }) {
  if (!p.usage || !p.now) return <p className="cm-none">No usage pattern is available at this replay time.</p>;
  const curve = p.now.weekend ? p.usage.weekend : p.usage.weekday;
  return (
    <div className="cp-now">
      <div className="cp-now-head">
        <b>{p.now.label}</b>
        <small>
          {p.now.weekend ? "Weekend" : "Weekday"} use by hour · {p.usage.note}
        </small>
      </div>
      <div className="cp-bars" role="img" aria-label={`Share of use by hour; now is ${p.now.hour}:00, ${p.now.label.toLowerCase()}`}>
        {curve.map((v, h) => (
          <i key={h} className={h === p.now!.hour ? "is-now" : ""} style={{ height: `${Math.max(4, v * 100)}%` }} title={`${String(h).padStart(2, "0")}:00`} />
        ))}
      </div>
      <div className="cp-axis" aria-hidden="true">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}

/** How the agent turns each part of the profile into a non-generic action, from this home's facts. */
export function profileNotes(h: Household): Record<"household" | "relationship" | "history" | "now", [string, string]> {
  const p = h.profile!;
  const first = h.name.split(" ")[0];
  const unused = p.products.filter((x) => x.status !== "in use");
  const renewing = p.contract && !p.contract.outOfContract && p.contract.monthsLeft <= 3;
  return {
    household: [
      "Household members and devices observed so far.",
      p.usage?.note.includes("Works from home")
        ? `Work-from-home history makes timing relevant. The recorded decision below shows whether that context affected this action.`
        : p.devices.length === 0
          ? `No device observations are available yet. The immediate goal is to get ${first}’s home online.`
          : `${p.members.length} people and ${p.devices.length} devices. The agent uses this to judge who is affected when the line drops.`,
    ],
    relationship: [
      "Recorded products, usage, contract and illustrative retention indicators; these are synthetic profiles, not calibrated churn predictions.",
      unused.length
        ? `${unused.map((x) => x.name).join(" and ")} ${unused.length === 1 ? "is" : "are"} paid for but not in use yet. The agent’s job is to get everything working, not to sell more.`
        : p.churn?.level === "high" && renewing
          ? `The synthetic profile flags high churn risk with renewal in ${p.contract!.monthsLeft} months. That is relationship context, not authority to make an offer.`
          : p.contract?.outOfContract
            ? `Out of contract, so a bad night could end the relationship. A fix they didn’t have to ask for is worth telling ${first} about, at the right time.`
            : p.preferences?.offers
              ? `The profile records offer consent for ${first}. A recommendation still needs relevant usage evidence and the decision’s approval checks.`
              : `No marketing consent is recorded in this profile. Product eligibility and authority must be checked separately.`,
    ],
    history: [
      "Every conversation with us, on every channel, and everything we’ve sent.",
      p.contacts.length > 1
        ? `${first} has already told us about this. The agent carries it forward, so nobody asks ${first} to start again.`
        : `${p.contacts.length} conversation${p.contacts.length === 1 ? "" : "s"} on record. Only recorded agreements can be carried forward.`,
    ],
    now: [
      "How much this hour matters to this home, from its own use by hour.",
      p.now?.label.startsWith("Peak") || p.now?.label.startsWith("Just before")
        ? "This is usually an important usage window. A pattern helps interpret impact; it does not establish a current fault."
        : p.now?.label.startsWith("Usually offline")
          ? "The home is often offline now. Fresh incident or service evidence can override that routine."
          : "Historically a lower-use hour. The actual action and communication timing still depend on current evidence and permission.",
    ],
  };
}
