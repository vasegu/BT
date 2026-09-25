import type { ReactNode } from "react";
import type {
  Snapshot,
  Household,
  Decision,
  DemoAction,
  SourceEvent,
} from "./types";

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
const short = (id: string) => id.slice(0, 8);
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="section-field">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}
function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="section-block">
      <header>
        <h2>{title}</h2>
        {note && <span>{note}</span>}
      </header>
      <div className="section-block-body">{children}</div>
    </section>
  );
}
function Records({
  events,
  inspect,
}: {
  events: SourceEvent[];
  inspect: (e: SourceEvent) => void;
}) {
  return (
    <div className="full-records">
      {events.map((e) => (
        <button key={e.id} onClick={() => inspect(e)}>
          <time>
            {time(e.occurredAt)}
            <small>
              {new Date(e.occurredAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                timeZone: "Europe/London",
              })}
            </small>
          </time>
          <span className="record-spine">
            <i />
          </span>
          <span>
            <code>{e.type}</code>
            <strong>{e.description}</strong>
            <small>
              {e.source} · {short(e.id)}
            </small>
          </span>
          <span>↗</span>
        </button>
      ))}
    </div>
  );
}
function Outcomes({ h }: { h: Household }) {
  return (
    <div className="outcome-cards">
      {[
        [
          "01",
          "Technical restoration",
          h.restored,
          "A fresh service observation",
        ],
        [
          "02",
          "Callback fulfilled",
          h.promiseFulfilled,
          h.promise ? "A kept commitment" : "No callback obligation",
        ],
        [
          "03",
          "Customer confirmation",
          h.confirmed,
          "A statement from the customer",
        ],
      ].map(([id, label, yes, detail]) => (
        <div key={String(id)} className={yes ? "is-observed" : ""}>
          <span>{id}</span>
          <h3>{label}</h3>
          <strong>
            {yes
              ? "Observed"
              : id === "02" && !h.promise
                ? "Not applicable"
                : "Not observed"}
          </strong>
          <p>{detail}</p>
        </div>
      ))}
    </div>
  );
}

export function SectionView({
  panel,
  h,
  snapshot,
  decision,
  actions,
  phone,
  inspect,
}: {
  panel: string;
  h: Household;
  snapshot: Snapshot;
  decision: Decision | undefined;
  actions: DemoAction[];
  phone: ReactNode;
  inspect: (e: SourceEvent) => void;
}) {
  const personal = h.evidence.filter((e) => e.subject === h.id),
    ops = snapshot.events.filter((e) => e.subject === "shared");
  if (panel === "customer")
    return (
      <div className="full-section memory-section">
        <div className="section-banner">
          <div>
            <span className="eyebrow">
              Records → current state → retained learning
            </span>
            <h2>The history stays with {h.name.split(" ")[0]}.</h2>
            <p>
              Every current fact below resolves to a source record. Later
              observations add to the history.
            </p>
          </div>
          <div className="section-metrics">
            <Field label="Source records">
              {personal.length.toString().padStart(2, "0")}
            </Field>
            <Field label="Visible through">{time(snapshot.clock)}</Field>
            <Field label="Scope">This customer</Field>
          </div>
        </div>
        <div className="section-columns">
          <Block
            title="Customer source history"
            note="APPEND-ONLY / SELECT TO INSPECT"
          >
            <Records events={personal} inspect={inspect} />
          </Block>
          <div className="section-side">
            <Block title="Current state" note="PROJECTED FROM RECORDS">
              <div className="full-fields">
                <Field label="Service">{h.serviceState}</Field>
                <Field label="Case">{h.caseStatus}</Field>
                <Field label="Named owner">{h.owner || "No open case"}</Field>
                <Field label="Commitment">
                  {h.promise
                    ? `${time(h.promise)} · ${h.promiseFulfilled ? "fulfilled" : "outstanding"}`
                    : "None recorded"}
                </Field>
                <Field label="Service contact authority">
                  {h.contactAllowed ? "Verified / in-app" : "Not established"}
                </Field>
              </div>
            </Block>
            <Block title="What carries forward" note="RETAINED EVIDENCE">
              <div className="retained-memory">
                <span>◈</span>
                <h3>
                  {h.id === "daniel"
                    ? "Earlier attempts are not forgotten."
                    : h.id === "sam"
                      ? "Delivery and first use stay separate."
                      : "A stated habit has a source."}
                </h3>
                <p>
                  {h.id === "daniel"
                    ? "The unsuccessful restart, the existing owner and the callback remain available even when the service state changes."
                    : h.id === "sam"
                      ? "The order proves that equipment arrived. No successful-use observation is available in this record set."
                      : `${h.habit}. The synthetic history summary records 26 gaps followed by recovery; this is context for a watch, not proof that every future gap is harmless.`}
                </p>
              </div>
            </Block>
          </div>
        </div>
      </div>
    );
  if (panel === "operations")
    return (
      <div className="full-section operations-section">
        <div className="section-banner">
          <div>
            <span className="eyebrow">Shared operating context</span>
            <h2>Scope is explicit. Capacity is finite.</h2>
            <p>
              The shared incident register and callback allocation, separate
              from private customer conversations.
            </p>
          </div>
          <div className="section-metrics">
            <Field label="Incident">
              {snapshot.operations.incident ? "INC-017" : "Unconfirmed"}
            </Field>
            <Field label="Services in scope">
              {snapshot.operations.incident
                ? `${snapshot.operations.incident.affected.length} / ${snapshot.households.length}`
                : "Unknown"}
            </Field>
            <Field label="Unallocated slots">
              {String(
                snapshot.operations.slots.filter((s) => !s.person).length,
              ).padStart(2, "0")}
            </Field>
          </div>
        </div>
        <div className="scope-board">
          <div className="scope-origin">
            <span className="eyebrow">AFFECTED-SERVICE REGISTER</span>
            <h3>
              {snapshot.operations.incident
                ? "INC-017"
                : "No confirmed incident"}
            </h3>
            <p>
              {snapshot.operations.incident?.status ||
                "Membership cannot be inferred from missing telemetry."}
            </p>
            <code>
              {ops.at(-1) ? short(ops.at(-1)!.id) : "—"} / source record
            </code>
          </div>
          <div className="scope-services">
            {snapshot.households.map((p) => (
              <article
                key={p.id}
                className={`${p.id === h.id ? "current-household" : ""} ${p.incident ? "affected" : ""}`}
              >
                <span className="scope-connector" />
                <div>
                  <span className="eyebrow">{p.serviceId}</span>
                  <h3>{p.name}</h3>
                </div>
                <span className="membership">
                  {snapshot.operations.incident
                    ? p.incident
                      ? "IN SCOPE"
                      : "OUTSIDE SCOPE"
                    : "UNKNOWN"}
                </span>
              </article>
            ))}
          </div>
        </div>
        <div className="section-columns">
          <Block title="Operational source records" note="SHARED SCOPE ONLY">
            <Records events={ops} inspect={inspect} />
          </Block>
          <Block title="Callback allocation" note="SOURCE-BACKED SNAPSHOT">
            <div className="full-slots">
              {snapshot.operations.slots.map((s) => (
                <div key={s.time}>
                  <time>{s.time}</time>
                  <span>
                    <strong>
                      {s.owner ? `${s.owner} / Daniel` : "Available"}
                    </strong>
                    <small>
                      {s.owner
                        ? snapshot.households.find((p) => p.id === "daniel")
                            ?.promiseFulfilled
                          ? "Callback completed; historical allocation retained"
                          : "Reserved for the existing promise"
                        : "No customer has been promised this slot"}
                    </small>
                  </span>
                  <i className={s.owner ? "allocated" : ""} />
                </div>
              ))}
            </div>
            <p className="section-footnote">
              A restored service does not cancel an outstanding callback. No new
              appointment is allocated by this scenario.
            </p>
          </Block>
        </div>
      </div>
    );
  if (panel === "arbiter")
    return (
      <div className="full-section arbiter-section">
        <div className="section-banner">
          <div>
            <span className="eyebrow">
              {decision
                ? `${decision.policyVersion} / rule-derived`
                : "Waiting for a source event"}
            </span>
            <h2>{decision?.title || "The next event wakes the arbiter."}</h2>
            <p>
              {decision?.reason ||
                "Return to the account and run the scenario. The signal will be evaluated against both memories."}
            </p>
          </div>
          <div className="section-metrics">
            <Field label="Disposition">
              {decision?.disposition || "Awaiting"}
            </Field>
            <Field label="Evidence">
              {decision?.evidenceIds.length || 0} records
            </Field>
            <Field label="Domain">{decision?.domain || "—"}</Field>
          </div>
        </div>
        <div className="runtime-flow">
          <svg
            viewBox="0 0 1280 310"
            role="img"
            aria-label="Original ambient flag combined with current customer and operational memory; the arbiter selects a path and holds incompatible actions"
          >
            <defs>
              <pattern
                id="runtime-dots"
                width="18"
                height="18"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r=".5" fill="#665175" opacity=".45" />
              </pattern>
            </defs>
            <rect width="1280" height="310" fill="url(#runtime-dots)" />
            <g className="runtime-wires">
              <path d="M240 155C275 155 265 87 305 87M240 155C275 155 265 235 305 235M525 87C575 87 575 155 620 155M525 235C575 235 575 155 620 155M850 155C900 155 900 88 950 88" />
              <path
                className="held-wire"
                d="M850 155C900 155 900 235 950 235"
              />
            </g>
            <g className="runtime-node" transform="translate(40 118)">
              <rect width="200" height="75" rx="6" />
              <text x="15" y="23" className="kicker">
                01 / ORIGINAL AMBIENT FLAG
              </text>
              <text x="15" y="48">
                {snapshot.cutoff
                  ? "Heartbeat overdue"
                  : "Awaiting source event"}
              </text>
            </g>
            <g className="runtime-node" transform="translate(305 48)">
              <rect width="220" height="78" rx="6" />
              <text x="15" y="23" className="kicker">
                02 / CUSTOMER MEMORY
              </text>
              <text x="15" y="48">
                {personal.length} records ·{" "}
                {h.promise ? "promise retained" : "personal context"}
              </text>
            </g>
            <g className="runtime-node" transform="translate(305 196)">
              <rect width="220" height="78" rx="6" />
              <text x="15" y="23" className="kicker">
                02 / OPERATIONAL MEMORY
              </text>
              <text x="15" y="48">
                {snapshot.operations.incident
                  ? h.incident
                    ? "INC-017 · in scope"
                    : "INC-017 · outside scope"
                  : "No confirmed incident"}
              </text>
            </g>
            <g className="runtime-node key-node" transform="translate(620 107)">
              <rect width="230" height="96" rx="6" />
              <text x="16" y="24" className="kicker">
                03 / ARBITER
              </text>
              <text x="16" y="50">
                {decision?.domain || "Wider context"}
              </text>
              <text x="16" y="74" className="kicker">
                {decision?.disposition.toUpperCase() || "NO MANDATE YET"}
              </text>
            </g>
            <g className="runtime-node" transform="translate(950 48)">
              <rect width="277" height="78" rx="6" />
              <text x="16" y="24" className="kicker">
                04 / SELECTED PATH
              </text>
              <text x="16" y="49">
                {decision?.title || "Await evidence"}
              </text>
            </g>
            <g
              className="runtime-node held-node"
              transform="translate(950 196)"
            >
              <rect width="277" height="78" rx="6" />
              <text x="16" y="24" className="kicker">
                HELD ALTERNATIVES
              </text>
              <text x="16" y="49">
                {decision
                  ? "Repeat restart / product offer"
                  : "No assessment yet"}
              </text>
            </g>
          </svg>
          <div className="runtime-flow-foot">
            <span>TRACE / {decision ? short(decision.id) : "NOT STARTED"}</span>
            <span>CURRENT SESSION RECORDS · NO LIVE MODEL INFERENCE</span>
          </div>
        </div>
        <div className="section-columns">
          <Block title="Why alternatives are held" note="WITH WAKE CONDITIONS">
            {decision?.held.map((c) => (
              <div className="full-held" key={c.title}>
                <span className="tag amber">HOLD</span>
                <div>
                  <h3>{c.title}</h3>
                  <p>{c.reason}</p>
                  <small>Wake when: {c.wake}</small>
                </div>
              </div>
            )) || (
              <p className="section-footnote">
                No decision has been recorded at this cutoff.
              </p>
            )}
          </Block>
          <Block title="Decision contract" note="PERSISTED">
            <div className="full-fields">
              <Field label="Customer">{h.name}</Field>
              <Field label="Obligation">
                {h.promise
                  ? h.promiseFulfilled
                    ? "Fulfilled independently"
                    : "Retain 21:15 callback"
                  : "None recorded"}
              </Field>
              <Field label="Contact authority">
                {h.contactAllowed
                  ? "Verified / service / in-app"
                  : "Not established · no send"}
              </Field>
              <Field label="Action boundary">
                {h.id === "maya"
                  ? "Watch without customer contact"
                  : "In-app demo update only"}
              </Field>
            </div>
          </Block>
        </div>
      </div>
    );
  if (panel === "actions")
    return (
      <div className="full-section actions-section">
        <div className="section-banner">
          <div>
            <span className="eyebrow">
              Committed actions → subsequent observations
            </span>
            <h2>Follow-through has a record.</h2>
            <p>
              A delivery receipt, a working line and a kept promise are separate
              facts.
            </p>
          </div>
          <div className="section-metrics">
            <Field label="Actions">
              {actions.length.toString().padStart(2, "0")}
            </Field>
            <Field label="Receipts">
              {actions
                .filter((a) => a.receiptId)
                .length.toString()
                .padStart(2, "0")}
            </Field>
            <Field label="External effect">Simulated</Field>
          </div>
        </div>
        <Outcomes h={h} />
        <Block title="Action and receipt ledger" note="PERSISTED / IDEMPOTENT">
          <div className="full-action-table">
            <table>
              <thead>
                <tr>
                  <th>Scenario time</th>
                  <th>Customer-facing action</th>
                  <th>Decision → action → receipt</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <time>{time(a.time)}</time>
                    </td>
                    <td>
                      <strong>{a.title}</strong>
                      <p>{a.body}</p>
                    </td>
                    <td>
                      <code>
                        {short(a.decisionId)} → {short(a.id)} →{" "}
                        {a.receiptId ? short(a.receiptId) : "pending"}
                      </code>
                    </td>
                    <td>
                      <span className="tag">demo delivered</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!actions.length && (
              <p className="full-empty">
                {h.id === "maya"
                  ? "No customer action was committed. The quiet watch remains in the decision record."
                  : "No action has been committed at this cutoff."}
              </p>
            )}
          </div>
        </Block>
        <Block
          title="Outcome evidence"
          note="OBSERVATIONS, NOT ASSUMED SUCCESS"
        >
          <Records
            events={personal.filter((e) =>
              [
                "service.restored_observed",
                "router.heartbeat_received",
                "promise.fulfilled",
                "customer.confirmed_working",
              ].includes(e.type),
            )}
            inspect={inspect}
          />
          {!h.restored && !h.promiseFulfilled && !h.confirmed && (
            <p className="full-empty">No qualifying outcome observation yet.</p>
          )}
        </Block>
      </div>
    );
  return (
    <div className="full-section channel-section">
      <div className="channel-context">
        <span className="eyebrow">Customer channel / My BT</span>
        <h2>{h.name.split(" ")[0]}’s side of the story.</h2>
        <p>
          Only the committed customer-facing actions appear here. The internal
          decision stays behind the experience.
        </p>
        <div className="full-fields">
          <Field label="Updates delivered">{actions.length}</Field>
          <Field label="Current service state">{h.serviceState}</Field>
          <Field label="Named owner">{h.owner || "No open case"}</Field>
        </div>
      </div>
      <div className="full-phone">{phone}</div>
      <div className="channel-receipts">
        <span className="eyebrow">Channel evidence</span>
        <h3>
          {h.id === "maya"
            ? "No message is an intentional outcome."
            : "The phone and the record agree."}
        </h3>
        <p>
          {h.id === "maya"
            ? "The customer sees no new service notification. The watch is visible only to the operator."
            : "Each update has a persisted action and simulated delivery receipt. A customer reply adds a new source event."}
        </p>
        <div className="channel-receipt-list">
          {actions.slice(-3).map((a) => (
            <div key={a.id}>
              <time>{time(a.time)}</time>
              <strong>{a.title}</strong>
              <code>
                {short(a.id)} / {a.receiptId ? short(a.receiptId) : "pending"}
              </code>
            </div>
          ))}
        </div>
        <p className="section-footnote">
          Demonstrator channel · no external message is sent.
        </p>
      </div>
    </div>
  );
}
