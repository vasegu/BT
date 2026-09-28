import type { Snapshot, PersonId, SourceEvent } from "./types";
import { householdNames, moments } from "./presentation";
import type { MomentLane, momentView } from "./presentation";
import "./presentation.css";

const roles: Record<PersonId, string> = {
  daniel: "Recovery + a promise",
  sam: "A first connection",
  maya: "A quiet evening",
};
const initials = (person: PersonId) =>
  householdNames[person]
    .split(" ")
    .map((w) => w[0])
    .join("");
const first = (person: PersonId) => householdNames[person].split(" ")[0];
const quietByDesign = (lane: MomentLane) =>
  lane.decision?.disposition === "watch" ||
  lane.decision?.disposition === "suppress";

/** The clock is the presenter's only navigation: each stop is one signal. */
export function MomentSpine({
  snapshot,
  status,
  busy,
  onGo,
  onNext,
  onBack,
  onExplore,
  onRestart,
}: {
  snapshot: Snapshot | null;
  status: ReturnType<typeof momentView>["status"] | null;
  busy: boolean;
  onGo: (at: number) => void;
  onNext: () => void;
  onBack: () => void;
  onExplore: () => void;
  onRestart: () => void;
}) {
  const at = snapshot?.cutoff ?? 0;
  const recorded = snapshot?.session.revision ?? 0;
  const last = at === moments.length - 1;
  return (
    <div className="spine" role="navigation" aria-label="Scenario clock">
      <div className="spine-clock">
        <span>THREE QUIET ROUTERS</span>
        <strong>{snapshot ? moments[at].time : "--:--"}</strong>
      </div>
      <ol className="spine-track">
        {moments.map((m, i) => (
          <li
            key={m.time}
            className={
              i === at ? "is-current" : i < at ? "is-past" : i <= recorded ? "is-recorded" : ""
            }
          >
            <button
              disabled={!snapshot || busy || i > recorded}
              aria-current={i === at ? "step" : undefined}
              onClick={() => onGo(i)}
              title={i > recorded ? "Not played yet" : m.title}
            >
              <time>{m.time}</time>
              <span>{m.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="spine-controls">
        <button onClick={onBack} disabled={!snapshot || busy || at === 0} aria-label="Previous moment">
          ←
        </button>
        <button
          className="primary"
          onClick={last ? onRestart : onNext}
          disabled={!snapshot || busy || status !== "ready"}
        >
          {status === "deciding" || busy
            ? "Deciding…"
            : last
              ? "↺ Run it again"
              : `${moments[at + 1].time} →`}
        </button>
      </div>
      <div className="spine-meta">
        <button className="link" onClick={onExplore}>
          Explore
        </button>
        <button className="link" onClick={onRestart} disabled={busy} title="Start a fresh run of the scenario from 20:45">
          ↺ Restart
        </button>
      </div>
    </div>
  );
}

export function MomentLanes({
  snapshot,
  view,
  focus,
  onFocus,
  onInspect,
}: {
  snapshot: Snapshot;
  view: ReturnType<typeof momentView>;
  focus: PersonId;
  onFocus: (person: PersonId) => void;
  onInspect: (e: SourceEvent) => void;
}) {
  const { moment, lanes, status, signals } = view;
  const final = snapshot.cutoff === moments.length - 1;
  return (
    <section className="moment" aria-live="polite">
      <header className="moment-head">
        <span className="eyebrow">
          {moment.time} · Moment {snapshot.cutoff + 1} of {moments.length}
        </span>
        <div className="moment-title-row">
          <h1>{moment.title}</h1>
          {signals.length > 0 && (
            <div className="moment-signals" aria-label="Source signals at this moment">
              {[...new Set(signals.map((e) => e.type))].map((type) => [type, signals.filter((e) => e.type === type)] as const).map(([type, events]) => (
                <span key={type} className="signal-chip">
                  <i className={`sig sig-${events[0].subject}`} />
                  <code>{type}</code>
                  {events.map((e) => (
                    <button key={e.id} onClick={() => onInspect(e)} title={e.description}>
                      {e.subject === "shared" ? "operations" : first(e.subject as PersonId)}
                    </button>
                  ))}
                </span>
              ))}
            </div>
          )}
        </div>
        <p>{moment.lead}</p>
        {moment.proves && (
          <p className="moment-proves">
            <span>{moment.proves.component}</span>
            {moment.proves.detail}
          </p>
        )}
      </header>
      {status === "failed" && (
        <div className="moment-alert" role="alert">
          A decision job failed. The source events are kept and the worker retries up to three times.
          Switch to Explore to inspect it.
        </div>
      )}
      <div className="lanes">
        {lanes.map((lane) => (
          <Lane
            key={lane.person}
            lane={lane}
            deciding={status === "deciding"}
            final={final}
            focused={focus === lane.person}
            opening={snapshot.cutoff === 0}
            onFocus={() => onFocus(lane.person)}
          />
        ))}
      </div>
      {final && status === "ready" && (
        <footer className="moment-close">
          <span className="eyebrow">One system, not five projects</span>
          <p>
            Memory that persists, a reasoning engine that reads it, a governed action a named
            human owns, and a loop that writes the outcome back. Each is close to useless without
            the others — which is why this is one architecture, not five initiatives.
          </p>
        </footer>
      )}
    </section>
  );
}

function Lane({
  lane,
  deciding,
  final,
  focused,
  opening,
  onFocus,
}: {
  lane: MomentLane;
  deciding: boolean;
  final: boolean;
  focused: boolean;
  opening: boolean;
  onFocus: () => void;
}) {
  const { person, decision, previous, changed, message, lastMessage, outcome } = lane;
  const state = deciding
    ? "deciding"
    : opening
      ? "context"
      : !lane.involved
        ? "unchanged"
        : changed || message
          ? "changed"
          : "touched";
  return (
    <article
      className={`lane lane-${person} is-${state}${focused ? " is-focused" : ""}`}
      onClick={onFocus}
    >
      <header>
        <span className="lane-avatar">{initials(person)}</span>
        <div>
          <strong>{householdNames[person]}</strong>
          <small>{roles[person]}</small>
        </div>
        <span className={`lane-tag tag-${state}`}>
          {
            {
              deciding: "Deciding",
              context: "History",
              unchanged: "No change",
              changed: changed ? "New decision" : "Message sent",
              touched: "Evidence",
            }[state]
          }
        </span>
      </header>

      <p className="lane-reading">{outcome.title}</p>

      <div className="lane-block">
        <span className="eyebrow">Arbiter</span>
        {deciding ? (
          <div className="lane-thinking">
            <i />
            Assessing {first(person)}’s context…
          </div>
        ) : decision ? (
          <>
            {changed && previous && (
              <del className="lane-was">{previous.title}</del>
            )}
            <strong className="lane-decision">{decision.title}</strong>
            <p className="lane-reason">{decision.reason}</p>
          </>
        ) : (
          <p className="lane-reason">No decision yet. The history is read when a signal arrives.</p>
        )}
      </div>

      <div className="lane-block">
        <span className="eyebrow">{first(person)} sees</span>
        {deciding ? (
          <div className="lane-sees is-empty">—</div>
        ) : message ? (
          <div className="lane-sees">
            <small>My BT · {moments[message.revision]?.time}</small>
            <b>{message.title}</b>
            <span>{message.body}</span>
          </div>
        ) : decision && quietByDesign(lane) ? (
          <div className="lane-sees is-quiet">Nothing. The quiet is the right answer.</div>
        ) : (
          <div className="lane-sees is-empty">
            No new message{lastMessage ? ` · last: “${lastMessage.title}”` : ""}
          </div>
        )}
      </div>

      {final && !deciding && (
        <dl className="lane-proof">
          {outcome.proof.slice(0, 3).map((p) => (
            <div key={p.id}>
              <dt>{p.title}</dt>
              <dd className={p.check.status}>
                {p.check.status === "met" ? "Observed" : p.check.status === "waiting" ? "Awaiting proof" : p.check.status}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <footer>{focused ? "Panels below show this home" : `Show ${first(person)} below ↓`}</footer>
    </article>
  );
}

/** Shown while the replay loads, in the same shape as the moment, so nothing old flashes. */
export function MomentSkeleton() {
  return (
    <section className="moment is-loading" aria-busy="true" aria-label="Loading the scenario">
      <header className="moment-head">
        <div>
          <span className="skel skel-eyebrow" />
          <span className="skel skel-title" />
          <span className="skel skel-line" />
        </div>
      </header>
      <div className="lanes">
        {(["daniel", "sam", "maya"] as PersonId[]).map((p) => (
          <article key={p} className={`lane lane-${p} is-skeleton`}>
            <header>
              <span className="lane-avatar">{initials(p)}</span>
              <div>
                <strong>{householdNames[p]}</strong>
                <small>{roles[p]}</small>
              </div>
            </header>
            <span className="skel skel-line" />
            <span className="skel skel-block" />
            <span className="skel skel-block" />
          </article>
        ))}
      </div>
    </section>
  );
}
