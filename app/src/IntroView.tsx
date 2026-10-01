import type { PersonId, Snapshot } from "./types";
import { householdNames, storyValue } from "./presentation";

// The frame before the clock starts: one incident, three households, three different journeys.
const WHO: Record<PersonId, { role: string; line: string }> = {
  daniel: { role: "An open fault and a promise", line: "BT spotted the line dropping before Daniel did. A restart didn’t fix it, and Aisha has promised to call at 21:15." },
  sam: { role: "A brand-new home", line: "Just moved in. The new hub has been delivered but has never connected." },
  maya: { role: "A quiet routine", line: "A long-standing customer with a quiet evening routine, who has asked not to be alerted at night." },
};
const PEOPLE: PersonId[] = ["daniel", "sam", "maya"];

export function IntroView({ snapshot, onStart, onPerson }: { snapshot: Snapshot; onStart: () => void; onPerson: (p: PersonId) => void }) {
  const initials = (p: PersonId) => householdNames[p].split(" ").map((w) => w[0]).join("");
  return (
    <section className="intro">
      <span className="eyebrow">Experience intelligence · a simulation</span>
      <h1>One incident. Three households. Three very different journeys.</h1>
      <p className="intro-lead">
        At 21:00 a fault in the local network cuts off three homes at once. To the network it’s one alarm. We’ll play the
        evening, and the weeks after, to show how memory, live operations and governance give each household the
        response that fits them, and what each of them actually sees.
      </p>
      <div className="intro-people">
        {PEOPLE.map((p) => {
          const h = snapshot.households.find((x) => x.id === p);
          return (
            <button key={p} className={`intro-card lane-${p}`} onClick={() => onPerson(p)}>
              <span className={`lane-avatar lane-${p}`}>{initials(p)}</span>
              <strong>{householdNames[p]}</strong>
              <small>{WHO[p].role}</small>
              <p>{WHO[p].line}</p>
              {h?.profile && (
                <em>
                  {h.profile.members.length} {h.profile.members.length === 1 ? "person" : "people"}
                  {h.profile.devices.length > 0 && ` · ${h.profile.devices.length} devices`}
                </em>
              )}
              <i>{storyValue[p]}</i>
            </button>
          );
        })}
      </div>
      <ol className="intro-how">
        <li><b>Trigger</b>The network raises one alarm.</li>
        <li><b>Context</b>Customer memory and operational memory say what it means for each home.</li>
        <li><b>Decision</b>The arbiter picks the response; governance says what it may do.</li>
        <li><b>Experience</b>What each customer sees, including nothing at all.</li>
        <li><b>Tracking</b>What we expect next, and whether it happened.</li>
      </ol>
      <button className="intro-start" onClick={onStart}>
        Start the evening · 20:45 →
      </button>
    </section>
  );
}
