import {
  readSnapshot,
  cachedSnapshot,
  invalidateSnapshot,
} from "./snapshot-client";
import btLogo from "./assets/bt-logo.png";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AgentReview } from "./AgentReview";
import { SectionView } from "./SectionView";
import { PhoneExperience } from "./PhoneExperience";
import { Rhythm } from "./Rhythm";
import { SwayTile, SwayReview } from "./SwayReview";
import { GovernanceTile } from "./GovernanceView";
import { FutureView } from "./FutureView";
import type { Snapshot, PersonId, SourceEvent, Step } from "./types";

import { momentView, moments } from "./presentation";
import { NoteList, memoryFacts, operationsFacts, governanceFacts } from "./DecisionFlow";
import { MomentSpine, MomentLanes, MomentSkeleton } from "./GuidedPresentation";
const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const short = (id: string) => id.slice(0, 8);
const stepLabels = moments.map((m) => m.title);
const names = { daniel: "Daniel Reed", sam: "Sam Morgan", maya: "Maya Patel" };
const panelNames = {
  customer: "Customer memory",
  operations: "Operational memory",
  phone: "Customer experience",
  arbiter: "Arbiter",
  actions: "Actions & outcomes",
  review: "Agent review",
  governance: "Governance",
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
    throw Object.assign(
      new Error(value.error || `Request failed (${response.status})`),
      {
        status: response.status,
      },
    );
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
  storyFocus = false,
}: {
  storyFocus?: boolean;
  id: PanelId;
  children: ReactNode;
  panel: PanelId | null;
  onOpen: (id: PanelId | null) => void;
}) {
  return (
    <article
      className={`panel panel-${id}${storyFocus ? " is-story-focus" : ""}`}
    >
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
                review: "06",
                governance: "07",
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
  const requestedPerson = (
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
  const review = params.get("view") === "agent-review";
  const future = params.get("view") === "future";
  const focused = Boolean(panel || records || review);
  const cutoff = params.has("at") ? Number(params.get("at")) : undefined;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [sessionUnavailable, setSessionUnavailable] = useState(false),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [inspected, setInspected] = useState<SourceEvent | null>(null);
  const presenting = params.get("mode") !== "explore";
  const openingMoment = Boolean(sessionId && (!snapshot || snapshot.session.id !== sessionId || (cutoff !== undefined && snapshot.cutoff !== cutoff)));
  const view = useMemo(() => (snapshot ? momentView(snapshot) : null), [snapshot]);
  const person = requestedPerson;
  const changedPanels: string[] = presenting
    ? view?.lanes.find((l) => l.person === person)?.panels || []
    : [];
  const [sourceFilter, setSourceFilter] = useState("");
  const [sourceLimit, setSourceLimit] = useState(100);
  const created = useRef(false),
    request = useRef(0),
    dialog = useRef<HTMLDialogElement>(null),
    keyRef = useRef<{ session: string; step: Step; key: string } | null>(null);
  const refresh = useCallback(
    async (fresh = false) => {
      if (!sessionId) return;
      const n = ++request.current;
      try {
        const next = await readSnapshot(sessionId, cutoff, fresh);
        if (n === request.current) {
          setSnapshot((old) =>
            JSON.stringify(old) === JSON.stringify(next) ? old : next,
          );
          setError("");
          setSessionUnavailable(false);
          try {
            localStorage.setItem("bt:last-session", sessionId);
          } catch {}
        }
        return next.pendingJobs ? 2000 : 30000;
      } catch (e) {
        if (n === request.current) {
          setError((e as Error).message);
          const missing = (e as Error & { status?: number }).status === 404;
          setSessionUnavailable(missing);
          setPlaying(false);
          if (missing) {
            try {
              if (localStorage.getItem("bt:last-session") === sessionId)
                localStorage.removeItem("bt:last-session");
            } catch {}
            return false;
          }
        }
      }
      return 8000;
    },
    [sessionId, cutoff],
  );
  // Preload every recorded moment so clicking a time or stepping through is instant.
  const recordedRevision = snapshot?.session.id === sessionId ? snapshot?.session.revision : undefined;
  useEffect(() => {
    if (!sessionId || recordedRevision === undefined) return;
    let stopped = false;
    void (async () => {
      for (let at = 0; at <= recordedRevision && !stopped; at++)
        await readSnapshot(sessionId, at).catch(() => undefined);
      // The newest moment is shown as the live view, which is cached under its own key.
      if (!stopped) await readSnapshot(sessionId).catch(() => undefined);
    })();
    return () => {
      stopped = true;
    };
  }, [sessionId, recordedRevision]);
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
          person: "daniel",
          view: null,
          eval: null,
          study: null,
          panel: sessionId ? null : panel,
          chat: sessionId ? null : params.get("chat"),
        },
        !sessionId,
      );
      setError("");
      setSessionUnavailable(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!sessionId && !created.current) {
      created.current = true;
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("bt:last-session");
      } catch {}
      if (saved) change({ session: saved }, true);
      else void newSession();
    }
  }, [sessionId]);
  useEffect(() => {
    setSnapshot(old => sessionId ? cachedSnapshot(sessionId, cutoff) || (old?.session.id===sessionId ? old : null) : null);
    setSessionUnavailable(false);
    void refresh();
    return () => {
      request.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (!sessionId || sessionUnavailable) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const delay = document.hidden ? 30000 : await refresh(true);
      if (!stopped && delay !== false) timer = setTimeout(poll, delay || 30000);
    };
    timer = setTimeout(poll, snapshot?.pendingJobs ? 2000 : 30000);
    const resume = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh, sessionUnavailable, Boolean(snapshot?.pendingJobs)]);
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
      invalidateSnapshot(snapshot.session.id);
      await refresh(true);
      return true;
    } catch (e) {
      setError((e as Error).message);
      setPlaying(false);
    } finally {
      setBusy(false);
    }
  }, [snapshot, busy, refresh]);
  useEffect(() => {
    if (presenting || !playing || !snapshot || busy || snapshot.pendingJobs)
      return;
    if (!snapshot.nextStep || snapshot.nextStep === "confirm") {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => void advance(), 2200);
    return () => clearTimeout(timer);
  }, [
    presenting,
    playing,
    snapshot?.session.step,
    snapshot?.pendingJobs,
    busy,
    advance,
  ]);
  const openPanel = (id: PanelId | null) => {
    setPlaying(false);
    change({ panel: id, view: null, eval: null, study: null });
  };
  const inspect = (e: SourceEvent) => setInspected(e);
  const choosePerson = (next: PersonId) => change({ person: next });
  const goChapter = (at: number) => {
    setPlaying(false);
    change({ at: String(at) });
  };
  /** → moves the clock: replay a recorded moment, or record the next signal. */
  const nextMoment = async () => {
    if (!snapshot || busy || view?.status !== "ready" || error) return;
    if (snapshot.cutoff < snapshot.session.revision)
      goChapter(snapshot.cutoff + 1);
    else if (snapshot.nextStep && (await advance())) change({ at: null });
  };
  const previousMoment = () => {
    if (!busy && snapshot && snapshot.cutoff > 0) goChapter(snapshot.cutoff - 1);
  };
  useEffect(() => {
    if (!presenting || openingMoment) return;
    const key = (event: KeyboardEvent) => {
      const target =
        event.target instanceof Element ? event.target : document.body;
      if (
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        target.closest(
          'input,textarea,select,[contenteditable="true"],[role="textbox"],dialog,.eve-chat,.eve-voice',
        ) ||
        (target.closest("button,a") && !target.closest(".spine,.lanes")) ||
        document.querySelector("dialog[open]")
      )
        return;
      if (focused) {
        if (event.key === "Escape") {
          event.preventDefault();
          openPanel(null);
        }
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void nextMoment();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousMoment();
      }
      if (["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        choosePerson((["daniel", "sam", "maya"] as const)[Number(event.key) - 1]);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const renderPanels = (snapshot: Snapshot | null) => {
    const h = snapshot?.households.find((h) => h.id === person);
    const decision = snapshot?.decisions
      .filter((d) => d.person === person)
      .at(-1);
    const actions = snapshot?.actions.filter((a) => a.person === person) || [];
    const pending = !!snapshot?.pendingJobs;
    const current = !!snapshot && snapshot.session.id === sessionId;
    const evidence = h?.evidence.filter((e) => e.subject === person) || [];
    const relevantEvidence = evidence.filter(
      (e) => e.type !== "contact.authority_recorded",
    );

    const customer = h && (
      <Panel id="customer" panel={panel} onOpen={openPanel} storyFocus={changedPanels.includes("customer")}>
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
        <NoteList facts={memoryFacts(h)} />
        {snapshot && <Rhythm snapshot={snapshot} person={person} />}
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
      </Panel>
    );
    const operations = h && snapshot && (
      <Panel id="operations" panel={panel} onOpen={openPanel} storyFocus={changedPanels.includes("operations")}>
        <NoteList facts={operationsFacts(h, snapshot)} />
        <Section title="Affected-service register" note="explicit membership">
          <div className="scope-table">
            {snapshot.households.map((p) => (
              <button
                key={p.id}
                className={person === p.id ? "selected" : ""}
                onClick={() => choosePerson(p.id)}
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
      <Panel id="phone" panel={panel} onOpen={openPanel} storyFocus={changedPanels.includes("phone")}>
        <PhoneExperience
          key={`${snapshot.session.id}/${person}/${cutoff ?? "live"}`}
          snapshot={snapshot}
          customer={h}
          actions={actions}
          startChat={params.get("chat") === "eve"}
          busy={busy || pending || !!error}
          onConfirm={() => void (presenting ? nextMoment() : advance())}
          onSupport={() => setPlaying(false)}
        />
      </Panel>
    );
    const arbiter = h && snapshot && (
      <Panel id="arbiter" panel={panel} onOpen={openPanel} storyFocus={changedPanels.includes("arbiter")}>
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
            <NoteList facts={governanceFacts(h, decision)} />
            <div className="held-action">
              <span className="tag amber">held</span>
              <span>
                {
                  (
                    decision.held.find(
                      (c) => c.title === "Repeat hub restart",
                    ) || decision.held[0]
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
              Play the evening. At 21:00 the same alarm fires for three homes,
              and each gets a different response.
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
      <Panel id="actions" panel={panel} onOpen={openPanel} storyFocus={changedPanels.includes("actions")}>
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
    const reviewPanel = h && snapshot && (
      <Panel id="review" panel={panel} onOpen={openPanel}>
        <SwayTile />
      </Panel>
    );
    const governancePanel = h && snapshot && (
      <Panel id="governance" panel={panel} onOpen={openPanel}>
        <GovernanceTile snapshot={snapshot} />
      </Panel>
    );
    return {
      h,
      decision,
      actions,
      pending,
      current,
      customer,
      operations,
      phone,
      arbiter,
      actionPanel,
      reviewPanel,
      governancePanel,
    };
  };
  const {
    h,
    decision,
    actions,
    pending,
    current,
    customer,
    operations,
    phone,
    arbiter,
    actionPanel,
    reviewPanel,
    governancePanel,
  } = renderPanels(snapshot);
  return (
    <>
      <a className="skip" href="#workspace">
        Skip to workspace
      </a>
      <header className={`topbar${focused ? " focus-topbar" : ""}`}>
        <div className="identity">
          <img src={btLogo} alt="BT" />
          <span>
            Experience intelligence<small>BT Consumer</small>
          </span>
        </div>
        {focused ? (
          <nav className="crumbs" aria-label="Breadcrumb">
            <button onClick={() => openPanel(review ? "review" : null)}>
              ← {review ? "Agent review" : "Account"}
            </button>
            <span aria-hidden="true">/</span>
            <strong>
              {review ? "Response wording" : records ? "Source records" : panelNames[panel!]}
            </strong>
          </nav>
        ) : (
          <nav aria-label="Main">
            <button aria-current={!records ? "page" : undefined} onClick={() => change({ view: null, panel: null })}>
              Account
            </button>
            <button
              aria-current={records ? "page" : undefined}
              onClick={() => {
                setPlaying(false);
                change({ view: "records", panel: null });
              }}
            >
              Source records
            </button>
          </nav>
        )}
        <span className="runtime-badge" title={snapshot?.storage === "supabase" ? "Supabase runtime" : "Local runtime"}>
          <i className={error ? "offline" : ""} />
          {sessionUnavailable ? "Session unavailable" : error ? "Connection issue" : snapshot?.storage === "supabase" ? "Live" : "Local"}
        </span>
      </header>
      {!focused && presenting && !future && (
        <MomentSpine
          snapshot={snapshot}
          status={view?.status ?? null}
          busy={busy || !!error}
          opening={openingMoment}
          target={cutoff ?? (snapshot?.session.id === sessionId ? snapshot?.session.revision : undefined)}
          onGo={goChapter}
          onNext={() => void nextMoment()}
          onBack={previousMoment}
          onExplore={() => {
            setPlaying(false);
            change({ mode: "explore", person });
          }}
          onRestart={() => void newSession()}
          onFuture={() => change({ view: "future" })}
        />
      )}
      {!focused && !presenting && (
        <div className="replay-bar">
          <div className="scenario-time">
            <span>{snapshot && snapshot.cutoff >= 6 ? "THE WEEKS AFTER" : "THREE HOMES, ONE EVENING"}</span>
            <strong>{snapshot ? moments[snapshot.cutoff].time : "20:45"}</strong>
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
                : error
                  ? "Session unavailable"
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
                {moments[i].time} · {name}
              </option>
            ))}
          </select>
          <div className="presentation-mode" aria-label="Demo mode">
            <button
              aria-pressed={false}
              onClick={() => {
                setPlaying(false);
                change({ mode: "present" });
              }}
            >
              Present
            </button>
            <button aria-pressed onClick={() => {}}>
              Explore
            </button>
          </div>
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
              title="Start a fresh run of the scenario from 20:45. Earlier runs are kept."
            >
              ↺ <span>Restart</span>
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>
            {sessionUnavailable
              ? "This replay isn’t in the current data store. Restart to begin a fresh run."
              : error}
          </span>
          <button
            disabled={busy}
            onClick={() => void (sessionUnavailable ? newSession() : refresh())}
          >
            {sessionUnavailable
              ? busy
                ? "Restarting…"
                : "Restart the scenario"
              : "Retry connection"}
          </button>
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
        aria-busy={openingMoment}
        inert={openingMoment ? true : undefined}
        id="workspace"
        className={
          focused
            ? `focused-workspace${panel === "customer" ? " customer-focus" : panel === "phone" ? " phone-focus" : panel === "arbiter" ? " arbiter-focus" : panel === "operations" ? " operations-focus" : panel === "actions" || panel === "governance" || review ? " actions-focus" : ""}`
            : `account-workspace${presenting ? " presentation-workspace" : ""}`
        }
      >
        {(!presenting || focused) && !["review", "actions", "operations", "customer", "arbiter", "phone", "governance"].includes(panel ?? "") && (
          <div className="workspace-intro">
            <div>
              <p className="eyebrow">
                {review
                  ? "Evaluation / recorded behaviour"
                  : records
                    ? "Evidence / append-only source ledger"
                    : panel
                      ? "Account / " + panelNames[panel]
                      : "One alarm · three different homes"}
              </p>
              <h1>
                {review
                  ? "Agent review"
                  : records
                    ? "Read the records behind the experience."
                    : panel
                      ? panel === "customer"
                        ? "Knowing your customer."
                        : panelNames[panel]
                      : "The next move depends on what we know."}
              </h1>
            </div>
          </div>
        )}
        {focused && ["review", "actions", "operations", "customer", "arbiter", "phone", "governance"].includes(panel ?? "") ? null : focused ? (
          <div className="focused-context">
            <strong>{review ? "Replay corpus" : names[person]}</strong>
            <code>
              {review
                ? "Three households · completed runs"
                : h?.serviceId ||
                  (error ? "Service unavailable" : "Loading service…")}
            </code>
            <span>
              {snapshot
                ? `${formatTime(snapshot.clock)} · ${snapshot.historical ? "Historical snapshot" : "Current snapshot"} · rev ${snapshot.cutoff}`
                : error
                  ? "Snapshot unavailable"
                  : "Loading snapshot…"}
            </span>
          </div>
        ) : future ? null : presenting && !(snapshot && view) ? (
          <MomentSkeleton />
        ) : presenting && snapshot && view ? (
          <MomentLanes
            key={`${snapshot.session.id}/${snapshot.cutoff}`}
            snapshot={snapshot}
            view={view}
            focus={person}
            onFocus={choosePerson}
            onInspect={inspect}
            compare={params.get("compare") === "1"}
            onCompare={(on) => change({ compare: on ? "1" : null })}
            onOpen={(panel) => openPanel(panel as PanelId)}
            phone={phone}
          />
        ) : (
          <div className="household-bar">
            <div className="people">
              {Object.entries(names).map(([id, name]) => (
                <button
                  key={id}
                  aria-pressed={person === id}
                  onClick={() => choosePerson(id as PersonId)}
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
                  <span title={`Replay ${snapshot.session.id}`}>
                    {pending
                      ? "Arbiter deciding…"
                      : snapshot.historical
                        ? "Looking back · read only"
                        : "Replay saved"}
                  </span>
                </>
              ) : error ? (
                "Session unavailable"
              ) : (
                "Opening session…"
              )}
            </div>
          </div>
        )}
        {(!snapshot || !h) && presenting && !focused && !error ? null : !snapshot || !h ? (
          <div className="loading">
            <Glyph />
            <p>
              {error
                ? "The data model could not be loaded."
                : "Loading the data model…"}
            </p>
          </div>
        ) : future ? (
          <FutureView onBack={() => change({ view: null })} />
        ) : review ? (
          <AgentReview
            snapshot={snapshot}
            controlled={params.get("study") === "controls"}
          />
        ) : records ? (
          <section className="ledger">
            <header>
              <h2>Source events</h2>
              <span>
                {snapshot.events.length} records visible · cutoff{" "}
                {formatTime(snapshot.clock)}
              </span>
            </header>
            <label
              style={{
                display: "flex",
                gap: 12,
                padding: "10px 16px",
                alignItems: "center",
              }}
            >
              Filter records{" "}
              <input
                aria-label="Filter source records"
                placeholder="Person, source or event type"
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setSourceLimit(100);
                }}
              />{" "}
              <button onClick={() => setSourceLimit((n) => n + 100)}>
                Show 100 more
              </button>
            </label>
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
                  {[...snapshot.events]
                    .reverse()
                    .filter((e) =>
                      `${e.subject} ${e.type} ${e.description} ${e.source}`
                        .toLowerCase()
                        .includes(sourceFilter.toLowerCase()),
                    )
                    .slice(0, sourceLimit)
                    .map((e) => (
                      <tr key={e.id}>
                        <td>
                          {formatTime(e.occurredAt)}
                          <small>
                            {new Date(e.occurredAt).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}{" "}
                            · known {formatTime(e.receivedAt)}
                          </small>
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
        ) : panel === "review" ? (
          <SwayReview
            onLegacy={() => change({ view: "agent-review", panel: null })}
          />
        ) : panel ? (
          <SectionView
            onCutoff={(at) =>
              change({
                at: at === snapshot.session.revision ? null : String(at),
              })
            }
            panel={panel}
            onPerson={choosePerson}
            h={h}
            snapshot={snapshot}
            decision={decision}
            actions={actions}
            phone={phone}
            inspect={inspect}
          />
        ) : presenting && view ? null : (
          <div className={presenting ? "presentation-stage" : ""}>
            <div className="overview">
              <div className="panel-stack left-stack">
                {customer}
                {operations}
                {governancePanel}
              </div>
              {phone}
              <div className="panel-stack right-stack">
                {arbiter}
                {actionPanel}
                {reviewPanel}
              </div>
            </div>
            {presenting && (
              <div className="governance-receipt">
                <strong>DECISION RECEIPT</strong>
                <span>
                  {decision?.policyVersion || "Awaiting first decision"}
                </span>
                <span>Owner: {h.owner || "Automated observation"}</span>
                <span>{decision?.evidenceIds.length || 0} linked records</span>
                <button onClick={() => openPanel("arbiter")}>
                  Inspect policy & execution ↗
                </button>
              </div>
            )}
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
            {snapshot
              ? `${snapshot.storage === "supabase" ? "Supabase" : "SQLite"} + server worker`
              : "Runtime not loaded"}{" "}
            <b>·</b> Eve / OpenAI on demand
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
