import { useState } from "react";
import { MemoryAtlas } from "./MemoryAtlas";
import type { Decision, Household, Snapshot, SourceEvent } from "./types";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
  });
const eventNames: Record<string, string> = {
  "contact.authority_recorded": "Authority",
  "case.opened": "Case opened",
  "diagnostic.completed": "Restart tried",
  "promise.created": "Promise made",
  "order.delivered": "Hub delivered",
  "preference.stated": "Habit stated",
  "pattern.recorded": "Pattern retained",
  "router.heartbeat_overdue": "Signal raised",
  "router.heartbeat_received": "Heartbeat back",
  "service.restored_observed": "Restored",
  "promise.fulfilled": "Promise kept",
  "customer.confirmed_working": "Confirmed",
};

export function CustomerMemory({
  h,
  snapshot,
  decision,
  inspect,
}: {
  h: Household;
  snapshot: Snapshot;
  decision?: Decision;
  inspect: (e: SourceEvent) => void;
}) {
  const [eventId, setEventId] = useState<string | null>(null);
  const events = h.evidence.filter((e) => e.subject === h.id);
  const event = events.find((e) => e.id === eventId) || events.at(-1);
  const knowledge =
    h.id === "maya"
      ? [
          ["Stated habit", h.habit || "No habit recorded"],
          [
            "Retained pattern",
            `${events.find((e) => e.type === "pattern.recorded")?.payload.sampleSize ?? "No"} recovered gaps · synthetic summary`,
          ],
          ["Latest observation", h.serviceState],
        ]
      : h.id === "daniel"
        ? [
            [
              "Earlier attempt",
              h.restartTried
                ? "Restart tried · unsuccessful"
                : "No restart result",
            ],
            [
              "Relationship",
              `${h.owner || "Unassigned"} · ${h.caseStatus} case`,
            ],
            [
              "Commitment",
              h.promise
                ? `${time(h.promise)} callback · ${h.promiseFulfilled ? "kept" : "outstanding"}`
                : "No promise recorded",
            ],
          ]
        : [
            ["Known history", "Hub delivery recorded"],
            ["Still unknown", "Activation and successful first use"],
            ["Latest observation", h.serviceState],
          ];
  return (
    <div className="customer-memory">
      <div className="km-upper">
        <MemoryAtlas
          person={h.id}
          name={h.name.split(" ")[0]}
          incident={Boolean(snapshot.operations.incident)}
          hasSignal={snapshot.cutoff > 0}
        />
        <aside className="km-understanding">
          <div className="km-person">
            <span className="km-kicker">02 / WHAT WE KNOW</span>
            <h2>
              {h.id === "maya"
                ? "An overnight rhythm."
                : h.id === "sam"
                  ? "A first-use gap."
                  : "A history to honour."}
            </h2>
            <p>
              {h.id === "maya"
                ? "Her stated habit changes how a quiet router is interpreted."
                : h.id === "sam"
                  ? "Delivered equipment does not establish a working connection."
                  : "Earlier attempts and promises stay attached to the relationship."}
            </p>
          </div>
          <dl className="km-facts">
            {knowledge.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="km-implication">
            <span className="km-kicker">03 / WHAT THIS CHANGES</span>
            <h3>{decision?.title || "Wait for the first signal."}</h3>
            <p>
              {decision?.reason ||
                "The source history is ready. No action has been selected."}
            </p>
            <span className="km-decision-tag">
              {decision
                ? `${decision.disposition} / rule-derived`
                : "No decision yet"}
            </span>
          </div>
          <p className="km-provenance">
            Atlas: saved lab scenario context,{" "}
            {snapshot.operations.incident
              ? "with incident scope"
              : "before incident scope"}
            . Readout and timeline: this session’s source records. Similarity is
            not confidence.
          </p>
        </aside>
      </div>
      <section className="km-history" aria-label="Customer memory over time">
        <header>
          <h2>Memory over time</h2>
          <span>{events.length} CUSTOMER RECORDS · SELECT TO TRACE</span>
        </header>
        <div className="km-timeline">
          {events.map((e) => (
            <button
              key={e.id}
              aria-pressed={event?.id === e.id}
              onClick={() => setEventId(e.id)}
              title={`${e.occurredAt}: ${e.description}`}
            >
              <time>
                {time(e.occurredAt)}
                <small>
                  {new Date(e.occurredAt).toLocaleDateString("en-GB", {
                    timeZone: "Europe/London",
                    day: "2-digit",
                    month: "short",
                  })}
                </small>
              </time>
              <i />
              <span>{eventNames[e.type] || e.type}</span>
            </button>
          ))}
        </div>
        {event && (
          <div className="km-evidence" aria-live="polite">
            <div>
              <code>{event.type}</code>
              <p>{event.description}</p>
            </div>
            <button
              onClick={() => inspect(event)}
              aria-label="Inspect selected source record"
            >
              Source record ↗
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
