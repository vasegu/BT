import { useEffect, useState } from "react";
import { BehaviourSpace, useBehaviourSpace } from "./BehaviourSpace";
import "./operations.css";
import type { Household, PersonId, Snapshot, SourceEvent, Decision, OutcomeEpisode } from "./types";
import { moments } from "./presentation";
import { PromiseTimeline } from "./PromiseTimeline";
import { FocusHeader } from "./FocusHeader";
import "./actions-view.css";

// Actions & outcomes, expanded. One question: what did we do for this customer, and did it work?
// "Context → action" reads one moment as a chain (knew → could do → did → did it work).
// "Outcome evidence" reads the whole evening: promises, recovery and what was proven.
const ambient = new Set(["router.observation_window", "router.overnight_window", "conversation.message", "contact.authority_recorded"]);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const at = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const statusLabel: Record<string, string> = {
  met: "Observed",
  waiting: "Awaiting proof",
  unverified: "Not verified",
  contradicted: "Contradicted",
};

export function ActionsView({
  h,
  snapshot,
  inspect,
  onCutoff,
  onPerson,
}: {
  h: Household;
  snapshot: Snapshot;
  inspect: (e: SourceEvent) => void;
  onCutoff: (at: number) => void;
  onPerson: (p: PersonId) => void;
}) {
  const [tab, setTab] = useState<"context" | "outcome">("context");
  const space = useBehaviourSpace(snapshot);
  const first = h.name.split(" ")[0];
  const outcomes = snapshot.operations.outcomes.filter((o) => o.person === h.id);
  const verified = outcomes.filter((o) => o.check.status === "met").length;
  const decision = snapshot.decisions.filter((d) => d.person === h.id && d.revision <= snapshot.cutoff).at(-1);
  return (
    <div className="av">
      <FocusHeader
        panel="Actions & outcomes"
        question={`${first}: what did we do, and did it work?`}
        snapshot={snapshot}
        person={h.id}
        stat={{
          value: (
            <>
              {verified}
              <span> / {outcomes.length}</span>
            </>
          ),
          label: "outcomes proven",
        }}
        onPerson={onPerson}
        onCutoff={onCutoff}
      >
        <div className="av-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "context"} onClick={() => setTab("context")}>
            Context → action
          </button>
          <button role="tab" aria-selected={tab === "outcome"} onClick={() => setTab("outcome")}>
            Outcome evidence
          </button>
        </div>
      </FocusHeader>

      {tab === "context" ? (
        <Chain
          key={`${h.id}/${snapshot.cutoff}`}
          h={h}
          snapshot={snapshot}
          decision={decision}
          space={space}
          inspect={inspect}
          onOutcome={() => setTab("outcome")}
        />
      ) : (
        <Outcome h={h} snapshot={snapshot} outcomes={outcomes} inspect={inspect} />
      )}
    </div>
  );
}

function Step({ n, title, children, className = "" }: { n: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`av-step ${className}`}>
      <header>
        <span>{n}</span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

function Chain({
  h,
  snapshot,
  decision,
  space,
  inspect,
  onOutcome,
}: {
  h: Household;
  snapshot: Snapshot;
  decision?: Decision;
  space: ReturnType<typeof useBehaviourSpace>;
  inspect: (e: SourceEvent) => void;
  onOutcome: () => void;
}) {
  // B = this household's decision at this moment; A = its previous decision, so the fan shows what shifted.
  const previous = snapshot.decisions.filter((d) => d.person === h.id && decision && d.revision < decision.revision).at(-1);
  const [selectedId, setSelectedId] = useState(decision?.id);
  const [referenceId, setReferenceId] = useState(previous?.id);
  useEffect(() => {
    setSelectedId(decision?.id);
    setReferenceId(previous?.id);
  }, [decision?.id, previous?.id]);
  if (!decision)
    return (
      <div className="av-empty">
        No decision yet at {moments[snapshot.cutoff].time}. Move to 21:00, when the first signal arrives, to follow the chain.
      </div>
    );
  const runs = space.data?.runs || [];
  const run = runs.find((r) => r.id === selectedId) || runs.find((r) => r.id === decision.id);
  const reference = runs.find((r) => r.id === referenceId && r.id !== run?.id);
  const contrast = space.data?.contrasts.find(
    (c) => (c.a === reference?.id && c.b === run?.id) || (c.b === reference?.id && c.a === run?.id),
  );
  // "What it did" and "Did it work" follow whichever decision is selected as B.
  const shown = snapshot.decisions.find((d) => d.id === run?.id) || decision;
  const who = snapshot.households.find((p) => p.id === shown.person) || h;
  const current = shown.revision === snapshot.cutoff;
  const fresh = snapshot.events.filter(
    (e) => e.revision === shown.revision && !ambient.has(e.type) && (e.subject === who.id || e.subject === "shared"),
  );
  const commit = shown.trace?.execution.find((x) => x.stage === "Atomic commit");
  const action = snapshot.actions.find((a) => a.decisionId === shown.id);
  const outcomes = snapshot.operations.outcomes.filter((o) => o.person === who.id);
  const created = outcomes.filter((o) => o.decisionId === shown.id);
  // Plans this decision committed to; otherwise everything on record for the household, open first.
  const checks = created.length
    ? created
    : [...outcomes].sort((a, b) => Number(a.check.status === "met") - Number(b.check.status === "met"));
  const quiet = shown.disposition === "watch" || shown.disposition === "suppress";
  return (
    <div className="av-chain">
      <Step n="01" title="From context to action" className="av-step-space">
        <div className="av-context-line">
          {!current && <span className="av-carried">No new decision at {moments[snapshot.cutoff].time}; showing {moments[shown.revision].time}.</span>}
          {fresh.map((e) => (
            <button key={e.id} className="av-signal" onClick={() => inspect(e)} title={e.description}>
              <i />
              New at {moments[shown.revision].time}: <code>{e.type}</code>
            </button>
          ))}
        </div>
        {space.data ? (
          <BehaviourSpace
            data={space.data}
            selected={run}
            reference={reference}
            contrast={contrast}
            select={setSelectedId}
            setReference={setReferenceId}
            filter="all"
          />
        ) : (
          <div className="av-empty">{space.error || "Placing every recorded context on the map…"}</div>
        )}
      </Step>
      <i className="av-arrow" aria-hidden="true" />
      <Step n="02" title="What it did">
        <span className="av-who">
          {who.name} · {moments[shown.revision].time}
        </span>
        <strong className="av-decision">{shown.title}</strong>
        <p className="av-reason">{shown.reason}</p>
        {action ? (
          <div className="av-message">
            <small>My BT · {at(action.time)} · receipt {action.receiptId?.slice(0, 8) || "pending"}</small>
            <b>{action.title}</b>
            <span>{action.body}</span>
          </div>
        ) : (
          <div className={`av-message is-none${quiet ? " is-quiet" : ""}`}>
            {commit?.status === "deduplicated"
              ? "Already sent earlier. Not repeated."
              : quiet
                ? "No message. The quiet is the right answer."
                : "No new customer message at this moment."}
          </div>
        )}
      </Step>
      <i className="av-arrow" aria-hidden="true" />
      <Step n="03" title="Did it work?">
        {checks.length ? (
          <ul className="av-checks">
            {checks.slice(0, 5).map((o) => (
              <li key={o.id} className={`is-${o.check.status}`}>
                <span>{statusLabel[o.check.status]}</span>
                <b>{o.title}</b>
                <small>{o.check.status === "met" && o.check.observedAt ? `Seen ${at(o.check.observedAt)}` : `Due ${at(o.dueAt)}`}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="av-reason">Nothing to prove yet for this decision.</p>
        )}
        <button className="av-link" onClick={onOutcome}>
          See the whole evening →
        </button>
      </Step>
    </div>
  );
}

function Outcome({
  h,
  snapshot,
  outcomes,
  inspect,
}: {
  h: Household;
  snapshot: Snapshot;
  outcomes: OutcomeEpisode[];
  inspect: (e: SourceEvent) => void;
}) {
  const event = (id: string) => snapshot.events.find((e) => e.id === id);
  return (
    <div className="av-outcome">
      <PromiseTimeline snapshot={snapshot} person={h} onInspect={inspect} />
      <section className="av-proofs">
        <header>
          <h3>Expected → observed</h3>
          <span>Each committed plan states what should change and when. Only a later source record can prove it.</span>
        </header>
        {!outcomes.length && <p className="av-empty">No committed plans yet at {moments[snapshot.cutoff].time}.</p>}
        <div className="av-proof-grid">
          {outcomes.map((o) => (
            <article key={o.id} className={`av-proof is-${o.check.status}`}>
              <div className="av-proof-head">
                <span>{statusLabel[o.check.status]}</span>
                <small>
                  set {at(o.createdAt)} · due {at(o.dueAt)}
                </small>
              </div>
              <b>{o.title}</b>
              <p>
                <em>Expected:</em> {o.target}
              </p>
              <p>
                <em>Observed:</em> {o.check.finding}
              </p>
              {o.check.nextDecision && (
                <p className="av-next">
                  <em>Next time:</em> {o.check.nextDecision}
                </p>
              )}
              {o.check.evidenceIds.length > 0 && (
                <div className="av-proof-evidence">
                  {o.check.evidenceIds.map((id) => {
                    const e = event(id);
                    return e ? (
                      <button key={id} onClick={() => inspect(e)}>
                        {e.type} ↗
                      </button>
                    ) : null;
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
