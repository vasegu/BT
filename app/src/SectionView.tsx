import { ArbiterWorkbench } from "./ArbiterWorkbench";
import { CustomerMemory } from "./CustomerMemory";
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
      <CustomerMemory
        key={h.id}
        h={h}
        snapshot={snapshot}
        decision={decision}
        inspect={inspect}
      />
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
              {snapshot.operations.incident?.id || "Unconfirmed"}
            </Field>
            <Field label="Services in scope">
              {snapshot.operations.incident
                ? `${snapshot.operations.incident.affected.length} / ${snapshot.households.length}`
                : "Unknown"}
            </Field>
            <Field label="Unallocated slots">
              {String(
                snapshot.operations.slots.filter((s) => !s.person && !s.owner)
                  .length,
              ).padStart(2, "0")}
            </Field>
          </div>
        </div>
        <div className="scope-board">
          <div className="scope-origin">
            <span className="eyebrow">AFFECTED-SERVICE REGISTER</span>
            <h3>
              {snapshot.operations.incident?.id || "No confirmed incident"}
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
                      {s.owner
                        ? `${s.owner} / ${snapshot.households.find((p) => p.id === s.person)?.name.split(" ")[0] || "Reserved"}`
                        : "Available"}
                    </strong>
                    <small>
                      {s.owner
                        ? snapshot.households.find((p) => p.id === s.person)
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
      <ArbiterWorkbench
        key={h.id}
        h={h}
        snapshot={snapshot}
        decision={decision}
        inspect={inspect}
      />
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
          Service updates carry through from the shared state. Eve reads the
          same customer history and operational context for chat and voice
          support.
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
