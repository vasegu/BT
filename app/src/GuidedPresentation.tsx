import type { ReactNode } from "react";
import { PresenterWorkspace } from "./PresenterWorkspace";
import type { Snapshot, PersonId, SourceEvent } from "./types";
import { householdNames, moments, chapters, storyValue, householdOutcome } from "./presentation";
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

/** The clock is the presenter's only navigation: each stop is one moment in the story. */
export function MomentSpine({
  snapshot,
  status,
  busy,
  onGo,
  onNext,
  onBack,
  onExplore,
  onRestart,
  onFuture,
  target,
  opening = false,
}: {
  snapshot: Snapshot | null;
  status: ReturnType<typeof momentView>["status"] | null;
  busy: boolean;
  /** The moment asked for; the clock moves to it at once, before its snapshot arrives. */
  target?: number;
  /** A recorded moment is loading: nothing is being decided. */
  opening?: boolean;
  onGo: (at: number) => void;
  onNext: () => void;
  onBack: () => void;
  onExplore: () => void;
  onRestart: () => void;
  /** A separate future-vision mode, apart from tonight's story. */
  onFuture?: () => void;
}) {
  const at = target ?? snapshot?.cutoff ?? 0;
  const recorded = snapshot?.session.revision ?? 0;
  const last = at === moments.length - 1;
  return (
    <div className="spine" role="navigation" aria-label="Scenario clock">
      <div className="spine-chapters">
        {chapters.map((ch) => (
          <div key={ch.title} className={`spine-chapter${at >= ch.from && at <= ch.to ? " is-here" : ""}`}>
            <small>{ch.title}</small>
            <ol className="spine-track" style={{ gridTemplateColumns: `repeat(${ch.to - ch.from + 1}, 1fr)` }}>
              {moments.slice(ch.from, ch.to + 1).map((m, k) => {
                const i = ch.from + k;
                return (
                  <li key={m.time} className={i === at ? "is-current" : i < at ? "is-past" : i <= recorded ? "is-recorded" : ""}>
                    <button
                      disabled={!snapshot || busy || opening || i > recorded}
                      aria-current={i === at ? "step" : undefined}
                      onClick={() => onGo(i)}
                      title={i > recorded ? "Not played yet" : m.title}
                    >
                      <time>{m.time.replace(/ \d\d:\d\d$/, "")}</time>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
      <div className="spine-controls">
        <button onClick={onBack} disabled={!snapshot || busy || opening || at === 0} aria-label="Previous moment">
          ←
        </button>
        <button
          className="primary"
          onClick={onNext}
          disabled={!snapshot || busy || opening || last || status !== "ready"}
        >
          {opening
            ? "Opening…"
            : status === "deciding" || busy
            ? "Deciding…"
            : last
              ? "End of story"
              : `${moments[at + 1].time} →`}
        </button>
      </div>
      <div className="spine-meta">
        <button className="link" onClick={onExplore}>
          Explore
        </button>
        {onFuture && (
          <button className="link" onClick={onFuture} title="A future vision: a customer’s own AI agent talks to BT’s agent">
            2030 vision
          </button>
        )}
        <button className="link" onClick={onRestart} disabled={busy} title="Start a fresh run of the scenario from 20:45">
          ↺ Restart
        </button>
      </div>
    </div>
  );
}

/** The human events behind each home before tonight's signal, from the records themselves:
 *  the open case and what was tried, then the latest conversation (acknowledgements left out). */
function storySoFar(snapshot: Snapshot, person: PersonId) {
  const clock = Date.parse(snapshot.clock);
  const today = new Date(clock).toDateString();
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const opts = { timeZone: "Europe/London" } as const;
    return d.toDateString() === today
      ? d.toLocaleTimeString("en-GB", { ...opts, hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("en-GB", { ...opts, day: "numeric", month: "short" });
  };
  const known = snapshot.events.filter((e) => e.subject === person && Date.parse(e.receivedAt) <= clock);
  const opened = known.filter((e) => e.type === "case.opened").at(-1);
  const since = opened ? Date.parse(opened.occurredAt) : 0;
  const setupCase = (opened?.payload as { owner?: string } | undefined)?.owner === "Activation team";
  const caseWork = known.filter(
    (e) =>
      e === opened ||
      (e.type === "diagnostic.completed" && Date.parse(e.occurredAt) >= since) ||
      e.type === "line.drops_detected" ||
      (e.type === "order.delivered" && setupCase),
  );
  const said = known.filter((e) => e.type === "conversation.message" && !/^thank/i.test(e.description));
  const todays = said.filter((e) => new Date(e.occurredAt).toDateString() === today);
  const talk = todays.length ? todays : said.slice(-2);
  return [...caseWork, ...talk]
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    .slice(-6)
    .map((e) => {
      const p = e.payload as { speakerRole?: string; speaker?: string };
      const who = e.type === "conversation.message" ? (p.speakerRole === "customer" ? first(person) : p.speaker ?? "BT") : null;
      return { at: fmt(e.occurredAt), text: who ? `${who}: “${e.description}”` : e.description };
    });
}

export function MomentLanes({
  snapshot,
  view,
  focus,
  onFocus,
  onInspect,
  compare = false,
  onCompare,
  onOpen,
  phone,
}: {
  snapshot: Snapshot;
  view: ReturnType<typeof momentView>;
  focus: PersonId;
  onFocus: (person: PersonId) => void;
  onInspect: (e: SourceEvent) => void;
  /** Show all three homes side by side instead of one at a time. */
  compare?: boolean;
  onCompare?: (on: boolean) => void;
  onOpen?: (panel: string) => void;
  /** The chosen customer's phone, shown beside their story. */
  phone?: ReactNode;
}) {
  const { moment, lanes, status, signals } = view;
  const final = snapshot.cutoff === moments.length - 1;
  const focusLane = lanes.find((l) => l.person === focus);
  return (
    <section className="moment" aria-live="polite">
      <header className="moment-head">
        <span className="eyebrow">
          {moment.time} · Moment {snapshot.cutoff + 1} of {moments.length}
        </span>
        <div className="moment-title-row">
          <h1>{compare ? moment.title : householdOutcome(snapshot, focus).title}</h1>
          {compare && signals.length > 0 && (
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
        <p>{compare ? moment.lead : storyValue[focus]}</p>
      </header>
      {status === "failed" && (
        <div className="moment-alert" role="alert">
          A decision job failed. The source events are kept and the worker retries up to three times.
          Switch to Explore to inspect it.
        </div>
      )}
      <div className="moment-picker" role="tablist" aria-label="Customer">
        {lanes.map((lane) => (
          <button
            key={lane.person}
            role="tab"
            aria-selected={!compare && focus === lane.person}
            onClick={() => {
              onCompare?.(false);
              onFocus(lane.person);
            }}
          >
            <span className={`lane-avatar lane-${lane.person}`}>{initials(lane.person)}</span>
            {householdNames[lane.person]}
          </button>
        ))}
        <button role="tab" aria-selected={compare} className="is-compare" onClick={() => onCompare?.(true)}>
          Compare all three
        </button>
      </div>
      {!compare && focusLane ? <PresenterWorkspace key={`${focus}/${snapshot.cutoff}`} snapshot={snapshot} person={focus} lane={focusLane} deciding={status !== "ready"} phone={phone} onOpen={onOpen} onInspect={onInspect} /> : (
      <div className="lanes">
        {lanes.map((lane) => <Lane key={lane.person} lane={lane} deciding={status === "deciding"} final={final} focused={focus === lane.person} opening={snapshot.cutoff === 0} story={storySoFar(snapshot,lane.person)} onFocus={() => { onCompare?.(false); onFocus(lane.person); }} />)}
      </div>)}
    </section>
  );
}

function Lane({
  lane,
  deciding,
  final,
  focused,
  opening,
  story,
  onFocus,
  single = false,
}: {
  lane: MomentLane;
  deciding: boolean;
  final: boolean;
  focused: boolean;
  opening: boolean;
  story: { at: string; text: string }[];
  onFocus: () => void;
  /** Shown on its own, as the chosen customer's story. */
  single?: boolean;
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
          <>
            <p className="lane-reason">No decision yet. So far:</p>
            <ol className="lane-story">
              {story.map((x, i) => (
                <li key={i}>
                  <time>{x.at}</time>
                  {x.text}
                </li>
              ))}
            </ol>
          </>
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
      {single ? null : <footer>{`Follow ${first(person)}’s story →`}</footer>}
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
