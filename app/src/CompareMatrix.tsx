import type { PersonId, Snapshot } from "./types";
import { householdNames, householdOutcome, moments, type MomentLane } from "./presentation";
import { memoryNotes, sectionNotes } from "./section-notes";
import { WHY_DIFFERENT } from "./why-different";

// Compare: one alarm, three homes. Each section is a row, so the story reads top to bottom
// (trigger, context, decision, what the customer sees, tracking) and across, why they differ.
const ROWS: { id: string; label: string; sub: string; panel: string }[] = [
  { id: "trigger", label: "Trigger", sub: "What just happened", panel: "operations" },
  { id: "customer", label: "Customer memory", sub: "What we know about them", panel: "customer" },
  { id: "operations", label: "Operational memory", sub: "What the network knows", panel: "operations" },
  { id: "arbiter", label: "Decision & plan", sub: "What the arbiter chose", panel: "arbiter" },
  { id: "phone", label: "Customer sees", sub: "The experience", panel: "phone" },
  { id: "actions", label: "Tracking", sub: "What we expect, what’s proven", panel: "actions" },
];
const PEOPLE: PersonId[] = ["daniel", "sam", "maya"];
const initials = (p: PersonId) => householdNames[p].split(" ").map((w) => w[0]).join("");

export function CompareMatrix({
  snapshot,
  lanes,
  deciding,
  onFocus,
  onOpen,
}: {
  snapshot: Snapshot;
  lanes: MomentLane[];
  deciding: boolean;
  onFocus: (p: PersonId) => void;
  onOpen?: (person: PersonId, panel: string) => void;
}) {
  const at = snapshot.cutoff;
  const cols = PEOPLE.map((p) => {
    const notes = sectionNotes(snapshot, p, deciding);
    const by = Object.fromEntries(notes.map((n) => [n.panel, n]));
    const lane = lanes.find((l) => l.person === p)!;
    const trigger = at === 0
      ? { text: "No signal yet. Each home starts from its own history.", changed: false }
      : by.customer.changed || by.operations.changed
        ? { text: [...new Set([by.operations.changed ? by.operations.text : "", by.customer.changed ? by.customer.text : ""].flatMap((t) => t.split(" · ")).filter(Boolean))].join(" · "), changed: true }
        : { text: "Nothing new for this home at this moment", changed: false };
    const apart = WHY_DIFFERENT[at]?.lines[p] ?? "";
    by.customer = { ...by.customer, notes: memoryNotes(snapshot, p).slice(0, 3) };
    return { p, by, lane, trigger, apart };
  });
  return (
    <div className="cm-matrix" style={{ gridTemplateColumns: `160px repeat(${PEOPLE.length}, minmax(0, 1fr))` }}>
      <div className="cm-why">
        <span className="eyebrow">Why three different journeys? · {moments[at].time}</span>
        <p>{WHY_DIFFERENT[at]?.headline ?? moments[at].lead}</p>
      </div>
      {cols.map(({ p, lane, apart }) => (
        <button key={p} className={`cm-col-head lane-${p}`} onClick={() => onFocus(p)} title={`Follow ${householdNames[p].split(" ")[0]}’s story`}>
          <span className={`lane-avatar lane-${p}`}>{initials(p)}</span>
          <span>
            <strong>{householdNames[p]}</strong>
            <small>{householdOutcome(snapshot, p).title}</small>
          </span>
          <em>
            <b>Why this journey</b>
            {apart}
          </em>
          <i className={`lane-tag tag-${deciding ? "deciding" : lane.changed || lane.message ? "changed" : "unchanged"}`}>
            {deciding ? "Deciding" : lane.changed ? "New decision" : lane.message ? "Message sent" : at === 0 ? "History" : "No change"}
          </i>
        </button>
      ))}
      {ROWS.map((r) => (
        <div key={r.id} className="cm-row" style={{ display: "contents" }}>
          <div className="cm-row-head">
            <strong>{r.label}</strong>
            <small>{r.sub}</small>
          </div>
          {cols.map(({ p, by, lane, trigger }) => {
            if (r.id === "trigger")
              return (
                <button key={p} className={`cm-cell${trigger.changed ? " is-changed" : ""}`} onClick={() => onOpen?.(p, r.panel)}>
                  <span className="cm-head">{trigger.text}</span>
                </button>
              );
            const n = by[r.id];
            const message = r.id === "phone" ? lane.message : null;
            return (
              <button key={p} className={`cm-cell${n.changed && !deciding ? " is-changed" : ""}`} onClick={() => onOpen?.(p, r.panel)}>
                {r.id === "arbiter" && lane.decision && !deciding ? (
                  <span className="cm-head cm-decision">{lane.decision.title}</span>
                ) : message && !deciding ? (
                  <span className="cm-phone">
                    <small>My BT · {moments[message.revision]?.time}</small>
                    <b>{message.title}</b>
                  </span>
                ) : r.id === "customer" || r.id === "operations" ? (
                  n.notes.length ? null : <span className="cm-head">{r.id === "customer" ? "Nothing else on record" : n.text}</span>
                ) : (
                  <span className="cm-head">{deciding && ["arbiter", "phone", "actions"].includes(r.id) ? "Deciding…" : n.text}</span>
                )}
                {!deciding && n.notes.length > 0 && (
                  <ul>
                    {n.notes.map((t, k) => (
                      <li key={k}>{t}</li>
                    ))}
                  </ul>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
