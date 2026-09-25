import { ActionOutcomes } from "./ActionOutcomes";
import { OperationalMemory } from "./OperationalMemory";
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
export function SectionView({
  panel,
  h,
  snapshot,
  decision,
  actions,
  phone,
  inspect,
  onCutoff,
}: {
  panel: string;
  onCutoff: (at: number) => void;
  h: Household;
  snapshot: Snapshot;
  decision: Decision | undefined;
  actions: DemoAction[];
  phone: ReactNode;
  inspect: (e: SourceEvent) => void;
}) {
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
      <OperationalMemory
        key={h.id}
        h={h}
        snapshot={snapshot}
        inspect={inspect}
        onCutoff={onCutoff}
      />
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
      <ActionOutcomes
        key={h.id}
        h={h}
        snapshot={snapshot}
        inspect={inspect}
        onCutoff={onCutoff}
      />
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
