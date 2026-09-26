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
  "diagnostic.completed": "Diagnostic",
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
          ["Maya told us", h.habit || "No habit recorded", "preference.stated"],
          [
            "History shows",
            h.memory?.items.find(m=>m.kind==='pattern')?.text || `${events.find((e) => e.type === "pattern.recorded")?.payload.sampleSize ?? "No"} overnight gaps followed by recovery`,
            "pattern.recorded",
          ],
          ["Latest signal", h.serviceState, events.at(-1)?.type],
        ]
      : h.id === "daniel"
        ? [
            [
              "Earlier attempt",
              h.restartTried
                ? "Restart tried · unsuccessful"
                : "No restart result",
              "diagnostic.completed",
            ],
            [
              "Relationship",
              `${h.owner || "Unassigned"} · ${h.caseStatus} case`,
              "case.opened",
            ],
            [
              "Commitment",
              h.promise
                ? `${time(h.promise)} callback · ${h.promiseFulfilled ? "kept" : "outstanding"}`
                : "No promise recorded",
              h.promiseFulfilled ? "promise.fulfilled" : "promise.created",
            ],
          ]
        : [
            ["What arrived", "Hub delivery recorded", "order.delivered"],
            [h.firstUseObserved ? "What is verified" : "What is missing", h.firstUseObserved ? "Successful first use observed" : "Successful first use", h.firstUseObserved ? "activation.first_use_observed" : undefined],
            ["Latest signal", h.serviceState, events.at(-1)?.type],
          ];
  return (
    <div className="customer-memory">
      <div className="km-upper">
        <MemoryAtlas
          sourceUrl={h.memory ? `/api/memory-space?session=${snapshot.session.id}&person=${h.id}&at=${snapshot.cutoff}` : undefined}
          person={h.id}
          name={h.name.split(" ")[0]}
          incident={Boolean(snapshot.operations.incident)}
          hasSignal={snapshot.cutoff > 0}
        />
        <aside className="km-understanding">
          <div className="km-person">
            <span className="km-kicker">02 / READ THE CUSTOMER’S HISTORY</span>
            <h2>
              {h.id === "maya"
                ? "An overnight rhythm."
                : h.id === "sam"
                  ? h.firstUseObserved ? "A verified first use." : "A first-use gap."
                  : "A history to honour."}
            </h2>
            <p>
              {h.id === "maya"
                ? "A missing heartbeat means more when you remember the person behind it."
                : h.id === "sam"
                  ? "Delivered equipment does not establish a working connection."
                  : "Earlier attempts and promises stay attached to the relationship."}
            </p>
          </div>
          <dl className="km-facts">
            {knowledge.map(([label, value, sourceType], i) => {
              const source = events.filter((e) => e.type === sourceType).at(-1);
              return (
                <div key={label} className={`km-fact km-fact-${i}`}>
                  <dt><span>{String(i + 1).padStart(2, "0")}</span>{label}</dt>
                  <dd>
                    {source ? (
                      <button
                        aria-label={`Trace ${label?.toLowerCase()}`}
                        aria-pressed={event?.id === source.id}
                        onClick={() => setEventId(source.id)}
                        title="Trace this to its source record below"
                      >
                        {value}<span aria-hidden="true">↙</span>
                      </button>
                    ) : value}
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="km-implication">
            <span className="km-kicker">03 / CHOOSE THE RESPONSE</span>
            <h3>{decision?.title || "Wait for the first signal."}</h3>
            <p>
              {decision?.reason ||
                "The source history is ready. No action has been selected."}
            </p>
            <span className="km-decision-tag">
              {decision
                ? `${decision.disposition} / ${decision.trace?.assessment ? decision.trace.assessment.effective === "model" ? "Jev + policy" : "policy hold" : "rule-derived"}`
                : "No decision yet"}
            </span>
          </div>
          {h.linkedServices && h.linkedServices.length>1 && <p className="km-provenance">Explicit account links: {h.linkedServices.map(s=>`${s.product} · ${s.state}`).join(" / ")}. Product health is evaluated separately.</p>}
          <p className="km-provenance">
            {h.memory ? "Supabase source records → evidence-linked memory → real MiniLM embeddings. Synthetic histories; similarity is not confidence." : "Atlas: saved example context. Readout: synthetic session records. History summary is authored; similarity is not confidence."}
          </p>
        </aside>
      </div>
      <section className="km-history" aria-label="Customer memory over time">
        <header>
          <h2>Follow the evidence</h2>
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
