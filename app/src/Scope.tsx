import type { ReactNode } from "react";
import type { PersonId, Snapshot } from "./types";
import { moments, householdNames } from "./presentation";
import "./scope.css";

// What a section depends on, so the room can see which parts move with the story.
// customer = differs per customer · moment = changes with the clock · both · standing = fixed ·
// highlight = the same for everyone, with the chosen customer picked out.
export type ScopeKind = "customer" | "moment" | "both" | "standing" | "highlight";

export function ScopeTag({ scope, snapshot, person }: { scope: ScopeKind; snapshot?: Snapshot; person?: PersonId }) {
  const first = person ? householdNames[person].split(" ")[0] : "";
  const time = snapshot ? moments[snapshot.cutoff].time : "";
  const label =
    scope === "standing"
      ? "Standing · same for everyone"
      : scope === "highlight"
        ? `Whole estate · ${first} highlighted`
        : scope === "customer"
        ? `${first} only`
        : scope === "moment"
          ? `All customers · ${time}`
          : `${first} · ${time}`;
  // Re-keyed on what the section depends on, so it briefly highlights when that changes.
  const key = scope === "standing" ? "standing" : scope === "customer" || scope === "highlight" ? person : scope === "moment" ? snapshot?.cutoff : `${person}/${snapshot?.cutoff}`;
  return (
    <>
      <em className={`scope-tag is-${scope}`} title={hint[scope]}>
        <i aria-hidden="true" />
        {label}
      </em>
      {scope !== "standing" && <b key={String(key)} className="scope-pulse" aria-hidden="true" />}
    </>
  );
}
const hint: Record<ScopeKind, string> = {
  customer: "Differs for each customer",
  moment: "Changes as the evening moves on; the same for every customer",
  both: "Differs for each customer and changes with the moment",
  standing: "The same for every customer at every moment",
  highlight: "The same for every customer; only the highlighted customer changes",
};

/** Standing material sits apart from the story, so what changes is obvious. */
export function StandingBand({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="standing-band">
      <header>
        <em className="scope-tag is-standing">
          <i aria-hidden="true" />
          Standing context
        </em>
        <small>{note ?? "The same for every customer at every moment. Nothing here changes as the story plays."}</small>
      </header>
      {children}
    </div>
  );
}
