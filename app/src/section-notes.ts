import type { PersonId, Snapshot } from "./types";
import { changeSummary, householdNames, type ChangeRow } from "./presentation";
import { governanceFacts, memoryFacts, operationsFacts } from "./DecisionFlow";

/** One section, summarised for a household at a moment: the headline change and two standing notes. */
export type SectionNote = ChangeRow & { notes: string[] };

const sentence = (text: string) => (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();

/** The summary level: enough on every section to follow the story without drilling in. */
export function sectionNotes(s: Snapshot, person: PersonId, deciding = false): SectionNote[] {
  const h = s.households.find((x) => x.id === person)!;
  const first = householdNames[person].split(" ")[0];
  const rows = changeSummary(s, person);
  const decision = s.decisions.filter((d) => d.person === person && d.revision <= s.cutoff).at(-1);
  const message = s.actions.find((a) => a.person === person && a.revision === s.cutoff);
  const outcomes = s.operations.outcomes.filter((o) => o.person === person);
  const status = { met: "proven", waiting: "waiting", unverified: "not yet proven", contradicted: "contradicted" } as const;
  const key = (facts: { text: string; weight?: string }[]) =>
    [...facts.filter((f) => f.weight === "high"), ...facts.filter((f) => f.weight !== "high")].map((f) => f.text);
  const notes: Record<string, string[]> = {
    customer: key(memoryFacts(h)).slice(0, 2),
    operations: key(operationsFacts(h, s)).filter((t) => !t.startsWith("New at")).slice(0, 2),
    arbiter: deciding ? [`Weighing ${first}’s memory against the new evidence`] : decision ? [sentence(decision.reason)] : [],
    phone: message
      ? [sentence(message.body)]
      : decision?.disposition === "watch" || decision?.disposition === "suppress"
        ? ["Silence is the decision: nothing would help yet"]
        : [],
    actions: outcomes.slice(-2).map((o) => `${o.title} · ${status[o.check.status]}`),
    governance: decision ? governanceFacts(h, decision).filter((f) => !/moment:/.test(f.text)).map((f) => f.text).slice(0, 2) : [],
    review: ["Checks whether the wrong context could sway the action"],
  };
  return rows.map((r) => ({ ...r, notes: notes[r.panel] ?? [] }));
}

/** The one fact that most sets this household apart right now. */
export function whatSetsApart(s: Snapshot, person: PersonId): string {
  const h = s.households.find((x) => x.id === person)!;
  return key1(memoryFacts(h)) ?? "Nothing on record changes the response";
}
const key1 = (facts: { text: string; weight?: string }[]) => (facts.find((f) => f.weight === "high") ?? facts[0])?.text;

/** Customer memory notes in priority order, key facts first. */
export function memoryNotes(s: Snapshot, person: PersonId): string[] {
  const facts = memoryFacts(s.households.find((x) => x.id === person)!);
  return [...facts.filter((f) => f.weight === "high"), ...facts.filter((f) => f.weight !== "high")].map((f) => f.text);
}
