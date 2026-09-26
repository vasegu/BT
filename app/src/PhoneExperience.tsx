import btLogo from "./assets/bt-logo.png";
import { useState } from "react";
import { Eve } from "./Eve";
import type { Snapshot, Household, DemoAction } from "./types";
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
  const open = (next: typeof page) => {
    if (next === "Help") onSupport();
    setPage(next);
  };
  const service = h.confirmed
    ? "Working · confirmed by you"
    : h.restored
      ? "Connection observed"
      : snapshot.cutoff && h.id !== "maya"
        ? "Your service team has the context"
        : "Your home broadband";
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
                  <h2>
                    Your home,
                    <br />
                    connected.
                  </h2>
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
                  {eveEntry}
                  <div className="phone-section-title">
                    <span>Your updates</span>
                    <span>
                      {messages.length
                        ? `${messages.length} received`
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
                                <img
                                  src={btLogo}
                                  alt=""
                                />
                                Your BT team
                              </span>
                              <time>{time(a.time)}</time>
                            </div>
                            <h3>
                              {a.title}
                              <PhoneIcon kind="chevron" />
                            </h3>
                          </summary>
                          <p>{a.body}</p>
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
                    ) : (
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
                            ? "Closed · confirmed"
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
