import type { PersonId, Snapshot } from "./types";
import { householdNames } from "./presentation";

// The opening slide: the premise, the three households and what to watch for, and the agenda.
const WHO: Record<PersonId, { role: string; line: string; watch: string }> = {
  daniel: {
    role: "An open fault and a promise",
    line: "BT spotted the line dropping before Daniel did. A restart didn’t fix it, and Aisha has promised to call at 21:15.",
    watch: "Does BT remember the promise?",
  },
  sam: {
    role: "A brand-new home",
    line: "Just moved in. The new hub was delivered this week but has never been online.",
    watch: "Does BT know delivered isn’t the same as working?",
  },
  maya: {
    role: "A quiet routine",
    line: "A long-standing customer with a quiet evening routine, who has asked not to be alerted at night.",
    watch: "Does BT know when to stay quiet?",
  },
};
const PEOPLE: PersonId[] = ["daniel", "sam", "maya"];
const AGENDA = [
  { title: "Tonight", when: "20:45 – 21:18", what: "One network fault, three homes, six moments" },
  { title: "The weeks after", when: "Sat · Mon · 6 Nov", what: "Follow-up, early life and a relevant offer" },
  { title: "2030", when: "Where it’s heading", what: "BT’s agent works with the household’s own agent" },
];
const CHAIN = ["Trigger", "Context", "Decision", "Experience", "Tracking"];
const PILLARS = [
  { title: "Knows you", line: "Your household, your history, what you’ve told us, what’s been promised.", layer: "Customer memory" },
  { title: "Acts first", line: "Spots the problem or the need before you have to call.", layer: "Operational memory · Arbiter" },
  { title: "Knows when not to", line: "Stays quiet when nothing would help. Never sells without consent.", layer: "Governance" },
  { title: "Keeps its word", line: "Every promise is tracked until there’s proof it was kept.", layer: "Actions & outcomes" },
];

export function IntroView({ onStart, onPerson }: { snapshot: Snapshot; onStart: () => void; onPerson: (p: PersonId) => void }) {
  const initials = (p: PersonId) => householdNames[p].split(" ").map((w) => w[0]).join("");
  return (
    <section className="intro">
      <div className="intro-hero">
        <span className="intro-kicker">BT Consumer · Experience intelligence</span>
        <h1>
          An agent that looks after every customer.
          <em> Before they have to ask.</em>
        </h1>
        <p>
          It knows each household’s context, notices what they need, acts within the rules, and checks that it
          worked. Over time it becomes a trusted companion: the part of BT that is always on the customer’s side.
        </p>
      </div>

      <ol className="intro-pillars">
        {PILLARS.map((x) => (
          <li key={x.title}>
            <strong>{x.title}</strong>
            <p>{x.line}</p>
            <small>{x.layer}</small>
          </li>
        ))}
      </ol>

      <div className="intro-test">
        <b>Tonight we put it to the test.</b> One network fault cuts off three homes at once. To the network it’s one
        alarm. Watch what the agent does for each of them.
      </div>

      <div className="intro-people">
        {PEOPLE.map((p) => (
          <button key={p} className={`intro-card lane-${p}`} onClick={() => onPerson(p)}>
            <header>
              <span className={`lane-avatar lane-${p}`}>{initials(p)}</span>
              <span>
                <strong>{householdNames[p]}</strong>
                <small>{WHO[p].role}</small>
              </span>
            </header>
            <p>{WHO[p].line}</p>
            <i>
              <b>Watch for</b>
              {WHO[p].watch}
            </i>
          </button>
        ))}
      </div>

      <div className="intro-foot">
        <ol className="intro-agenda">
          {AGENDA.map((a, i) => (
            <li key={a.title}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <strong>{a.title}</strong>
                <small>{a.when}</small>
                <p>{a.what}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="intro-go">
          <p className="intro-chain">
            Every moment reads the same way:{" "}
            {CHAIN.map((c, i) => (
              <span key={c}>
                {c}
                {i < CHAIN.length - 1 && <i>→</i>}
              </span>
            ))}
          </p>
          <button className="intro-start" onClick={onStart}>
            Start the evening · 20:45 →
          </button>
          <small>or press →</small>
        </div>
      </div>
    </section>
  );
}
