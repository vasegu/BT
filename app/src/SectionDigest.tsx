import type { Decision, Household, PersonId, Snapshot } from "./types";
import { governanceFacts, memoryFacts, operationsFacts } from "./DecisionFlow";
import { formatDateTime } from "./time";

// The summary level of each section: the richness of the drill-down, folded into a few note
// columns in the arbiter's style, so the story reads without opening anything.
type Note = { text: string; key?: boolean; quiet?: boolean };
type Column = { title: string; notes: Note[] };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });
const short = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const fromFacts = (facts: { text: string; weight?: string }[], n = 3): Note[] =>
  [...facts.filter((f) => f.weight === "high"), ...facts.filter((f) => f.weight !== "high")]
    .slice(0, n)
    .map((f) => ({ text: f.text, key: f.weight === "high", quiet: f.weight === "low" }));

function customer(h: Household): Column[] {
  const p = h.profile;
  const cols: Column[] = [{ title: "Right now", notes: fromFacts(memoryFacts(h)) }];
  if (!p) return cols;
  const rel: Note[] = [];
  if (p.contract)
    rel.push({ text: p.contract.outOfContract ? `Out of contract since ${short(p.contract.end)}` : `In contract until ${day(p.contract.end)} · ${plural(p.contract.monthsLeft, "month")} left` });
  if (p.contract) rel.push({ text: `£${p.contract.arpu} a month${p.contract.extra ? ` · ${p.contract.extra}` : ""}` });
  if (p.churn) rel.push({ text: `Churn risk ${p.churn.level}${p.churn.drivers[0] ? `: ${p.churn.drivers[0].toLowerCase()}` : ""}`, key: p.churn.level !== "low" });
  cols.push({ title: "Relationship", notes: rel });
  const kinds = Object.entries(p.devices.reduce<Record<string, number>>((m, d) => ((m[d.kind] = (m[d.kind] ?? 0) + 1), m), {}));
  cols.push({
    title: "Household",
    notes: [
      { text: p.members.map((m) => `${m.name.split(" ")[0]} (${m.relation.toLowerCase()})`).join(", ") },
      { text: `${plural(p.devices.length, "device")}: ${kinds.map(([k, n]) => plural(n, k.toLowerCase().replace(/s$/, ""))).join(", ")}` },
      ...p.products.slice(0, 2).map((x) => ({ text: `${x.name} · ${x.status}`, key: x.status !== "in use" })),
    ],
  });
  const last = [...p.contacts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).at(-1);
  cols.push({
    title: "Preferences & contact",
    notes: [
      ...(p.preferences
        ? [{ text: `Prefers: ${p.preferences.channel}${p.preferences.quietHours ? ` · quiet hours ${p.preferences.quietHours}` : ""}` }, { text: p.preferences.offers ? "Happy to hear about offers" : "No marketing offers", quiet: !p.preferences.offers }]
        : []),
      ...(last ? [{ text: `Last contact ${short(last.at)} · ${last.channel}: ${last.topic.toLowerCase()}` }] : []),
    ],
  });
  return cols;
}

function operations(h: Household, s: Snapshot): Column[] {
  const inc = s.operations.incident;
  const first = h.name.split(" ")[0];
  const free = s.operations.slots.filter((x) => !x.person && !x.owner).length;
  return [
    { title: "At this moment", notes: fromFacts(operationsFacts(h, s).filter((f) => !/incident|outside it|inside the affected/i.test(f.text))) },
    {
      title: "Signals · source records",
      notes: (() => {
        const sig = s.events.filter((e) => e.revision === s.cutoff && s.cutoff > 0 && (e.subject === h.id || e.subject === "shared") && !e.type.startsWith("router.observation_") && e.type !== "conversation.message");
        return sig.length
          ? sig.slice(-3).map((e) => ({ text: `${e.type} · ${e.source} · ${new Date(e.occurredAt).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })}`, key: true }))
          : [{ text: "No new source records at this moment", quiet: true }];
      })(),
    },
    {
      title: "Network",
      notes: inc
        ? [
            { text: `${inc.id} · ${inc.status}`, key: true },
            { text: `${plural(inc.affected.length, "home")} of three inside it` },
            { text: h.incident ? `${first} is inside the affected area` : `${first} is outside it`, key: true },
          ]
        : [{ text: "No confirmed network incident", quiet: true }, { text: "Each home is read on its own evidence" }],
    },
    {
      title: "People and capacity",
      notes: [
        { text: h.owner ? `${h.owner} owns ${first}’s case` : "No named owner", quiet: !h.owner },
        { text: `${plural(free, "callback slot")} free`, quiet: true },
      ],
    },
  ];
}

function experience(h: Household, s: Snapshot, d?: Decision): Column[] {
  const sent = s.actions.filter((a) => a.person === h.id);
  const now = sent.find((a) => a.revision === s.cutoff);
  const chats = s.events.filter((e) => e.subject === h.id && e.type === "conversation.message" && Date.parse(e.receivedAt) <= Date.parse(s.clock));
  const prefs = h.profile?.preferences;
  return [
    {
      title: "What they see",
      notes: now
        ? [{ text: `“${now.title}”`, key: true }, { text: now.body }]
        : [{ text: d?.disposition === "watch" || d?.disposition === "suppress" ? "Nothing: silence is the decision" : "Nothing new at this moment", quiet: true }],
    },
    {
      title: "Why now",
      notes: d ? [{ text: d.reason.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? d.reason }] : [{ text: "No decision yet", quiet: true }],
    },
    {
      title: "Channel & thread",
      notes: [
        { text: h.contactAllowed ? `In-app, from Eve${prefs?.quietHours ? ` · outside quiet hours ${prefs.quietHours}` : ""}` : "No permission to message", key: !h.contactAllowed },
        { text: `${plural(sent.length, "update")} from Eve · ${plural(chats.length, "chat message")} with people at BT` },
      ],
    },
  ];
}

function tracking(h: Household, s: Snapshot): Column[] {
  const mine = s.operations.outcomes.filter((o) => o.person === h.id);
  const waiting = mine.filter((o) => o.check.status === "waiting");
  const proven = mine.filter((o) => o.check.status === "met");
  const trouble = mine.filter((o) => o.check.status === "unverified" || o.check.status === "contradicted");
  const next = [...waiting].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))[0];
  return [
    { title: "Expecting", notes: waiting.length ? waiting.slice(-3).map((o) => ({ text: `${o.title}: ${o.target.toLowerCase()}` })) : [{ text: "Nothing outstanding", quiet: true }] },
    { title: "Proven", notes: proven.length ? proven.slice(-3).map((o) => ({ text: `${o.title}${o.check.observedAt ? ` · ${formatDateTime(o.check.observedAt)}` : ""}`, key: true })) : [{ text: "Nothing proven yet", quiet: true }] },
    {
      title: "Next check",
      notes: [
        ...(next ? [{ text: `${next.title} due ${formatDateTime(next.dueAt)}` }] : [{ text: "No check due", quiet: true }]),
        ...trouble.map((o) => ({ text: `${o.title}: ${o.check.status === "contradicted" ? "contradicted, reassess" : "proof overdue"}`, key: true })),
      ],
    },
  ];
}

function governance(h: Household, d?: Decision): Column[] {
  if (!d) return [{ title: "This decision", notes: [{ text: "No decision to authorise yet", quiet: true }] }];
  const waits = d.trace?.candidates.filter((c) => c.status === "awaiting") ?? [];
  const held = d.trace?.candidates.filter((c) => c.status !== "merged" && c.id !== d.trace?.selectedId && c.checks.some((k) => k.state === "fail")) ?? [];
  return [
    { title: "This decision", notes: governanceFacts(h, d).filter((f) => !/waits for/.test(f.text)).map((f) => ({ text: f.text, key: f.weight === "high", quiet: f.weight === "low" })) },
    { title: "Waiting for a person", notes: waits.length ? waits.map((c) => ({ text: `${c.title} · ${c.authority?.role ?? "a person"}`, key: true })) : [{ text: "Nothing waiting", quiet: true }] },
    { title: "Ruled out by a gate", notes: held.length ? held.slice(0, 2).map((c) => ({ text: `${c.title}: ${c.checks.find((k) => k.state === "fail")?.detail ?? c.reason}` })) : [{ text: "Nothing blocked", quiet: true }] },
  ];
}

export function SectionDigest({ section, h, snapshot, decision }: { section: string; h: Household; snapshot: Snapshot; decision?: Decision; person?: PersonId }) {
  const cols =
    section === "customer" ? customer(h)
    : section === "operations" ? operations(h, snapshot)
    : section === "phone" ? experience(h, snapshot, decision)
    : section === "actions" ? tracking(h, snapshot)
    : section === "governance" ? governance(h, decision)
    : [];
  const shown = cols.filter((c) => c.notes.length);
  if (!shown.length) return null;
  return (
    <div className="sd" style={{ gridTemplateColumns: `repeat(${Math.min(shown.length, 4)}, minmax(0, 1fr))` }}>
      {shown.map((c) => (
        <article key={c.title}>
          <b>{c.title}</b>
          <ul>
            {c.notes.map((n, i) => (
              <li key={i} className={n.key ? "is-key" : n.quiet ? "is-quiet" : ""}>
                {n.text}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
