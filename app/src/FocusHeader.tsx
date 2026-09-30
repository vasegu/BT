import type { ReactNode } from "react";
import type { PersonId, Snapshot } from "./types";
import { moments, householdNames } from "./presentation";
import "./actions-view.css";
import { ScopeTag, type ScopeKind } from "./Scope";
import { PanelNotes } from "./DecisionFlow";

/** Where each panel sits in the five-part architecture, and who is accountable for it. */
export const ARCHITECTURE: Record<string, { component: string; owner: string }> = {
  "Customer memory": { component: "1 · Customer memory, the moat", owner: "Memory & Trust Officer" },
  "Operational memory": { component: "Live signals into the reasoning engine", owner: "Service operations" },
  Arbiter: { component: "2 · Reasoning & planning engine", owner: "AgentOps lead" },
  "Actions & outcomes": { component: "3 · Governed action · 4 · Closing the loop", owner: "Human escalation lead" },
  "Customer experience": { component: "The customer moment", owner: "Chief Customer Officer" },
  "Agent review": { component: "5 · Governance · how agents behave in production", owner: "AgentOps lead" },
  Governance: { component: "5 · Governance · the policy layer", owner: "Memory & Trust Officer" },
};

/** Shared header for expanded panels: the panel's question, household switch and the moment strip. */
export function FocusHeader({
  panel,
  question,
  snapshot,
  person,
  stat,
  onPerson,
  onCutoff,
  children,
  moments: showMoments = true,
  scope,
}: {
  panel: string;
  question: string;
  snapshot: Snapshot;
  person: PersonId;
  stat?: { value: ReactNode; label: string };
  onPerson: (p: PersonId) => void;
  onCutoff: (at: number) => void;
  children?: ReactNode;
  /** Panels that are a standing picture rather than a replay can hide the moment strip. */
  moments?: boolean;
  /** Pages that are uniform throughout show one scope for the whole page. */
  scope?: ScopeKind;
}) {
  return (
    <>
      <header className="av-head">
        <div>
          <span className="eyebrow">
            {panel}
            {showMoments && ` · ${moments[snapshot.cutoff].time} · ${moments[snapshot.cutoff].title}`}
          </span>
          <h2>{question}</h2>
          {ARCHITECTURE[panel] && (
            <p className="av-arch">
              <span>Architecture</span>
              {ARCHITECTURE[panel].component}
              <span>Accountable</span>
              {ARCHITECTURE[panel].owner}
              {scope && <ScopeTag scope={scope} snapshot={snapshot} person={person} />}
            </p>
          )}
        </div>
        <div className="av-people" role="group" aria-label="Household">
          {(["daniel", "sam", "maya"] as PersonId[]).map((p) => (
            <button key={p} aria-pressed={p === person} onClick={() => onPerson(p)}>
              {householdNames[p].split(" ")[0]}
            </button>
          ))}
        </div>
        {stat && (
          <div className="av-verified">
            <strong>{stat.value}</strong>
            <small>{stat.label}</small>
          </div>
        )}
      </header>
      {(children || showMoments) && (
      <div className="av-bar">
        {children}
        {showMoments && (
        <ol className="av-moments" aria-label="Moment">
          {moments.map((m, i) => (
            <li key={m.time}>
              <button
                aria-current={i === snapshot.cutoff ? "step" : undefined}
                disabled={i > snapshot.session.revision}
                onClick={() => onCutoff(i)}
                title={m.title}
              >
                <time>{m.time.replace(/ \d\d:\d\d$/, "")}</time>
                <span>{m.title}</span>
              </button>
            </li>
          ))}
        </ol>
        )}
      </div>
      )}
      {snapshot.households.some((x) => x.id === person) && (
        <PanelNotes
          panel={panel}
          h={snapshot.households.find((x) => x.id === person)!}
          snapshot={snapshot}
          decision={snapshot.decisions.filter((d) => d.person === person).at(-1)}
        />
      )}
    </>
  );
}
