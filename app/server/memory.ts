import { createHash } from "node:crypto";
import { stableId } from "../../scripts/generate-bt-history.ts";
import type { FixtureEvent } from "./data-model.ts";

export type MemoryItem = {
  id: string;
  sessionId: string;
  personId: string;
  serviceId: string;
  kind: "episode" | "preference" | "pattern";
  epistemic: "observed" | "stated" | "derived";
  text: string;
  evidenceIds: string[];
  availableFrom: string;
  contentHash: string;
  derivationVersion: string;
  measurement?: {
    sample: number;
    returns: number;
    incomplete: number;
    from: string;
    to: string;
  };
};
export const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function availableEvents(events: FixtureEvent[], cutoff: string) {
  const time = Date.parse(cutoff);
  if (!Number.isFinite(time)) throw new Error("Invalid context cutoff");
  const known = [
    ...new Map(
      events
        .filter(
          (e) =>
            Date.parse(e.occurredAt) <= time && Date.parse(e.knownAt) <= time,
        )
        .map((e) => [e.id, e]),
    ).values(),
  ];
  const superseded = new Set(
    known.flatMap((e) => (e.supersedesId ? [e.supersedesId] : [])),
  );
  return known
    .filter((e) => !superseded.has(e.id))
    .sort(
      (a, b) =>
        Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
        Date.parse(a.knownAt) - Date.parse(b.knownAt) ||
        a.id.localeCompare(b.id),
    );
}
export function deriveMemories(input: {
  sessionId: string;
  personId: string;
  serviceId: string;
  cutoff: string;
  events: FixtureEvent[];
}): MemoryItem[] {
  const { sessionId, personId, serviceId, cutoff } = input;
  const events = availableEvents(input.events, cutoff).filter(
    (e) => e.personId === personId && e.serviceId === serviceId,
  );
  const items: MemoryItem[] = [];
  const add = (
    kind: MemoryItem["kind"],
    epistemic: MemoryItem["epistemic"],
    text: string,
    evidence: FixtureEvent[],
    measurement?: MemoryItem["measurement"],
  ) => {
    const evidenceIds = [...new Set(evidence.map((e) => e.id))].sort();
    const contentHash = hash({ text, evidenceIds, measurement });
    items.push({
      id: stableId(
        `${sessionId}/${personId}/${serviceId}/${kind}/${contentHash}`,
      ),
      sessionId,
      personId,
      serviceId,
      kind,
      epistemic,
      text,
      evidenceIds,
      availableFrom: new Date(
        Math.max(...evidence.map((e) => Date.parse(e.knownAt))),
      ).toISOString(),
      contentHash,
      derivationVersion: "bt-memory-v1",
      ...(measurement ? { measurement } : {}),
    });
  };
  const conversations = new Set(
    events
      .filter((e) => e.type === "conversation.message")
      .map((e) => e.payload.conversationId),
  );
  for (const conversation of conversations) {
    const rows = events.filter(
      (e) =>
        e.type === "conversation.message" &&
        e.payload.conversationId === conversation,
    );
    add(
      "episode",
      "observed",
      `Support conversation ${rows[0].occurredAt.slice(0, 10)}. ` +
        rows.map((e) => `${e.payload.speakerRole}: ${e.description}`).join(" "),
      rows,
    );
  }
  for (const e of events.filter((e) =>
    ["preference.stated", "interest.stated"].includes(e.type),
  ))
    add("preference", "stated", e.description, [e]);
  for (const e of events.filter((e) =>
    [
      "diagnostic.completed",
      "service.restored_observed",
      "service.failure_observed",
      "activation.first_use_observed",
    ].includes(e.type),
  ))
    add("episode", "observed", `${e.occurredAt}: ${e.description}`, [e]);
  const nights = events
    .filter(
      (e) =>
        e.type === "router.overnight_window" &&
        Date.parse(String(e.payload.windowEnd)) <= Date.parse(cutoff),
    )
    .slice(-28);
  if (nights.length >= 7) {
    const returned = nights.filter(
      (e) => e.payload.returnObserved === true,
    ).length;
    const measurement = {
      sample: nights.length,
      returns: returned,
      incomplete: nights.length - returned,
      from: String(nights[0].payload.windowStart),
      to: String(nights.at(-1)!.payload.windowEnd),
    };
    const evidenceIds = new Set(
      nights.flatMap((e) => [e.id, ...(e.payload.evidenceIds as string[])]),
    );
    add(
      "pattern",
      "derived",
      `${returned} observed returns among ${nights.length} overnight windows; ${nights.length - returned} incomplete. Observed routine only, not a forecast of tonight's return.`,
      events.filter((e) => evidenceIds.has(e.id)),
      measurement,
    );
  }
  return items;
}

export function rankMemories(
  items: MemoryItem[],
  vectors: Map<string, number[]>,
  query: number[],
  limit = 4,
) {
  return items
    .filter((m) => vectors.has(m.id))
    .map((m) => ({
      item: m,
      score: vectors.get(m.id)!.reduce((sum, n, i) => sum + n * query[i], 0),
    }))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, limit);
}
