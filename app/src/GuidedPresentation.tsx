import type { Snapshot, PersonId, SourceEvent } from "./types";
import { householdNames, householdOutcome } from "./presentation";
import type { PresentationBeat, PresentationPanel } from "./presentation";
import "./presentation.css";
const panels: Record<PresentationPanel, string> = {
  customer: "Customer memory",
  operations: "Operational memory",
  arbiter: "Arbiter",
  actions: "Actions & outcomes",
  phone: "Customer experience",
};
const roles = {
  daniel: "Recovery + a promise",
  sam: "A first connection",
  maya: "A quiet evening",
};
const people: PersonId[] = ["daniel", "sam", "maya"];
export function PresentationRail({
  person: selected,
  beats,
  index,
  onPerson,
}: {
  person: PersonId;
  beats: PresentationBeat[];
  index: number;
  onPerson: (person: PersonId) => void;
}) {
  return (
    <nav className="story-rail" aria-label="Household stories">
      {people.map((person) => {
        return (
          <button
            key={person}
            onClick={() => onPerson(person)}
            aria-pressed={selected === person}
          >
            <span className="story-avatar">
              {householdNames[person]
                .split(" ")
                .map((w) => w[0])
                .join("")}
            </span>
            <span>
              <strong>{householdNames[person]}</strong>
              <small>{roles[person]}</small>
            </span>
            <span className="story-position">
              {selected === person ? "In focus" : "Open story"}
              <i aria-hidden="true" />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
export function PresentationCue({
  snapshot,
  beat,
  index,
  total,
  busy,
  onNext,
  onBack,
  onOpen,
  onInspect,
}: {
  snapshot: Snapshot;
  beat: PresentationBeat;
  index: number;
  total: number;
  busy: boolean;
  onNext: () => void;
  onBack: () => void;
  onOpen: (panel: PresentationPanel) => void;
  onInspect: (e: SourceEvent) => void;
}) {
  const evidence = beat.evidenceIds
    .map((id) => snapshot.events.find((e) => e.id === id))
    .filter((e): e is SourceEvent => !!e);
  return (
    <section
      className="presentation-cue"
      aria-label="Current presentation beat"
    >
      <div className="cue-count">
        <span>MOMENT {String(snapshot.cutoff + 1).padStart(2, "0")}</span>
        <strong>
          {String(index + 1).padStart(2, "0")}
          <small> / {String(total).padStart(2, "0")}</small>
        </strong>
      </div>
      <div className="cue-copy" aria-live="polite">
        <div className="cue-location">
          {beat.person ? householdNames[beat.person] : "All three households"}
          <span> / </span>
          {beat.panel ? panels[beat.panel] : "Compare the outcomes"}
        </div>
        <h1>{beat.title}</h1>
        <p>{beat.detail}</p>
        {beat.change && (
          <div className="cue-diff">
            <span>{beat.change.label}</span>
            <del>{beat.change.before}</del>
            <span aria-hidden="true">→</span>
            <strong>{beat.change.after}</strong>
          </div>
        )}
        {evidence.length > 0 && (
          <div className="cue-evidence">
            {evidence.slice(0, 2).map((e) => (
              <button
                key={e.id}
                title={e.description}
                onClick={() => onInspect(e)}
              >
                {e.type}
                <span>↗</span>
              </button>
            ))}
            {evidence.length > 2 && (
              <span>+{evidence.length - 2} linked records</span>
            )}
          </div>
        )}
      </div>
      <div className="cue-controls">
        <div>
          <button
            onClick={onBack}
            disabled={busy || (!snapshot.cutoff && !index)}
            aria-label="Previous presentation beat"
          >
            ←
          </button>
          <button
            className="primary"
            onClick={onNext}
            disabled={busy || beat.kind === "waiting"}
          >
            {busy
              ? "Recording…"
              : index < total - 1
                ? "Next beat"
                : snapshot.cutoff === 5
                  ? beat.person === "daniel"
                    ? "Sam’s story"
                    : beat.person === "sam"
                      ? "Maya’s story"
                      : "Daniel’s story"
                  : "Continue story"}
            <span>→</span>
          </button>
        </div>
        {beat.panel && (
          <button className="cue-inspect" onClick={() => onOpen(beat.panel!)}>
            Inspect {panels[beat.panel].toLowerCase()} ↗
          </button>
        )}
        <small>← → to move · Enter to inspect</small>
      </div>
    </section>
  );
}
export function PresentationComparison({
  snapshot,
  person,
  onOpen,
}: {
  snapshot: Snapshot;
  person: PersonId;
  onOpen: (person: PersonId) => void;
}) {
  return (
    <section
      className="story-comparison story-outcome"
      aria-label="Household story outcome"
    >
      <header>
        <span className="eyebrow">
          {snapshot.cutoff === 5
            ? "What changed / what is proven"
            : "Pause / compare the three contexts"}
        </span>
        <h2>{householdNames[person].split(" ")[0]}’s outcome</h2>
      </header>
      <div className="comparison-grid">
        {[person].map((person) => {
          const h = snapshot.households.find((h) => h.id === person)!;
          const o = householdOutcome(snapshot, person);
          const d = snapshot.decisions
            .filter(
              (d) => d.person === person && d.revision === snapshot.cutoff,
            )
            .at(-1);
          const relevant =
            person === "daniel"
              ? ["service", "callback", "confirmation"]
              : person === "sam"
                ? ["activation"]
                : ["watch"];
          return (
            <article
              key={person}
              className={`comparison-household outcome-${o.state}`}
            >
              <div className="comparison-identity">
                <span className="story-avatar">
                  {h.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </span>
                <div>
                  <strong>{h.name}</strong>
                  <small>{roles[person]}</small>
                </div>
                <span className="proof-state">
                  {o.state === "met"
                    ? "Verified"
                    : o.state === "contradicted"
                      ? "Reassess"
                      : "Open"}
                </span>
              </div>
              <h3>{o.title}</h3>
              <p>{o.detail}</p>
              <dl>
                {o.proof
                  .filter((p) => relevant.includes(p.goal))
                  .map((p) => (
                    <div key={p.id}>
                      <dt>{p.title}</dt>
                      <dd className={p.check.status}>
                        {p.check.status === "met"
                          ? "Observed"
                          : p.check.status === "waiting"
                            ? "Awaiting proof"
                            : p.check.status}
                      </dd>
                    </div>
                  ))}
              </dl>
              <div className="comparison-decision">
                <span className="eyebrow">Recorded next move</span>
                <strong>{d?.title || "Awaiting a source event"}</strong>
              </div>
              <button onClick={() => onOpen(person)}>
                Inspect this household’s proof <span>↗</span>
              </button>
            </article>
          );
        })}
      </div>
      <p className="comparison-footnote">
        Synthetic observations · recorded decisions · simulated delivery.
        Observed outcomes do not establish causal uplift.
      </p>
    </section>
  );
}
