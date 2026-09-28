import type { Decision, Household, PersonId, Snapshot, SourceEvent } from "./types";
import { FocusHeader } from "./FocusHeader";
import { Rhythm, rhythmGrid } from "./Rhythm";
import { MemoryMap } from "./MemoryMap";
import "./customer-memory-view.css";

// Customer memory, expanded. The pitch's common thread: given a signal, what does BT know
// about this customer that changes the right response? Every fact below comes from a
// recorded event or derived memory, tagged by how we know it and how old it is.
type Epistemic = "stated" | "observed" | "derived";
type Fact = { text: string; how: Epistemic; at: string; event?: SourceEvent };

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });
const age = (iso: string, clock: string) => {
  const ms = Date.parse(clock) - Date.parse(iso);
  if (ms < 3600e3) return `${Math.max(0, Math.round(ms / 60e3))}m`;
  if (ms < 48 * 3600e3) return `${Math.round(ms / 3600e3)}h`;
  if (ms < 60 * 864e5) return `${Math.round(ms / 864e5)}d`;
  return `${Math.round(ms / (30 * 864e5))}mo`;
};

// Accenture, Trust is the Product: six layers of memory.
const LAYERS = [
  ["identity", "Identity", "Who they are and what they’re authorised to do"],
  ["behavioural", "Behavioural", "What normal looks like for this household"],
  ["service", "Service", "What they have and what’s happened to it"],
  ["context", "Context", "What’s true right now"],
  ["emotional", "Emotional", "How it has felt, in their words"],
  ["intentional", "Intentional", "What’s been promised or asked for"],
] as const;
type Layer = (typeof LAYERS)[number][0];

function layers(h: Household, snapshot: Snapshot): Record<Layer, Fact[]> {
  const mine = snapshot.events.filter((e) => e.subject === h.id);
  const last = (type: string) => mine.filter((e) => e.type === type).at(-1);
  const all = (type: string) => mine.filter((e) => e.type === type);
  const out: Record<Layer, Fact[]> = { identity: [], behavioural: [], service: [], context: [], emotional: [], intentional: [] };
  const push = (l: Layer, f: Fact | null | undefined) => f && out[l].push(f);

  // identity
  const auth = last("contact.authority_recorded");
  push("identity", auth && { text: auth.description, how: "observed", at: auth.receivedAt, event: auth });
  const firstOrder = all("order.accepted")[0];
  push("identity", firstOrder && { text: `Customer since ${day(firstOrder.occurredAt)}`, how: "observed", at: firstOrder.receivedAt, event: firstOrder });
  const hh = snapshot.operations.network?.households.find((x) => x.person === h.id);
  if (hh && hh.members.length > 1)
    push("identity", { text: `${hh.label}: ${hh.members.map((m) => m.name).join(", ")}`, how: "observed", at: hh.members.at(-1)!.since });

  // behavioural
  const r = rhythmGrid(snapshot, h.id);
  if (r) push("behavioural", { text: r.summary, how: "derived", at: snapshot.clock });
  for (const m of h.memory?.items.filter((m) => m.kind === "pattern") ?? [])
    push("behavioural", { text: m.text, how: "derived", at: m.availableFrom });

  // service
  push("service", { text: `Broadband · ${h.activation}`, how: "observed", at: (last("activation.confirmed") ?? last("order.delivered") ?? firstOrder ?? { receivedAt: snapshot.clock }).receivedAt });
  const opened = last("case.opened");
  if (h.caseStatus === "open" && opened)
    push("service", { text: `${opened.description}`, how: "observed", at: opened.receivedAt, event: opened });
  for (const d of all("diagnostic.completed").slice(-2))
    push("service", { text: d.description, how: "observed", at: d.receivedAt, event: d });
  const restored = last("service.restored_observed");
  push("service", restored && { text: restored.description, how: "observed", at: restored.receivedAt, event: restored });

  // context
  const overdue = mine.filter((e) => e.type === "router.heartbeat_overdue" && e.revision > 0).at(-1);
  const back = mine.filter((e) => ["router.heartbeat_received", "service.restored_observed", "activation.first_use_observed"].includes(e.type) && e.revision > 0).at(-1);
  if (overdue)
    push("context", {
      text: back && Date.parse(back.occurredAt) >= Date.parse(overdue.occurredAt) ? `Router quiet at ${time(overdue.occurredAt)}, connection back at ${time(back.occurredAt)}` : `Router quiet since ${time(overdue.occurredAt)} · cause unknown`,
      how: "observed",
      at: (back ?? overdue).receivedAt,
      event: back ?? overdue,
    });
  const incident = snapshot.events.filter((e) => e.type === "incident.confirmed").at(-1);
  if (incident)
    push("context", { text: h.incident ? "Inside confirmed incident INC-017" : "Outside INC-017 (explicitly excluded)", how: "observed", at: incident.receivedAt, event: incident });
  push("context", { text: `${new Date(snapshot.clock).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/London" })} evening, ${time(snapshot.clock)}`, how: "observed", at: snapshot.clock });

  // emotional: the customer's own words
  for (const e of mine.filter((e) => e.type === "conversation.message" && (e.payload as { speakerRole?: string }).speakerRole === "customer").slice(-3))
    push("emotional", { text: `“${e.description}”`, how: "stated", at: e.receivedAt, event: e });

  // intentional
  const promise = last("promise.created");
  if (promise)
    push("intentional", {
      text: `${h.owner ?? "Adviser"} promised a callback at ${time(String((promise.payload as { dueAt?: string }).dueAt ?? promise.occurredAt))} · ${h.promiseFulfilled ? "kept" : "outstanding"}`,
      how: "stated",
      at: promise.receivedAt,
      event: promise,
    });
  const pref = last("preference.stated");
  push("intentional", pref && { text: `Asked us: ${pref.description}`, how: "stated", at: pref.receivedAt, event: pref });
  const pending = last("activation.pending");
  if (pending && !h.firstUseObserved) push("intentional", { text: "Waiting for a working first connection", how: "observed", at: pending.receivedAt, event: pending });
  const confirmed = last("customer.confirmed_working");
  push("intentional", confirmed && { text: `Confirmed: ${confirmed.description}`, how: "stated", at: confirmed.receivedAt, event: confirmed });
  return out;
}

export function CustomerMemoryView({
  h,
  snapshot,
  decision,
  inspect,
  onCutoff,
  onPerson,
}: {
  h: Household;
  snapshot: Snapshot;
  decision?: Decision;
  inspect: (e: SourceEvent) => void;
  onCutoff: (at: number) => void;
  onPerson: (p: PersonId) => void;
}) {
  const first = h.name.split(" ")[0];
  const facts = layers(h, snapshot);
  const count = Object.values(facts).reduce((n, f) => n + f.length, 0);
  const mine = snapshot.events.filter((e) => e.subject === h.id);
  // What's already been said, and by which channel.
  const conversations = [...new Set(mine.filter((e) => e.type === "conversation.message").map((e) => String((e.payload as { conversationId?: string }).conversationId)))].map((id) => {
    const rows = mine.filter((e) => e.type === "conversation.message" && (e.payload as { conversationId?: string }).conversationId === id);
    return { at: rows[0].occurredAt, channel: String((rows[0].payload as { channel?: string }).channel ?? "conversation"), text: rows.find((r) => (r.payload as { speakerRole?: string }).speakerRole === "customer")?.description ?? rows[0].description, n: rows.length, event: rows[0] };
  });
  const said = [
    ...conversations.map((c) => ({ at: c.at, channel: c.channel.replace("_", " "), who: `${c.n} messages`, text: c.text, event: c.event as SourceEvent | undefined })),
    ...snapshot.actions.filter((a) => a.person === h.id).map((a) => ({ at: a.time, channel: "in-app update", who: "BT", text: a.title, event: undefined })),
    ...mine.filter((e) => e.type === "promise.fulfilled").map((e) => ({ at: e.occurredAt, channel: "phone call", who: h.owner ?? "Adviser", text: "Promised callback made", event: e as SourceEvent | undefined })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  // What the decision at this moment actually read, and what it left out.
  const used = (decision?.evidenceIds ?? []).map((id) => snapshot.events.find((e) => e.id === id)).filter((e): e is SourceEvent => !!e);
  const heldBack = mine.filter((e) => !decision?.evidenceIds.includes(e.id) && e.type !== "router.observation_window").length;
  const windows = mine.filter((e) => e.type === "router.observation_window").length;
  const household = snapshot.operations.network?.households.find((x) => x.person === h.id);
  const others = [
    ...(household?.members.filter((m) => m.name !== h.name).map((m) => `${m.name} (household member)`) ?? []),
    ...(household?.services.filter((s) => s.product !== "broadband").map((s) => `${s.product} service`) ?? []),
  ];
  return (
    <div className="av cm">
      <FocusHeader
        panel="Customer memory"
        question={`What do we know about ${first} that changes the response?`}
        snapshot={snapshot}
        person={h.id}
        stat={{ value: count, label: "facts in memory" }}
        onPerson={onPerson}
        onCutoff={onCutoff}
      />
      <section className="av-step">
        <header>
          <span>01</span>
          <h3>What normal looks like</h3>
          <small className="cm-hint">the same quiet router means different things in different homes</small>
        </header>
        <Rhythm snapshot={snapshot} person={h.id} />
      </section>
      <section className="av-step">
        <header>
          <span>02</span>
          <h3>Six layers of memory</h3>
          <small className="cm-hint">each fact tagged by how we know it and how old it is · usable now, not after a nightly batch</small>
        </header>
        <div className="cm-layers">
          {LAYERS.map(([id, name, what]) => (
            <article key={id} className="cm-layer">
              <header>
                <b>{name}</b>
                <small>{what}</small>
              </header>
              {facts[id].length ? (
                <ul>
                  {facts[id].map((f, i) => (
                    <li key={i}>
                      {f.event ? (
                        <button onClick={() => inspect(f.event!)} title="Open source record">
                          {f.text}
                        </button>
                      ) : (
                        <span>{f.text}</span>
                      )}
                      <em>
                        <i className={`cm-tag is-${f.how}`}>{f.how}</i>
                        {age(f.at, snapshot.clock)} old
                      </em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cm-none">Nothing recorded at this moment.</p>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="av-step">
        <header>
          <span>03</span>
          <h3>Same signal, three memories</h3>
          <small className="cm-hint">each person’s memory as its own space, placed by meaning · the star is tonight’s signal, joined to what it reminds us of in their history</small>
        </header>
        <MemoryMap h={h} snapshot={snapshot} inspect={inspect} onPerson={onPerson} />
      </section>
      <div className="cm-pair">
        <section className="av-step">
          <header>
            <span>04</span>
            <h3>What’s already been said, and by which channel</h3>
          </header>
          <ol className="cm-said">
            {said.map((s, i) => (
              <li key={i}>
                <time>
                  {day(s.at)} · {time(s.at)}
                </time>
                <span className="cm-channel">{s.channel}</span>
                {s.event ? (
                  <button onClick={() => inspect(s.event!)}>{s.text}</button>
                ) : (
                  <span>{s.text}</span>
                )}
                <small>{s.who}</small>
              </li>
            ))}
            {!said.length && <p className="cm-none">Nothing said yet.</p>}
          </ol>
        </section>
        <section className="av-step">
          <header>
            <span>05</span>
            <h3>What this decision used, and what it held back</h3>
          </header>
          {decision ? (
            <>
              <p className="cm-decision">
                <b>{decision.title}</b> · {decision.revision ? `decided at ${time(decision.time)}` : ""}
              </p>
              <span className="cm-label">Read · {used.length} records</span>
              <div className="cm-used">
                {used.map((e) => (
                  <button key={e.id} onClick={() => inspect(e)}>
                    {e.type}
                  </button>
                ))}
              </div>
              {h.memory && h.memory.items.length > 0 && (
                <>
                  <span className="cm-label">Memories retrieved for this moment · {h.memory.items.length}</span>
                  <ul className="cm-memories">
                    {h.memory.items.map((m) => (
                      <li key={m.id}>
                        <i className={`cm-tag is-${m.epistemic}`}>{m.epistemic}</i>
                        {m.text.length > 140 ? `${m.text.slice(0, 140)}…` : m.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <span className="cm-label">Held back</span>
              <ul className="cm-held">
                <li>{heldBack} other records about this service were not needed for this decision</li>
                <li>{windows} routine router windows summarised as a pattern, not read one by one</li>
                {others.map((o) => (
                  <li key={o}>{o} — not used for a service decision about {first}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="cm-none">No decision yet. The history is read when the first signal arrives.</p>
          )}
        </section>
      </div>
    </div>
  );
}
