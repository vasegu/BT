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


type Spec = [string, string];
const id8 = (x?: string | null) => (x ? x.slice(0, 8) : "—");
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

/** The machine view of each section: identifiers, versions, counts and timings. */
function specs(section: string, h: Household, s: Snapshot, d?: Decision): Spec[] {
  const recs = h.evidence.filter((e) => !e.type.startsWith("router.observation_"));
  const t = d?.trace;
  const chosen = t?.candidates.find((c) => c.id === t.selectedId);
  if (section === "customer") {
    const sources = [...new Set(recs.map((e) => e.source))];
    const last = recs.at(-1);
    return [
      ["records", `${recs.length} · ${new Set(recs.map((e) => e.type)).size} types`],
      ["sources", `${sources.length} · ${sources.slice(0, 3).join(", ")}`],
      ["memory items", `${h.memory?.items.length ?? 0} · hash ${id8(h.memory?.hash)}`],
      ["since", recs[0] ? day(recs[0].occurredAt) : "—"],
      ["latest", last ? `${last.type} @ ${hhmm(last.receivedAt)}` : "—"],
      ["profile", h.profile ? `${h.profile.products.length} products · ${h.profile.contacts.length} contacts · valid at ${hhmm(s.clock)}` : "not loaded"],
    ];
  }
  if (section === "operations") {
    const now = s.events.filter((e) => e.revision === s.cutoff && s.cutoff > 0);
    const windows = s.events.filter((e) => e.subject === h.id && e.type === "router.observation_window" && Date.parse(e.occurredAt) > Date.parse(s.clock) - 86400e3 && Date.parse(e.occurredAt) <= Date.parse(s.clock));
    const exp = windows.reduce((n, e) => n + (Number(e.payload.expected) || 0), 0);
    const got = windows.reduce((n, e) => n + (Number(e.payload.received) || 0), 0);
    const net = s.operations.network;
    return [
      ["events @ rev", `${now.length} · rev ${s.cutoff}/${s.session.revision}`],
      ["heartbeats 24h", exp ? `${got}/${exp} · ${Math.round((got / exp) * 100)}% · ${windows.length} windows` : "no aggregate"],
      ["incident", s.operations.incident ? `${s.operations.incident.id} · ${s.operations.incident.status} · ${s.operations.incident.affected.length} in scope` : "none"],
      ["network", net ? `${net.nodes.length} nodes · ${net.cases.filter((c) => c.status === "open").length} open cases` : "—"],
      ["promises", net ? `${net.promises.filter((p) => p.kept).length}/${net.promises.length} kept` : "—"],
      ["slots", `${s.operations.slots.filter((x) => x.owner || x.person).length} held · ${s.operations.slots.filter((x) => !x.owner && !x.person).length} free`],
    ];
  }
  if (section === "arbiter" && d) {
    const a = t?.assessment;
    const probs = a ? Object.values(a.answers).flatMap((x) => Object.entries(x.probabilities ?? {})) : [];
    const p = probs.filter(([k]) => k === t?.selectedId).map(([, v]) => v)[0];
    const trig = t?.triggerIds[0] ? s.events.find((e) => e.id === t.triggerIds[0])?.type : undefined;
    return [
      ["decision", `${id8(d.id)} · ${d.disposition} · ${d.domain}`],
      ["policy", d.policyVersion],
      ["trigger", trig ?? "context reassessment"],
      ["candidates", t ? `${t.candidates.length} · ${t.candidates.filter((c) => c.status === "blocked").length} blocked · ${t.candidates.filter((c) => c.status === "awaiting").length} awaiting` : "—"],
      ["gates", chosen ? `${chosen.checks.filter((c) => c.state === "pass").length}/${chosen.checks.length} pass` : "—"],
      ["evidence", `${d.evidenceIds.length} records cited`],
      ["model", a ? `${a.model} · ${a.promptVersion}${p != null ? ` · p=${p.toFixed(2)}` : ""} · ${a.effective ?? a.status}` : "rules only"],
      ["latency", a ? `${a.latencyMs} ms · ${a.inputTokens ?? "?"}→${a.outputTokens ?? "?"} tok${a.costUsd != null ? ` · $${a.costUsd.toFixed(4)}` : ""}` : "—"],
    ];
  }
  if (section === "phone") {
    const act = s.actions.filter((x) => x.person === h.id).at(-1);
    return [
      ["action", act ? `${id8(act.id)} · ${act.kind} · ${act.status}` : "none"],
      ["receipt", act ? `${id8(act.receiptId)} · ${hhmm(act.time)}` : "—"],
      ["decision", act ? id8(act.decisionId) : id8(d?.id)],
      ["execution", t?.execution.length ? t.execution.map((x) => `${x.stage}:${x.status}`).join(" → ") : "—"],
      ["channel", h.contactAllowed ? "in_app · service" : "none · no authority"],
      ["provenance", act?.provenance ?? "—"],
    ];
  }
  if (section === "actions") {
    const mine = s.operations.outcomes.filter((o) => o.person === h.id);
    const count = (st: string) => mine.filter((o) => o.check.status === st).length;
    const next = mine.filter((o) => o.check.status === "waiting").sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))[0];
    return [
      ["contracts", `${mine.length} · ${count("met")} met · ${count("waiting")} waiting · ${count("unverified") + count("contradicted")} at risk`],
      ["version", mine[0]?.version ?? "bt-outcomes-v1"],
      ["next due", next ? `${next.goal} · ${formatDateTime(next.dueAt)}` : "—"],
      ["expects", next ? next.expectedEvent : "—"],
      ["evidence", `${mine.reduce((n, o) => n + o.check.evidenceIds.length, 0)} observation records`],
      ["provenance", [...new Set(mine.map((o) => o.provenance))].join(", ") || "—"],
    ];
  }
  if (section === "governance" && d) {
    return [
      ["policy", d.policyVersion],
      ["moment", d.moment ? d.moment.kind : "—"],
      ["authority", chosen?.authority ? `${chosen.authority.mode} · ${chosen.authority.role}` : "—"],
      ["contact", h.contactAllowed ? "service · in_app · verified" : "not established"],
      ["commercial", h.offersAllowed ? `opted in${h.offerApproved ? " · approved" : ""}` : "no consent"],
      ["gates", chosen ? chosen.checks.map((c) => `${c.id}:${c.state}`).slice(0, 4).join(" ") : "—"],
    ];
  }
  return [];
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
  const spec = specs(section, h, snapshot, decision);
  if (!shown.length && !spec.length) return null;
  return (
    <>
    {shown.length > 0 && <div className="sd" style={{ gridTemplateColumns: `repeat(${Math.min(shown.length, 4)}, minmax(0, 1fr))` }}>
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
    </div>}
    {spec.length > 0 && (
      <dl className="sd-spec">
        {spec.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    )}
    </>
  );
}
