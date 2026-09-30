import type { Household } from "./types";

export const formatDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", {
  timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
});
export const daypart = (iso: string) => {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(new Date(iso)));
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
};
export const sameLondonDay = (a: string, b: string) => {
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
  return date.format(new Date(a)) === date.format(new Date(b));
};
export function lifecycle(h: Household, clock: string): "unconnected" | "first connected" | "onboarding" | "established usage" {
  if (!h.firstUseObserved && h.activation !== "Activation confirmed") return "unconnected";
  const first = h.evidence.find((e) => e.type === "activation.first_use_observed");
  if (first && sameLondonDay(first.occurredAt, clock)) return "first connected";
  if (h.engaged || !h.firstUseObserved || (first && Date.parse(clock) - Date.parse(first.occurredAt) >= 14 * 864e5)) return "established usage";
  return "onboarding";
}

/** First London 02:00 strictly after the signal, including both DST transitions. */
export function nextLondonBatch(iso: string): number {
  const after = Date.parse(iso);
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" });
  let candidate = Math.floor(after / 3600e3) * 3600e3 + 3600e3;
  while (hour.format(candidate) !== "02") candidate += 3600e3;
  return candidate;
}
