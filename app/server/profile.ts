import type { HouseholdFixture } from "./data-model.ts";
import type { HouseholdProfile } from "../src/types.ts";

// Customer memory beyond tonight, read at the cutoff: every profile row is time-aware, so the
// household's devices, product use, churn risk and contact history change as the story plays.
type Row = Record<string, unknown> & { person?: string; valid_from?: string };

const londonHour = (iso: string) =>
  Number(new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false })) % 24;
const londonWeekend = (iso: string) =>
  ["Sat", "Sun"].includes(new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short" }));

export function profileFor(fixture: HouseholdFixture, alias: string, cutoff: string): HouseholdProfile | undefined {
  const rows = (table: string) =>
    ((fixture.tables[table] ?? []) as Row[]).filter(
      (r) => r.person === alias && Date.parse(String(r.valid_from)) <= Date.parse(cutoff),
    );
  if (!fixture.tables["profile.members"]) return undefined;
  const latest = (table: string) =>
    rows(table).sort((a, b) => Date.parse(String(a.valid_from)) - Date.parse(String(b.valid_from))).at(-1);
  // Products: the latest state of each product known by the cutoff.
  const products = new Map<string, Row>();
  for (const r of rows("profile.product_usage").sort((a, b) => Date.parse(String(a.valid_from)) - Date.parse(String(b.valid_from))))
    products.set(String(r.product), r);
  const contract = latest("profile.contracts");
  const end = contract ? Date.parse(String(contract.end)) : 0;
  const monthsLeft = contract ? Math.round((end - Date.parse(cutoff)) / (30.44 * 86400e3)) : 0;
  const churn = latest("profile.churn");
  const usage = latest("profile.usage");
  const hour = londonHour(cutoff);
  const weekend = londonWeekend(cutoff);
  let now: HouseholdProfile["now"] = null;
  if (usage) {
    const curve = JSON.parse(String(weekend ? usage.weekend : usage.weekday)) as number[];
    const share = curve[hour] ?? 0;
    const peak = Math.max(...curve);
    const next = curve[(hour + 1) % 24] ?? 0;
    now = {
      hour,
      weekend,
      share,
      label:
        share >= peak * 0.9
          ? "Peak hour for this home"
          : next >= peak * 0.9
            ? "Just before this home’s busiest hours"
          : share >= peak * 0.5
            ? "A busy hour for this home"
            : share > 0.05
              ? "A quiet hour for this home"
              : "Usually offline at this hour",
    };
  }
  const prefs = latest("profile.preferences");
  return {
    members: rows("profile.members").map((r) => ({ name: String(r.name), relation: String(r.relation) })),
    devices: rows("profile.devices").map((r) => ({
      name: String(r.name),
      kind: String(r.kind),
      owner: String(r.owner),
      since: String(r.valid_from),
    })),
    products: [...products.values()].map((r) => ({
      key: String(r.product),
      name: String(r.name),
      brand: String(r.brand),
      since: String(r.since),
      status: String(r.status),
      detail: String(r.detail),
    })),
    contract: contract
      ? {
          start: String(contract.start),
          end: String(contract.end),
          arpu: Number(contract.arpu),
          extra: (contract.extra as string | null) ?? null,
          monthsLeft,
          outOfContract: end < Date.parse(cutoff),
        }
      : null,
    churn: churn
      ? { level: churn.level as "low" | "medium" | "high", score: Number(churn.score), drivers: JSON.parse(String(churn.drivers)) as string[], asOf: String(churn.valid_from) }
      : null,
    usage: usage ? { weekday: JSON.parse(String(usage.weekday)), weekend: JSON.parse(String(usage.weekend)), note: String(usage.note) } : null,
    now,
    contacts: rows("profile.contacts")
      .sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))
      .map((r) => ({ at: String(r.at), channel: String(r.channel), with: String(r.with), topic: String(r.topic), outcome: String(r.outcome) })),
    preferences: prefs
      ? {
          channel: String(prefs.channel),
          quietHours: (prefs.quietHours as string | null) ?? null,
          offers: Boolean(prefs.offers),
          ...(prefs.offersNote ? { offersNote: String(prefs.offersNote) } : {}),
        }
      : null,
  };
}
