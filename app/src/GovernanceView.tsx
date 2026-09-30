import { hasRecordedApproval, recordedContactPermission } from "./governance-status";
import { formatDateTime } from "./time";
import { useState } from "react";
import type { Decision, Household, PersonId, Snapshot, SourceEvent } from "./types";
import { ACTION_POLICY } from "./governance";
import { FocusHeader } from "./FocusHeader";
import { householdNames } from "./presentation";
import { useSway } from "./SwayReview";
import { ScopeTag, StandingBand } from "./Scope";
import "./governance.css";

// Governance, the fifth component: the explicit policy layer. What the system may do on its
// own, what waits for a named person, which data may be used for what, and a record of every
// decision that a regulator or a customer can read.
const at = formatDateTime;
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
  const requiresApproval = ds.filter((d) => ACTION_POLICY.find((p) => p.id === chosen(d))?.mode === "sign-off");
  const authorised = (d: Decision) => hasRecordedApproval(d, snapshot.events);
  const signoffRan = requiresApproval.filter((d) => !authorised(d)).length;
  const approved = requiresApproval.length - signoffRan;
  const offers = ds.filter((d) => chosen(d) === "offer");
  const waiting = ds.flatMap((d) => d.trace?.candidates.filter((c) => c.status === "awaiting") ?? []).length;
  const restarts = ds.filter((d) => chosen(d) === "restart").length;
  const permissions = sent.map(a => recordedContactPermission(ds.find(d => d.id === a.decisionId), snapshot.events));
  const permitted = permissions.filter(p => p === true).length;
  const denied = permissions.filter(p => p === false).length;
  const unknown = permissions.filter(p => p === null).length;
  return [
    {
      rule: "Anything costly or committing waits for a named person",
      held: signoffRan === 0,
      evidence: `${approved} actions with recorded prior approval · ${signoffRan} without evidenced approval · ${waiting} awaited approval`,
    },
    {
      rule: "Service contact authority is not commercial authority",
      held: offers.every(authorised),
      evidence: `${offers.length} offer decisions · ${offers.filter(authorised).length} with a passed commercial-permission gate and dated approval evidence.`,
    },
    {
      rule: "Static rules fixture: unchanged policy facts retain the decision",
      held: claimSway === null ? null : claimSway === 0,
      evidence:
        claimSway === null
          ? "Replay not loaded."
          : `Rules-only fixture: claim wording changed in ${contexts} contexts · moved ${Math.round(claimSway * 100)}% of decisions. This does not test live-model resistance.`,
    },
    {
      rule: "Nothing is sent without contact permission",
      held: denied ? false : unknown ? null : true,
      evidence: `${permitted} of ${sent.length} messages have decision-time service permission · ${denied} denied · ${unknown} not evidenced`,
    },
    {
      rule: "A household member is not the account holder",
      held: null,
      evidence: `Not measured: recipient/member identity usage is not audited. ${members.length ? `${members.join(", ")} are recorded in memory.` : "No other household members at this moment."}`,
    },
    {
      rule: "Another product’s signal may inform a decision, never trigger one",
      held: null,
      evidence: informed.length
        ? `Linked mobile activity informed ${informed.length} broadband decision${informed.length === 1 ? "" : "s"} · product trigger and delivery scope not measured`
        : "No linked-product evidence cited yet; product trigger and delivery scope not measured.",
    },
    {
      rule: "A failed test is never repeated",
      held: null,
      evidence: `${restarts} restart decisions recorded; prior failed-test matching is not measured.`,
    },
    {
      rule: "Every recorded decision carries a trace and policy version",
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
          <small>rules evidenced</small>
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
            <i>{r.held === false ? "×" : r.held === null ? "?" : "✓"}</i>
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
  const totals = [...counts.values()].reduce((a, t) => ({ ran: a.ran + t.ran, waiting: a.waiting + t.waiting }), { ran: 0, waiting: 0 });
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
          label: "rules evidenced",
        }}
        onPerson={onPerson}
        onCutoff={onCutoff}
      />
      <div className="cm-pair">
        <section className="av-step">
          <header>
            <span>01</span>
            <h3>Where a person was in the loop</h3>
            <ScopeTag scope="moment" snapshot={snapshot} person={h.id} />
          </header>
          {people.length ? (
            <ol className="gv-people">
              {people.map((x, i) => (
                <li key={i} className={`is-${x.kind}${x.d.person === h.id ? " is-focus" : ""}`}>
                  <time>{at(x.d.time)}</time>
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
        <section className="av-step">
          <header>
            <span>02</span>
            <h3>Did every rule hold?</h3>
            <ScopeTag scope="moment" snapshot={snapshot} person={h.id} />
          </header>
          <p className="gv-tally">
            Recorded replay history, all three homes: <b>{totals.ran}</b> actions ran · <b>{totals.waiting}</b> waited for a person ·{" "}
            <b>{rs.filter((r) => r.held === false).length}</b> rules broken · <b>{rs.filter((r) => r.held === null).length}</b> not measured
          </p>
          <PolicyRules rows={rs} />
        </section>
      </div>
      <section className="av-step">
        <header>
          <span>03</span>
          <h3>Decision record · {first(h.id)}</h3>
          <small className="cm-hint">the explanation BT can show a regulator or the customer (EU AI Act Article 50)</small>
          <ScopeTag scope="both" snapshot={snapshot} person={h.id} />
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
      <StandingBand note="The policy itself. The same for every customer at every moment; sections above show how it was applied.">
        <section className="av-step">
          <header>
            <span>04</span>
            <h3>The policy register</h3>
            <small className="cm-hint">what each action may do, and who may authorise it</small>
          </header>
          <table className="gv-register">
            <thead>
              <tr>
                <th>Action</th>
                <th>Authority</th>
                <th>Who</th>
                <th>Customer sees it</th>
              </tr>
            </thead>
            <tbody>
              {ACTION_POLICY.map((a) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </StandingBand>
    </div>
  );
}

function PolicyRules({ rows }: { rows: ReturnType<typeof rules> }) { return (          <ul className="gv-rules">
            {rows.map((r) => (
              <li key={r.rule} className={r.held === false ? "is-broken" : r.held === null ? "is-unknown" : ""}>
                <i>{r.held === false ? "×" : r.held === null ? "?" : "✓"}</i>
                <div>
                  <b>{r.rule}</b>
                  <small>{r.evidence}</small>
                </div>
              </li>
            ))}
          </ul>); }
export function GovernanceEvidence({ snapshot }: { snapshot: Snapshot }) {
  const { data } = useSway();
  const claim = data?.factors.find(f => f.id === "claim");
  return <div><p className="gv-tally">Recorded replay history · all three households</p><PolicyRules rows={rules(snapshot, claim?.sway ?? null, data?.bases ?? null).filter((_, i) => [0, 1, 3, 7].includes(i))} /></div>;
}
