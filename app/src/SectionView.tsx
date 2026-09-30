import { formatDateTime } from "./time";
import { ActionsView } from "./ActionsView";
import { OperationsView } from "./OperationsView";
import { ArbiterWorkbench } from "./ArbiterWorkbench";
import { CustomerMemoryView } from "./CustomerMemoryView";
import { FocusHeader } from "./FocusHeader";
import { GovernanceView } from "./GovernanceView";
import { DecisionFlow } from "./DecisionFlow";
import type { ReactNode } from "react";
import type {
  Snapshot,
  Household,
  Decision,
  DemoAction,
  SourceEvent,
  PersonId,
} from "./types";

const time = formatDateTime;
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
  onPerson,
}: {
  panel: string;
  onCutoff: (at: number) => void;
  onPerson: (person: PersonId) => void;
  h: Household;
  snapshot: Snapshot;
  decision: Decision | undefined;
  actions: DemoAction[];
  phone: ReactNode;
  inspect: (e: SourceEvent) => void;
}) {
  if (panel === "customer")
    return (
      <CustomerMemoryView
        h={h}
        snapshot={snapshot}
        decision={decision}
        inspect={inspect}
        onCutoff={onCutoff}
        onPerson={onPerson}
      />
    );
  if (panel === "operations")
    return (
      <OperationsView
        h={h}
        snapshot={snapshot}
        inspect={inspect}
        onCutoff={onCutoff}
        onPerson={onPerson}
      />
    );
  const first = h.name.split(" ")[0];
  const chosen = decision?.trace?.candidates.find((c) => c.id === decision.trace?.selectedId);
  if (panel === "arbiter")
    return (
      <div className="av aw-page">
        <FocusHeader
          panel="Arbiter"
          question={`What should happen for ${first}, if anything?`}
          scope="both"
          snapshot={snapshot}
          person={h.id}
          onPerson={onPerson}
          onCutoff={onCutoff}
        />
        <DecisionFlow h={h} snapshot={snapshot} decision={decision} />
        <ArbiterWorkbench
          key={`${h.id}/${snapshot.cutoff}`}
          h={h}
          snapshot={snapshot}
          decision={decision}
          inspect={inspect}
        />
      </div>
    );
  if (panel === "governance")
    return <GovernanceView h={h} snapshot={snapshot} inspect={inspect} onCutoff={onCutoff} onPerson={onPerson} />;
  if (panel === "actions")
    return (
      <ActionsView
        h={h}
        snapshot={snapshot}
        inspect={inspect}
        onCutoff={onCutoff}
        onPerson={onPerson}
      />
    );
  return (
    <div className="av">
      <FocusHeader
        panel="Customer experience"
        question={`What does ${first} actually see, and why?`}
        scope="both"
        snapshot={snapshot}
        person={h.id}
        stat={{ value: actions.length, label: actions.length === 1 ? "update delivered" : "updates delivered" }}
        onPerson={onPerson}
        onCutoff={onCutoff}
      />
    <div className="full-section channel-section">
      <div className="channel-context">
        <span className="eyebrow">Behind the screen</span>
        {decision ? (
          <>
            <h3 className="channel-decision">{decision.title}</h3>
            <p className="channel-reason">{decision.reason}</p>
            <div className="av-governance">
              {decision.moment && (
                <span className={`av-moment is-${decision.moment.kind}`}>
                  {decision.moment.kind === "routine" ? "Routine moment" : "Load-bearing moment"}
                </span>
              )}
              {chosen?.authority && (
                <span className={`av-auth is-${chosen.authority.mode}`}>
                  {chosen.authority.mode === "autonomous"
                    ? "Ran on its own"
                    : chosen.authority.mode === "human-led"
                      ? `Led by ${chosen.authority.role}`
                      : `Signed off by ${chosen.authority.role}`}
                </span>
              )}
              {decision.moment && <p>{decision.moment.why}</p>}
            </div>
          </>
        ) : (
          <p>
            {h.caseStatus === "open" && h.owner && h.owner !== "Activation team"
              ? `No network signal yet, but ${first} already has an open case: the line has been dropping and ${h.owner} is looking after it. The phone shows what ${first} sees before tonight’s signal.`
              : `No network signal yet. The phone shows what ${first} would see today.`}
          </p>
        )}
        <div className="full-fields">
          <Field label="Current service state">{h.serviceState}</Field>
          <Field label="Named owner">{h.owner || "No open case"}</Field>
        </div>
      </div>
      <div className="full-phone">{phone}</div>
      <div className="channel-receipts">
        <span className="eyebrow">Channel evidence</span>
        <h3>
          {!actions.length
            ? "No message recorded at this point."
            : "The phone and the record agree."}
        </h3>
        <p>
          {!actions.length
            ? "No delivery is recorded for this household by the selected replay time."
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
    </div>
  );
}
