import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { SectionView } from "./SectionView";
import { PhoneExperience } from "./PhoneExperience";
import type { Snapshot, PersonId, SourceEvent, Step } from "./types";

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const short = (id: string) => id.slice(0, 8);
const stepLabels = [
  "Ready",
  "Heartbeat overdue",
  "Incident confirmed",
  "Restoration observed",
  "Callback kept",
  "Customer confirmed",
];
const names = { daniel: "Daniel Reed", sam: "Sam Morgan", maya: "Maya Patel" };
const panelNames = {
  customer: "Customer memory",
  operations: "Operational memory",
  phone: "Customer experience",
  arbiter: "Arbiter",
  actions: "Actions & outcomes",
};
type PanelId = keyof typeof panelNames;
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-BT-Demo": "1" },
          body: JSON.stringify(body),
        },
  );
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error || `Request failed (${response.status})`);
  return value;
}
function useLocation() {
  const [params, setParams] = useState(
    () => new URLSearchParams(location.search),
  );
  useEffect(() => {
    const read = () => setParams(new URLSearchParams(location.search));
    addEventListener("popstate", read);
    return () => removeEventListener("popstate", read);
  }, []);
  const change = useCallback(
    (values: Record<string, string | null>, replace = false) => {
      const p = new URLSearchParams(location.search);
      Object.entries(values).forEach(([k, v]) =>
        v === null ? p.delete(k) : p.set(k, v),
      );
      history[replace ? "replaceState" : "pushState"](null, "", "?" + p);
      setParams(p);
    },
    [],
  );
  return [params, change] as const;
}
function Attributes({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="attributes">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="data-section">
      <div className="section-title">
        <h3>{title}</h3>
        {note && <span>{note}</span>}
      </div>
      {children}
    </section>
  );
}
function Glyph({ kind = "grid" }: { kind?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
    >
      {kind === "grid" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
        </>
      ) : kind === "signal" ? (
        <>
          <path d="M3 18v-2m5 2v-6m5 6V8m5 10V3" strokeWidth="2.5" />
        </>
      ) : (
        <>
          <path d="M3 9c5-5 13-5 18 0M6 13c3-3 9-3 12 0M10 17c1-1 3-1 4 0" />
          <circle cx="12" cy="20" r=".5" />
        </>
      )}
    </svg>
  );
}

function Panel({
  id,
  children,
  panel,
  onOpen,
}: {
  id: PanelId;
  children: ReactNode;
  panel: PanelId | null;
  onOpen: (id: PanelId | null) => void;
}) {
  return (
    <article className={`panel panel-${id}`}>
      <header>
        <div>
          <span className="panel-index">
            {
              {
                customer: "01",
                operations: "02",
                phone: "03",
                arbiter: "04",
                actions: "05",
              }[id]
            }
          </span>
          <h2>{panelNames[id]}</h2>
        </div>
        <button
          className="expand"
          onClick={() => onOpen(panel ? null : id)}
          aria-label={panel ? "Back to all panels" : `Expand ${panelNames[id]}`}
        >
          {panel ? "↙" : "↗"}
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </article>
  );
}

export function App() {
  const [params, change] = useLocation();
  const sessionId = params.get("session");
  const person = (
    Object.hasOwn(names, params.get("person") || "")
      ? params.get("person")
      : "daniel"
  ) as PersonId;
  const panel = (
    Object.hasOwn(panelNames, params.get("panel") || "")
      ? params.get("panel")
      : null
  ) as PanelId | null;
  const records = params.get("view") === "records";
  const focused = Boolean(panel || records);
  const cutoff = params.has("at") ? Number(params.get("at")) : undefined;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [inspected, setInspected] = useState<SourceEvent | null>(null);
  const created = useRef(false),
    request = useRef(0),
    dialog = useRef<HTMLDialogElement>(null),
    keyRef = useRef<{ session: string; step: Step; key: string } | null>(null);
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const n = ++request.current;
    try {
      const next = await api<Snapshot>(
        `/api/snapshot?session=${encodeURIComponent(sessionId)}${cutoff === undefined ? "" : `&at=${cutoff}`}`,
      );
      if (n === request.current) {
        setSnapshot((old) =>
          JSON.stringify(old) === JSON.stringify(next) ? old : next,
        );
        setError("");
      }
    } catch (e) {
      if (n === request.current) {
        setError((e as Error).message);
        setPlaying(false);
      }
    }
  }, [sessionId, cutoff]);
  const newSession = async () => {
    setPlaying(false);
    setBusy(true);
    try {
      const session = await api<Snapshot["session"]>("/api/scenarios", {});
      setSnapshot(null);
      change(
        {
          session: session.id,
          at: null,
          panel: sessionId ? null : panel,
          chat: sessionId ? null : params.get("chat"),
        },
        !sessionId,
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!sessionId && !created.current) {
      created.current = true;
      void newSession();
    }
  }, [sessionId]);
  useEffect(() => {
    setSnapshot(null);
    void refresh();
    const poll = setInterval(() => void refresh(), 1000);
    return () => {
      clearInterval(poll);
      request.current++;
    };
  }, [refresh]);
  useEffect(() => {
    setPlaying(false);
  }, [sessionId, cutoff, panel, records]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [panel, records]);
  useEffect(() => {
    if (inspected) dialog.current?.showModal();
  }, [inspected]);
  const advance = useCallback(async () => {
    if (
      !snapshot ||
      busy ||
      snapshot.historical ||
      !snapshot.nextStep ||
      snapshot.pendingJobs
    )
      return;
    const step = snapshot.nextStep;
    setBusy(true);
    if (
      keyRef.current?.session !== snapshot.session.id ||
      keyRef.current.step !== step
    )
      keyRef.current = {
        session: snapshot.session.id,
        step,
        key: crypto.randomUUID(),
      };
    try {
      await api("/api/events", {
        sessionId: snapshot.session.id,
        step,
        idempotencyKey: keyRef.current.key,
        revision: snapshot.session.revision,
      });
      keyRef.current = null;
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      setPlaying(false);
    } finally {
      setBusy(false);
    }
  }, [snapshot, busy, refresh]);
  useEffect(() => {
    if (!playing || !snapshot || busy || snapshot.pendingJobs) return;
    if (!snapshot.nextStep || snapshot.nextStep === "confirm") {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => void advance(), 2200);
    return () => clearTimeout(timer);
  }, [playing, snapshot?.session.step, snapshot?.pendingJobs, busy, advance]);
  const openPanel = (id: PanelId | null) => {
    setPlaying(false);
    change({ panel: id, view: null });
  };
  const inspect = (e: SourceEvent) => setInspected(e);
  const h = snapshot?.households.find((h) => h.id === person);
  const decision = snapshot?.decisions
    .filter((d) => d.person === person)
    .at(-1);
  const actions = snapshot?.actions.filter((a) => a.person === person) || [];
  const pending = !!snapshot?.pendingJobs;
  const current = !!snapshot && snapshot.session.id === sessionId;
  const lab = (study: string) =>
    `/reference/design/lab/?study=${study}&person=${person}&incident=${snapshot?.operations.incident ? 1 : 0}&session=${sessionId || ""}`;
  const evidence = h?.evidence.filter((e) => e.subject === person) || [];
  const relevantEvidence = evidence.filter(
    (e) => e.type !== "contact.authority_recorded",
  );

  const customer = h && (
    <Panel id="customer" panel={panel} onOpen={openPanel}>
      <div className="record-identity">
        <span className="avatar">
          {h.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </span>
        <div>
          <strong>{h.name}</strong>
          <code>{h.serviceId}</code>
        </div>
        <span className="tag">synthetic</span>
      </div>
      <Attributes
        rows={[
          [
            "Case",
            h.caseStatus === "none"
              ? "No open case"
              : h.caseStatus === "closed"
                ? "Closed · confirmed"
                : "Open service case",
          ],
          ["Owner", h.owner || "None assigned"],
          [
            "Commitment",
            h.promise
              ? `${formatTime(h.promise)} callback · ${h.promiseFulfilled ? "fulfilled" : "outstanding"}`
              : "None recorded",
          ],
          ["Service", h.serviceState],
        ]}
      />
      <Section
        title="Relevant source records"
        note={`${evidence.length} retained`}
      >
        {relevantEvidence.slice(-3).map((e) => (
          <button
            className="evidence-row"
            key={e.id}
            onClick={() => inspect(e)}
          >
            <time>{formatTime(e.occurredAt)}</time>
            <span>
              <strong>{e.description}</strong>
              <small>{e.type}</small>
            </span>
            <span>↗</span>
          </button>
        ))}
      </Section>
      <div className="context-note">
        <Glyph />
        <p>
          {h.id === "daniel"
            ? "Failed diagnostics and the named promise stay attached to this case."
            : h.id === "sam"
              ? "Delivery is a fact. Successful first use is still unknown."
              : "A stated habit provides context; contrary evidence would reopen the watch."}
        </p>
      </div>
      <a className="text-link" href={lab("atlas")}>
        Explore semantic memory <span>↗</span>
      </a>
    </Panel>
  );
  const operations = h && snapshot && (
    <Panel id="operations" panel={panel} onOpen={openPanel}>
      <Attributes
        rows={[
          [
            "Shared incident",
            snapshot.operations.incident ? (
              <>
                <span className="status-dot orange" />{" "}
                {snapshot.operations.incident.id} ·{" "}
                {snapshot.operations.incident.status}
              </>
            ) : (
              "No confirmed incident"
            ),
          ],
          [
            "This service",
            snapshot.operations.incident
              ? h.incident
                ? "Confirmed in scope"
                : "Confirmed outside scope"
              : "Membership not established",
          ],
          [
            "Latest ops record",
            `${formatTime(snapshot.events.filter((e) => e.subject === "shared").at(-1)!.occurredAt)} · source time`,
          ],
        ]}
      />
      <Section title="Affected-service register" note="explicit membership">
        <div className="scope-table">
          {snapshot.households.map((p) => (
            <button
              key={p.id}
              className={person === p.id ? "selected" : ""}
              onClick={() => change({ person: p.id })}
            >
              <span>{p.name}</span>
              <code>{p.id.slice(0, 3).toUpperCase()} / BB</code>
              <span>
                {snapshot.operations.incident
                  ? p.incident
                    ? "In scope"
                    : "Outside"
                  : "Unknown"}
              </span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Callback capacity" note="retained commitment">
        <div className="slots">
          {snapshot.operations.slots.map((s) => (
            <div key={s.time} className={s.owner ? "held" : ""}>
              <strong>{s.time}</strong>
              <span>
                {s.owner
                  ? snapshot.households.find((p) => p.id === s.person)
                      ?.promiseFulfilled
                    ? `Completed / ${s.owner}`
                    : `${s.owner} / ${snapshot.households.find((p) => p.id === s.person)?.name.split(" ")[0] || "Reserved"}`
                  : "Available"}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <button className="text-link" onClick={() => openPanel("operations")}>
        Inspect shared context & source freshness <span>↗</span>
      </button>
    </Panel>
  );
  const phone = h && snapshot && (
    <Panel id="phone" panel={panel} onOpen={openPanel}>
      <PhoneExperience
        key={`${snapshot.session.id}/${person}/${cutoff ?? "live"}`}
        snapshot={snapshot}
        customer={h}
        actions={actions}
        startChat={params.get("chat") === "eve"}
        busy={busy || pending || !!error}
        onConfirm={() => void advance()}
        onSupport={() => setPlaying(false)}
      />
    </Panel>
  );
  const arbiter = h && snapshot && (
    <Panel id="arbiter" panel={panel} onOpen={openPanel}>
      <div className="signal">
        <span className={`status-dot ${pending ? "orange" : ""}`} />
        <code>
          {decision?.trace?.triggerIds.length
            ? snapshot.events.find(
                (e) => e.id === decision.trace!.triggerIds[0],
              )?.type
            : snapshot.cutoff
              ? "Context reassessment"
              : "Awaiting a source event"}
        </code>
        <time>{decision ? formatTime(decision.time) : "—"}</time>
      </div>
      <div className="agent-path">
        <span>Ambient flag</span>
        <i>→</i>
        <span className={decision ? "current" : ""}>Arbiter</span>
        <i>→</i>
        <span>{decision?.domain || "Domain"}</span>
      </div>
      {decision ? (
        <>
          <div className="decision">
            <span className="eyebrow">
              {pending
                ? "Re-evaluating context"
                : `${decision.disposition} / ${decision.trace?.assessment ? (decision.trace.assessment.effective === "model" ? "Jev + policy" : "policy hold") : "rule-derived"}`}
            </span>
            <h3>{decision.title}</h3>
            <p>{decision.reason}</p>
          </div>
          <Attributes
            rows={[
              ["Evidence", `${decision.evidenceIds.length} source records`],
              [
                "Obligation",
                h.promise
                  ? h.promiseFulfilled
                    ? "Fulfilled independently"
                    : `${formatTime(h.promise)} · retain`
                  : "None recorded",
              ],
              [
                "Scope",
                h.incident
                  ? `${snapshot.operations.incident?.id || "Incident"} / confirmed`
                  : "No verified incident impact",
              ],
              [
                "Contact authority",
                h.contactAllowed
                  ? "Verified / service / in-app"
                  : "Not established · no send",
              ],
              ["Policy", decision.policyVersion],
            ]}
          />
          <div className="held-action">
            <span className="tag amber">held</span>
            <span>
              {
                (
                  decision.held.find((c) => c.title === "Repeat hub restart") ||
                  decision.held[0]
                ).title
              }
              <small>
                {
                  (
                    decision.held.find(
                      (c) => c.title === "Repeat hub restart",
                    ) || decision.held[0]
                  ).reason
                }
              </small>
            </span>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <Glyph />
          <h3>Ready to read the wider context.</h3>
          <p>
            Run the scenario. One event will be evaluated for three different
            households.
          </p>
        </div>
      )}
      <a
        className="text-link"
        href={`?${new URLSearchParams({ ...Object.fromEntries(params), panel: "arbiter" })}`}
        onClick={(event) => {
          event.preventDefault();
          openPanel("arbiter");
        }}
      >
        Inspect proposals & evidence <span>↗</span>
      </a>
    </Panel>
  );
  const actionPanel = h && snapshot && (
    <Panel id="actions" panel={panel} onOpen={openPanel}>
      <div className="trace-meta">
        <code>
          {short(snapshot.session.id)} / rev {snapshot.cutoff}
        </code>
        <span className="tag">{pending ? "processing" : "persisted"}</span>
      </div>
      <div className="trace-header">
        <span>Time</span>
        <span>Action / receipt</span>
        <span>State</span>
      </div>
      {actions.length ? (
        actions.slice(-3).map((a) => (
          <button
            className="trace-row"
            key={a.id}
            onClick={() => openPanel("actions")}
          >
            <time>{formatTime(a.time)}</time>
            <span>
              <strong>{a.title}</strong>
              <code>action {short(a.id)}</code>
            </span>
            <span className="trace-state">demo delivered</span>
          </button>
        ))
      ) : (
        <div className="trace-empty">
          {person === "maya" && decision
            ? "Watch recorded. No customer action committed."
            : "No actions yet."}
        </div>
      )}
      <Section title="Expected change → observed evidence">
        {snapshot.operations.outcomes
          .filter((o) => o.person === person)
          .map((o) => (
            <div className="outcome-row" key={o.id}>
              <span>{o.title}</span>
              <b className={o.check.status === "met" ? "observed" : ""}>
                {o.check.status === "met"
                  ? "verified"
                  : o.check.status === "contradicted"
                    ? "reassess"
                    : o.check.status === "unverified"
                      ? "proof overdue"
                      : "awaiting proof"}
              </b>
            </div>
          ))}
        {!snapshot.operations.outcomes.some((o) => o.person === person) && (
          <p className="source-foot">
            Verification begins with the first committed plan.
          </p>
        )}
      </Section>
      {actions.at(-1) && (
        <details className="raw-record">
          <summary>
            Persisted action object <span>JSON</span>
          </summary>
          <pre>{JSON.stringify(actions.at(-1), null, 2)}</pre>
        </details>
      )}
      <button className="text-link" onClick={() => openPanel("actions")}>
        Trace actions, expectations & outcomes <span>↗</span>
      </button>
    </Panel>
  );
  return (
    <>
      <a className="skip" href="#workspace">
        Skip to workspace
      </a>
      <header className={`topbar${focused ? " focus-topbar" : ""}`}>
        <div className="identity">
          <img src="/reference/references/bt/BT_Logo_purple.png" alt="BT" />
          <span>
            Experience intelligence<small>BT CONSUMER / WORKING APP</small>
          </span>
        </div>
        {focused ? (
          <>
            <span className="focus-heading">
              ACCOUNT /{" "}
              {records ? "SOURCE RECORDS" : panelNames[panel!].toUpperCase()}
            </span>
            <button className="focus-back" onClick={() => openPanel(null)}>
              ← Back to account
            </button>
          </>
        ) : (
          <nav aria-label="Main">
            <button
              aria-current="page"
              onClick={() => change({ view: null, panel: null })}
            >
              Account
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                change({ view: "records", panel: null });
              }}
            >
              Source records
            </button>
            <a href={lab("atlas")}>Visual lab ↗</a>
          </nav>
        )}
        <span className="runtime-badge">
          <i className={error ? "offline" : ""} />
          {error ? "Connection issue" : "Local runtime"}
        </span>
        {!focused && (
          <a className="review-link" href="/reference/design/review.html">
            Design review ↗
          </a>
        )}
      </header>
      {!focused && (
        <div className="replay-bar">
          <div className="scenario-time">
            <span>THREE QUIET ROUTERS</span>
            <strong>{snapshot ? formatTime(snapshot.clock) : "20:45"}</strong>
          </div>
          <div className="replay-main">
            <span className="eyebrow">
              {snapshot?.historical
                ? "Historical snapshot / read-only"
                : "Scenario replay / synthetic source"}
            </span>
            <strong>
              {snapshot
                ? stepLabels[snapshot.cutoff]
                : "Connecting to the runtime…"}
            </strong>
          </div>
          <div className="step-track" aria-label="Replay steps">
            {stepLabels.map((label, i) => (
              <button
                key={label}
                aria-label={`View ${label}`}
                aria-pressed={snapshot?.cutoff === i}
                disabled={!snapshot || i > snapshot.session.step}
                onClick={() => {
                  setPlaying(false);
                  change({
                    at: i === snapshot?.session.step ? null : String(i),
                  });
                }}
                className={snapshot && i <= snapshot.cutoff ? "reached" : ""}
              >
                {i ? i : "•"}
              </button>
            ))}
          </div>
          <select
            className="history-select"
            aria-label="Replay position"
            value={snapshot?.cutoff ?? 0}
            disabled={!snapshot}
            onChange={(e) => {
              setPlaying(false);
              change({
                at:
                  Number(e.target.value) === snapshot?.session.step
                    ? null
                    : e.target.value,
              });
            }}
          >
            {stepLabels.map((name, i) => (
              <option
                key={i}
                value={i}
                disabled={!snapshot || i > snapshot.session.step}
              >
                {i} / {name}
              </option>
            ))}
          </select>
          <div className="replay-actions">
            <button
              className="primary"
              disabled={
                !current ||
                busy ||
                pending ||
                snapshot?.historical ||
                !!error ||
                !snapshot?.nextStep
              }
              onClick={() => {
                if (snapshot?.nextStep === "confirm") {
                  change({ person: "daniel" });
                  document.querySelector(".phone")?.scrollIntoView({
                    block: "center",
                    behavior: matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                      ? "auto"
                      : "smooth",
                  });
                } else setPlaying(!playing);
              }}
            >
              {snapshot?.nextStep === "confirm"
                ? "Daniel’s reply ↓"
                : playing
                  ? "Ⅱ Pause"
                  : "▷ Play"}
            </button>
            <button
              title="Apply the next synthetic source event"
              aria-label="Next scenario event"
              disabled={
                !current ||
                busy ||
                pending ||
                snapshot?.historical ||
                !!error ||
                !snapshot?.nextStep
              }
              onClick={() => void advance()}
            >
              →
            </button>
            <button
              className="new-session"
              disabled={busy}
              onClick={() => void newSession()}
              title="Create a fresh session; current records are retained"
            >
              ↺ <span>New session</span>
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => void refresh()}>Retry connection</button>
        </div>
      )}
      {snapshot?.failedJobs ? (
        <div className="error-banner" role="alert">
          A worker job failed. Its source events are retained; the worker
          retries up to three times. Start a new session to replay after
          investigation.
        </div>
      ) : null}
      <main
        id="workspace"
        className={
          focused
            ? `focused-workspace${panel === "customer" ? " customer-focus" : panel === "phone" ? " phone-focus" : panel === "arbiter" ? " arbiter-focus" : panel === "operations" ? " operations-focus" : panel === "actions" ? " actions-focus" : ""}`
            : "account-workspace"
        }
      >
        <div className="workspace-intro">
          <div>
            <p className="eyebrow">
              {records
                ? "Evidence / append-only source ledger"
                : panel
                  ? "Account / " + panelNames[panel]
                  : "One signal · three different contexts"}
            </p>
            <h1>
              {records
                ? "Read the records behind the experience."
                : panel
                  ? panel === "customer"
                    ? "Knowing your customer."
                    : panelNames[panel]
                  : "The next move depends on what we know."}
            </h1>
          </div>
        </div>
        {focused ? (
          <div className="focused-context">
            <strong>{names[person]}</strong>
            <code>{h?.serviceId || "Loading service…"}</code>
            <span>
              {snapshot
                ? `${formatTime(snapshot.clock)} · ${snapshot.historical ? "Historical snapshot" : "Current snapshot"} · rev ${snapshot.cutoff}`
                : "Loading snapshot…"}
            </span>
          </div>
        ) : (
          <div className="household-bar">
            <div className="people">
              {Object.entries(names).map(([id, name]) => (
                <button
                  key={id}
                  aria-pressed={person === id}
                  onClick={() => change({ person: id })}
                >
                  <span className="avatar">
                    {name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")}
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>
                      {
                        {
                          daniel: "Recovery + a promise",
                          sam: "First use unconfirmed",
                          maya: "An overnight habit",
                        }[id]
                      }
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <div className="session-meta">
              {snapshot ? (
                <>
                  <span className={`status-dot ${pending ? "orange" : ""}`} />
                  {pending
                    ? "Worker processing…"
                    : snapshot.historical
                      ? "Historical · read only"
                      : "Session persisted"}
                  <code>{short(snapshot.session.id)}</code>
                </>
              ) : (
                "Opening session…"
              )}
            </div>
          </div>
        )}
        {!snapshot || !h ? (
          <div className="loading">
            <Glyph />
            <p>Loading the local data model…</p>
          </div>
        ) : records ? (
          <section className="ledger">
            <header>
              <h2>Source events</h2>
              <span>
                {snapshot.events.length} records visible · cutoff{" "}
                {formatTime(snapshot.clock)}
              </span>
            </header>
            <div className="ledger-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time / received</th>
                    <th>Subject</th>
                    <th>Record</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshot.events].reverse().map((e) => (
                    <tr key={e.id}>
                      <td>
                        {formatTime(e.occurredAt)}
                        <small>received {formatTime(e.receivedAt)}</small>
                      </td>
                      <td>
                        {e.subject === "shared"
                          ? "Operational"
                          : names[e.subject]}
                      </td>
                      <td>
                        <button onClick={() => inspect(e)}>
                          {e.description} ↗
                        </button>
                        <code>{e.type}</code>
                      </td>
                      <td>
                        <code>{e.source}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : panel ? (
          <SectionView
            onCutoff={(at) =>
              change({
                at: at === snapshot.session.revision ? null : String(at),
              })
            }
            panel={panel}
            h={h}
            snapshot={snapshot}
            decision={decision}
            actions={actions}
            phone={phone}
            inspect={inspect}
          />
        ) : (
          <div className="overview">
            <div className="panel-stack left-stack">
              {customer}
              {operations}
            </div>
            {phone}
            <div className="panel-stack right-stack">
              {arbiter}
              {actionPanel}
            </div>
          </div>
        )}
        <footer>
          <span>Accenture / RX · BT Consumer</span>
          <span>
            Synthetic sources ·{" "}
            {decision?.trace?.assessment
              ? "Jev + policy"
              : "rule-derived decisions"}{" "}
            · demo actions
          </span>
          <span>
            SQLite + server worker <b>·</b> Eve / OpenAI on demand
          </span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        className="evidence-dialog"
        onClose={() => setInspected(null)}
      >
        <header>
          <span className="eyebrow">Source record / synthetic</span>
          <button
            onClick={() => dialog.current?.close()}
            aria-label="Close evidence"
          >
            ×
          </button>
        </header>
        {inspected && (
          <>
            <h2>{inspected.type}</h2>
            <p>{inspected.description}</p>
            <Attributes
              rows={[
                ["Record", inspected.id],
                ["Source", inspected.source],
                ["Occurred", inspected.occurredAt],
                ["Received", inspected.receivedAt],
                ["Subject", inspected.subject],
                ["Revision", String(inspected.revision)],
              ]}
            />
            <pre>{JSON.stringify(inspected.payload, null, 2)}</pre>
          </>
        )}
      </dialog>
    </>
  );
}
