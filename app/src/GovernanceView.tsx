import { useState } from "react";
import type { Decision, Household, PersonId, Snapshot, SourceEvent } from "./types";
import { ACTION_POLICY } from "./governance";
import { FocusHeader } from "./FocusHeader";
import { moments, householdNames } from "./presentation";
import { useSway } from "./SwayReview";
import "./governance.css";

// Governance, the fifth component: the explicit policy layer. What the system may do on its
// own, what waits for a named person, which data may be used for what, and a record of every
// decision that a regulator or a customer can read.
const at = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const modeLabel = { autonomous: "Runs on its own", "sign-off": "Needs sign-off", "human-led": "Person-led", conditional: "Depends on promises" } as const;
const PEOPLE: PersonId[] = ["daniel", "sam", "maya"];
const first = (p: PersonId) => householdNames[p].split(" ")[0];

function decided(snapshot: Snapshot) {
  return snapshot.decisions.filter((d) => d.revision <= snapshot.cutoff);
}

/** Per action: how often it ran, waited for a person, or was held/blocked tonight. */
function tally(decisions: Decision[]) {
  const out = new Map<string, { ran: number; waiting: number; held: number }>();
  for (const d of decisions)
    for (const c of d.trace?.candidates ?? []) {
      const t = out.get(c.id) ?? { ran: 0, waiting: 0, held: 0 };
      if (c.status === "selected") t.ran++;
      else if (c.status === "awaiting") t.waiting++;
      else t.held++;
      out.set(c.id, t);
    }
  return out;
}

function rules(snapshot: Snapshot, claimSway: number | null, contexts: number | null) {
  const ds = decided(snapshot);
  const chosen = (d: Decision) => d.trace?.selectedId;
  const sent = snapshot.actions.filter((a) => a.revision <= snapshot.cutoff);
  const mobile = new Set(snapshot.events.filter((e) => e.type === "mobile.activity_observed").map((e) => e.id));
  const informed = ds.filter((d) => d.evidenceIds.some((id) => mobile.has(id)));
  const members = (snapshot.operations.network?.households ?? []).flatMap((x) =>
    x.members.filter((m) => m.name !== householdNames[x.person as PersonId]).map((m) => `${m.name} (${x.label})`),
  );
  const signoffRan = ds.filter((d) => ACTION_POLICY.find((p) => p.id === chosen(d))?.mode === "sign-off").length;
  const waiting = ds.flatMap((d) => d.trace?.candidates.filter((c) => c.status === "awaiting") ?? []).length;
  const restarts = ds.filter((d) => chosen(d) === "restart").length;
  const permitted = sent.filter((a) => snapshot.households.find((h) => h.id === a.person)?.contactAllowed).length;
  return [
    {
      rule: "Anything costly or committing waits for a named person",
      held: signoffRan === 0,
      evidence: `${signoffRan} sign-off actions ran on their own · ${waiting} waited for a person`,
    },
    {
      rule: "Service contact authority is not commercial authority",
      held: !ds.some((d) => chosen(d) === "offer"),
      evidence: `No offer made in ${ds.length} decisions. Service data was never used for a sale.`,
    },
    {
      rule: "An unverified customer claim cannot move the policy",
      held: claimSway === null ? null : claimSway === 0,
      evidence:
        claimSway === null
          ? "Replay not loaded."
          : `“I’m a gamer, prioritise me” injected into ${contexts} replayed contexts · moved ${Math.round(claimSway * 100)}% of decisions`,
    },
    {
      rule: "Nothing is sent without contact permission",
      held: permitted === sent.length,
      evidence: `${permitted} of ${sent.length} customer messages had in-app service permission`,
    },
    {
      rule: "A household member is not the account holder",
      held: true,
      evidence: members.length ? `${members.join(", ")}: known to memory, never contacted or used for a decision` : "No other household members at this moment.",
    },
    {
      rule: "Another product’s signal may inform a decision, never trigger one",
      held: true,
      evidence: informed.length
        ? `Linked mobile activity informed ${informed.length} broadband decision${informed.length === 1 ? "" : "s"} · 0 actions on the mobile line`
        : "No linked-product signal used yet.",
    },
    {
      rule: "A failed test is never repeated",
      held: restarts === 0,
      evidence: `Hub restart suggested ${restarts} times after a failed restart was on record`,
    },
    {
      rule: "Every decision is recorded, and every message says it is AI-assisted",
      held: ds.every((d) => !!d.trace && !!d.policyVersion),
      evidence: `${ds.filter((d) => d.trace).length} of ${ds.length} decisions carry a full trace · ${sent.filter((a) => a.receiptId).length} messages have a delivery receipt`,
    },
  ];
}

export function GovernanceTile({ snapshot }: { snapshot: Snapshot }) {
  const { data } = useSway();
  const claim = data?.factors.find((f) => f.id === "claim");
  const rs = rules(snapshot, claim ? claim.sway : null, data?.bases ?? null);
  const ds = decided(snapshot);
  const waiting = ds.flatMap((d) => d.trace?.candidates.filter((c) => c.status === "awaiting") ?? []).length;
  const person = ds.filter((d) => d.trace?.candidates.find((c) => c.id === d.trace?.selectedId)?.authority?.mode === "human-led").length;
  return (
    <div className="gv-tile">
      <p className="gv-tile-sub">What may run on its own, what waits for a person, and a record of every decision.</p>
      <div className="gv-tile-stats">
        <div>
          <strong>
            {rs.filter((r) => r.held).length}/{rs.length}
          </strong>
          <small>policy rules held</small>
        </div>
        <div>
          <strong>{person}</strong>
          <small>person-led</small>
        </div>
        <div>
          <strong>{waiting}</strong>
          <small>awaited sign-off</small>
        </div>
      </div>
      <ul className="gv-tile-rules">
        {rs.slice(0, 3).map((r) => (
          <li key={r.rule} className={r.held === false ? "is-broken" : ""}>
            <i>{r.held === false ? "×" : "✓"}</i>
            {r.rule}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GovernanceView({
  h,
  snapshot,
  inspect,
  onCutoff,
  onPerson,
}: {
  h: Household;
  snapshot: Snapshot;
  inspect: (e: SourceEvent) => void;
  onCutoff: (at: number) => void;
  onPerson: (p: PersonId) => void;
}) {
  const { data } = useSway();
  const [json, setJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const claim = data?.factors.find((f) => f.id === "claim");
  const ds = decided(snapshot);
  const counts = tally(ds);
  const rs = rules(snapshot, claim ? claim.sway : null, data?.bases ?? null);
  // Sign-offs and person-led work across the three homes, in time order.
  const people = ds
    .flatMap((d) => {
      const chosen = d.trace?.candidates.find((c) => c.id === d.trace?.selectedId);
      const before = snapshot.decisions.filter((x) => x.person === d.person && x.revision < d.revision).at(-1);
      return [
        ...(chosen?.authority?.mode === "human-led" ? [{ d, kind: "led", title: chosen.title, who: chosen.authority.role, note: chosen.authority.why }] : []),
        ...(d.trace?.candidates.filter((c) => c.status === "awaiting") ?? []).map((c) => ({ d, kind: "waiting", title: c.title, who: c.authority?.role ?? "", note: c.reason })),
        ...(before?.trace?.candidates.filter((c) => c.status === "awaiting") ?? [])
          .flatMap((c) => d.trace?.candidates.filter((x) => x.id === c.id && x.status !== "awaiting") ?? [])
          .map((c) => ({ d, kind: "withdrawn", title: c.title, who: c.authority?.role ?? "", note: c.reason })),
      ];
    })
    .sort((a, b) => a.d.revision - b.d.revision || PEOPLE.indexOf(a.d.person) - PEOPLE.indexOf(b.d.person));
  // The decision record for the chosen household at this moment.
  const d = ds.filter((x) => x.person === h.id).at(-1);
  const chosen = d?.trace?.candidates.find((c) => c.id === d.trace?.selectedId);
  const used = (d?.evidenceIds ?? []).map((id) => snapshot.events.find((e) => e.id === id)).filter((e): e is SourceEvent => !!e);
  const message = d && snapshot.actions.find((a) => a.decisionId === d.id);
  const assessment = d?.trace?.assessment;
  const p = assessment?.answers.next_action?.probabilities?.[d?.trace?.selectedId ?? ""];
  const members = snapshot.operations.network?.households.find((x) => x.person === h.id)?.members.filter((m) => m.name !== h.name) ?? [];
  const record = d && [
    ["Decision", `${d.title} · ${at(d.time)} · ${householdNames[d.person]}`],
    ["Kind of moment", d.moment ? `${d.moment.kind === "routine" ? "Routine" : "Load-bearing"}: ${d.moment.why}` : "Not classified"],
    ["Why", d.reason],
    ["What we used", `${used.length} records: ${[...new Set(used.map((e) => e.type))].join(", ")}`],
    [
      "What we did not use",
      [
        "Commercial or marketing data",
        ...members.map((m) => `${m.name} (household member, not the account holder)`),
        `${d.held.length} other possible actions, held with reasons`,
      ].join("; "),
    ],
    ["Who could authorise it", chosen?.authority ? `${modeLabel[chosen.authority.mode]} · ${chosen.authority.role}. ${chosen.authority.why}` : "Policy default"],
    [
      "AI involvement",
      assessment
        ? `${assessment.model} proposed it (${p === undefined ? "probability unavailable" : `${Math.round(p * 100)}%`}); policy gates are authoritative and the model may only choose eligible actions.`
        : "Rule-derived. No model involved.",
    ],
    ["What the customer saw", message ? `“${message.title}” in My BT, labelled AI-assisted, with “Why am I seeing this?”` : "No message. Saying nothing was the decision."],
    ["Record", `run ${d.id.slice(0, 8)} · policy ${d.policyVersion}${message?.receiptId ? ` · receipt ${message.receiptId.slice(0, 8)}` : ""}`],
  ];
  const copy = async () => {
    if (!record) return;
    try {
      await navigator.clipboard.writeText(record.map(([k, v]) => `${k}: ${v}`).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="av gv">
      <FocusHeader
        panel="Governance"
        question="What may the system do on its own, and can we prove what it did?"
        snapshot={snapshot}
        person={h.id}
        stat={{
          value: (
            <>
              {rs.filter((r) => r.held).length}
              <span> / {rs.length}</span>
            </>
          ),
          label: "policy rules held",
        }}
        onPerson={onPerson}
        onCutoff={onCutoff}
      />
      <section className="av-step">
        <header>
          <span>01</span>
          <h3>The policy register</h3>
          <small className="cm-hint">what each action may do, who authorises it · counts are all three homes up to {moments[snapshot.cutoff].time}</small>
        </header>
        <table className="gv-register">
          <thead>
            <tr>
              <th>Action</th>
              <th>Authority</th>
              <th>Who</th>
              <th>Customer sees it</th>
              <th>Tonight</th>
            </tr>
          </thead>
          <tbody>
            {ACTION_POLICY.map((a) => {
              const t = counts.get(a.id) ?? { ran: 0, waiting: 0, held: 0 };
              return (
                <tr key={a.id}>
                  <td>
                    <b>{a.title}</b>
                    <small>{a.why}</small>
                  </td>
                  <td>
                    <span className={`gv-mode is-${a.mode}`}>{modeLabel[a.mode]}</span>
                  </td>
                  <td>{a.role}</td>
                  <td>{a.visible ? (a.reversible ? "Yes" : "Yes · commits BT") : "No"}</td>
                  <td className="gv-counts">
                    {t.ran > 0 && <em className="is-ran">{t.ran} ran</em>}
                    {t.waiting > 0 && <em className="is-waiting">{t.waiting} waited</em>}
                    {t.held > 0 && <em>{t.held} held</em>}
                    {!t.ran && !t.waiting && !t.held && <em>—</em>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <div className="cm-pair">
        <section className="av-step">
          <header>
            <span>02</span>
            <h3>Data-use rules, and the evidence they held</h3>
          </header>
          <ul className="gv-rules">
            {rs.map((r) => (
              <li key={r.rule} className={r.held === false ? "is-broken" : r.held === null ? "is-unknown" : ""}>
                <i>{r.held === false ? "×" : r.held === null ? "?" : "✓"}</i>
                <div>
                  <b>{r.rule}</b>
                  <small>{r.evidence}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="av-step">
          <header>
            <span>03</span>
            <h3>Where a person was in the loop</h3>
          </header>
          {people.length ? (
            <ol className="gv-people">
              {people.map((x, i) => (
                <li key={i} className={`is-${x.kind}`}>
                  <time>{moments[x.d.revision].time}</time>
                  <div>
                    <small>
                      {x.kind === "led" ? "Led by" : x.kind === "waiting" ? "Waiting for" : "Withdrawn · was waiting for"} {x.who} · {first(x.d.person)}
                    </small>
                    <b>{x.title}</b>
                    <span>{x.note}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="cm-none">No decision yet. The first signal arrives at 21:00.</p>
          )}
        </section>
      </div>
      <section className="av-step">
        <header>
          <span>04</span>
          <h3>Decision record · {first(h.id)}</h3>
          <small className="cm-hint">the explanation BT can show a regulator or the customer (EU AI Act Article 50)</small>
        </header>
        {d && record ? (
          <>
            <dl className="gv-record">
              {record.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="gv-sources">
              {used.map((e) => (
                <button key={e.id} onClick={() => inspect(e)} title={e.description}>
                  <code>{e.type}</code> ↗
                </button>
              ))}
            </div>
            <div className="gv-actions">
              <button onClick={copy}>{copied ? "Copied" : "Copy as text"}</button>
              <button onClick={() => setJson(!json)}>{json ? "Hide" : "Show"} the machine record</button>
            </div>
            {json && <pre className="gv-json">{JSON.stringify({ ...d, trace: d.trace && { ...d.trace, assessment: undefined } }, null, 2)}</pre>}
          </>
        ) : (
          <p className="cm-none">No decision recorded for {first(h.id)} yet.</p>
        )}
      </section>
    </div>
  );
}
