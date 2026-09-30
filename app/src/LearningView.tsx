import type { Household, Snapshot } from "./types";
import { learningLoops, pct } from "./learning";
import "./learning.css";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

/** What this household's own outcomes add to each loop, from its outcome records. */
function contribution(loopId: string, h: Household, s: Snapshot): string | null {
  const first = h.name.split(" ")[0];
  const outcomes = s.operations.outcomes.filter((o) => o.person === h.id);
  const sent = (title: string) => s.actions.find((a) => a.person === h.id && a.title === title);
  if (loopId === "quiet-fix-note") {
    const note = sent("We fixed something overnight");
    return note ? `${first} was told at ${new Date(note.time).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })} on Saturday. If ${first} doesn’t need to contact us within 7 days, this home joins the “told” group.` : null;
  }
  if (loopId === "monitoring-window") {
    const m = outcomes.find((o) => o.goal === "monitoring");
    if (!m) return null;
    return m.check.status === "met"
      ? `${first}’s line held for the whole window: one more line in the “no repeat fault” column.`
      : `${first}’s line is being watched now; its result joins the evidence when the window ends.`;
  }
  if (loopId === "early-life-guide") {
    const g = outcomes.find((o) => o.goal === "early-life");
    if (!g) return null;
    return g.check.status === "met"
      ? `${first}’s household has recorded included-product usage after the guide. This does not establish that the guide caused it.`
      : `${first}’s household had the guide on Saturday; whether they use everything decides which column this home joins.`;
  }
  return null;
}

export function LearningView({ h, snapshot }: { h: Household; snapshot: Snapshot }) {
  const loops = learningLoops().filter((l) => Date.parse(l.availableFrom) <= Date.parse(snapshot.clock));
  const clock = Date.parse(snapshot.clock);
  return (
    <div className="lv">
      <p className="lv-intro">
        This illustrative learning loop compares sampled outcomes with and without an
        action, and any change to the policy is signed off by a named role. Figures come from synthetic
        fixed-seed groups with sample sizes shown below. Their outcome probabilities are illustrative assumptions; these are not BT’s results or causal estimates.
      </p>
      {loops.map((l) => {
        const decided = Date.parse(l.change.on) <= clock;
        const max = Math.max(...l.arms.map((a) => a.rate));
        const mine = contribution(l.id, h, snapshot);
        return (
          <article key={l.id} className={`lv-loop${l.linkedTo === h.id ? " is-mine" : ""}`}>
            <header>
              <h3>{l.question}</h3>
              <small>{l.metric} · {l.observationWindow} · available {day(l.availableFrom)}</small>
            </header>
            <div className="lv-arms">
              {l.arms.map((a) => (
                <div key={a.label} className="lv-arm">
                  <span>{a.label}</span>
                  <i aria-hidden="true">
                    <b style={{ width: `${(a.rate / max) * 100}%` }} />
                  </i>
                  <strong>{pct(a.rate)}</strong>
                  <small>
                    {a.outcome} of {a.homes.toLocaleString("en-GB")}
                  </small>
                </div>
              ))}
            </div>
            <p className="lv-finding">{l.finding}</p>
            <div className={`lv-change is-${decided ? l.change.kind : "measuring"}`}>
              <span>{decided ? { adopted: "Policy changed", kept: "Policy kept", expanded: "Policy expanded" }[l.change.kind] : "Still measuring"}</span>
              {decided ? (
                <>
                  <b>{l.change.what}</b>
                  <small>
                    Signed off by {l.change.approver} · {day(l.change.on)}
                  </small>
                </>
              ) : (
                <b>Evidence is still coming in; no policy change yet.</b>
              )}
            </div>
            {mine && (
              <p className="lv-mine">
                <span>This household</span> {mine}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
