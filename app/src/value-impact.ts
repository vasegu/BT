import type { Decision, Household, OutcomeEpisode, Proposal, Snapshot } from "./types.ts";

// Value to BT: what each proposed action is expected to do to the commercial relationship, and
// later, how much of that expectation the outcome evidence supports. These are modelled
// estimates from an illustrative lever table, not measured causal effects.
export const VALUE_MODEL = "bt-value-v1";

export type MetricId = "revenue" | "churn" | "purchase" | "cltv" | "cost";
export const METRICS: { id: MetricId; label: string; short: string; better: "up" | "down"; hint: string }[] = [
  { id: "revenue", label: "Net revenue · 12 mo", short: "Net rev", better: "up", hint: "Retained plus new revenue over 12 months, less cost to serve" },
  { id: "churn", label: "Churn propensity", short: "Churn", better: "down", hint: "12-month probability the household leaves" },
  { id: "purchase", label: "Likelihood to purchase", short: "Purchase", better: "up", hint: "Probability of adding or upgrading a product in 90 days" },
  { id: "cltv", label: "Customer lifetime value", short: "CLTV", better: "up", hint: "Annual revenue × expected tenure (capped at 6 years)" },
  { id: "cost", label: "Cost to serve", short: "Cost", better: "down", hint: "One-off cost of carrying out the action" },
];

export type Impact = Record<MetricId, number>;
export type Lever = { churn: number; purchase: number; uplift: number; cost: number; confidence: "low" | "medium" | "high"; basis: string };

const ZERO: Lever = { churn: 0, purchase: 0, uplift: 0, cost: 0, confidence: "high", basis: "No customer-facing change; no value moved." };

/** Expected effect of one proposal on this household, before gates. */
export function leverFor(id: string, h: Household): Lever {
  const churnHigh = (h.profile?.churn?.score ?? 0) >= 0.5;
  const arpu = h.profile?.contract?.arpu ?? 0;
  switch (id) {
    case "incident":
      return { churn: h.incident ? -0.06 : -0.01, purchase: 0, uplift: 0, cost: 0.05, confidence: "medium", basis: "Proactive incident updates cut repeat contacts and fault-driven churn." };
    case "recovery":
      return { churn: -0.05, purchase: 0, uplift: 0, cost: 0.05, confidence: "medium", basis: "Telling the customer the line is back reduces doubt during a fault." };
    case "restoration":
      return { churn: -0.03, purchase: 0, uplift: 0, cost: 0.05, confidence: "medium", basis: "Reconciling restoration keeps the case and promise intact." };
    case "confirmation":
      return { churn: -0.04, purchase: 0.01, uplift: 0, cost: 0, confidence: "high", basis: "A confirmed recovery closes the episode cleanly." };
    case "callback":
      return { churn: churnHigh ? -0.09 : -0.05, purchase: 0, uplift: 0, cost: 12, confidence: "medium", basis: "A kept human promise is the strongest retention signal in a fault." };
    case "restart":
      return { churn: -0.02, purchase: 0, uplift: 0, cost: 0.05, confidence: "low", basis: "Self-fix guidance resolves some drops; irritates if the fault is network-side." };
    case "engineer":
      return { churn: -0.08, purchase: 0, uplift: 0, cost: 95, confidence: "medium", basis: "A visit fixes persistent faults but carries a high cost to serve." };
    case "watch":
      return { churn: 0, purchase: 0, uplift: 0, cost: 0, confidence: "medium", basis: "Silence avoids contact fatigue; if the fault is real, value is deferred, not lost." };
    case "activation":
      return { churn: -0.08, purchase: 0.03, uplift: 0, cost: 0.05, confidence: "medium", basis: "Early-life customers who connect in week one are far less likely to cancel." };
    case "first-use":
      return { churn: -0.1, purchase: 0.05, uplift: 0, cost: 0, confidence: "high", basis: "Observed first use is the activation milestone for a new customer." };
    case "monitor":
      return { churn: -0.04, purchase: 0, uplift: 0, cost: 3, confidence: "medium", basis: "Heightened monitoring catches a relapse before the customer does." };
    case "monitor-close":
      return { churn: -0.02, purchase: 0, uplift: 0, cost: 0.05, confidence: "medium", basis: "Closing the loop on a held fix reinforces trust." };
    case "quiet-fix-note":
      return { churn: -0.02, purchase: 0.01, uplift: 0, cost: 0.05, confidence: "low", basis: "Telling a customer about a fix they never noticed builds credit." };
    case "early-life":
      return { churn: -0.05, purchase: 0.04, uplift: 0, cost: 0.05, confidence: "medium", basis: "Customers using everything they pay for renew and add more." };
    case "early-life-complete":
      return { churn: -0.01, purchase: 0.01, uplift: 0, cost: 0, confidence: "high", basis: "Stopping setup guidance avoids noise once everything is in use." };
    case "offer":
      return { churn: 0.01, purchase: 0.15, uplift: Math.round(arpu * 0.15) || 8, cost: 0.05, confidence: "low", basis: "An upgrade lifts revenue; unwanted offers add a little churn risk." };
    default:
      return ZERO;
  }
}

/** Five metrics for a household baseline. */
export function baselineFor(h: Household): Impact {
  const arpu = h.profile?.contract?.arpu ?? 0;
  const churn = h.profile?.churn?.score ?? 0.2;
  const purchase = Math.max(0.02, 0.1 + (h.offersAllowed ? 0.08 : 0) - (churn >= 0.5 ? 0.05 : 0));
  return { revenue: arpu * 12, churn, purchase, cltv: cltv(arpu, churn), cost: 0 };
}

const cltv = (arpu: number, churn: number) => Math.round(arpu * 12 * Math.min(6, 1 / Math.max(churn, 1 / 6)));

/** Expected change across all five metrics if this proposal were carried out. */
export function impactOf(id: string, h: Household): Impact & { lever: Lever } {
  const base = baselineFor(h);
  const arpu = h.profile?.contract?.arpu ?? 0;
  const lever = leverFor(id, h);
  const churn = Math.max(0.02, Math.min(0.95, base.churn + lever.churn)) - base.churn;
  const purchase = Math.max(0, Math.min(0.95, base.purchase + lever.purchase)) - base.purchase;
  // Retained revenue from lower churn, plus the expected uplift if the household buys.
  const revenue = Math.round(-churn * arpu * 12 + lever.uplift * 12 * Math.max(purchase, 0) - lever.cost);
  const after = cltv(arpu + lever.uplift * Math.max(purchase, 0), base.churn + churn);
  return { revenue, churn, purchase, cltv: after - base.cltv, cost: lever.cost, lever };
}

export type TradeRow = { proposal: Proposal; impact: Impact & { lever: Lever }; eligible: boolean };

/** Every proposal in a run, with its expected value, so the chosen path can be weighed against the rest. */
export function tradeOffs(d: Decision, h: Household): TradeRow[] {
  return (d.trace?.candidates ?? [])
    .filter((c) => c.status !== "merged")
    .map((proposal) => ({ proposal, impact: impactOf(proposal.id, h), eligible: proposal.checks.every((k) => k.state === "pass") }))
    .sort((a, b) => Number(b.proposal.id === d.trace?.selectedId) - Number(a.proposal.id === d.trace?.selectedId) || b.impact.revenue - a.impact.revenue);
}

export type Realisation = "evidenced" | "pending" | "at-risk" | "no-proof";
export type DecisionValue = { decision: Decision; impact: Impact & { lever: Lever }; state: Realisation; outcomes: OutcomeEpisode[] };

/** Each committed decision's expected value, and how far its outcome contracts support it. */
export function valueLedger(s: Snapshot, h: Household): DecisionValue[] {
  return s.decisions
    .filter((d) => d.person === h.id && d.revision <= s.cutoff && d.trace?.selectedId && d.trace.selectedId !== "defer")
    .map((decision) => {
      const outcomes = s.operations.outcomes.filter((o) => o.decisionId === decision.id);
      const st = outcomes.map((o) => o.check.status);
      const state: Realisation = !outcomes.length
        ? "no-proof"
        : st.some((x) => x === "contradicted" || x === "unverified")
          ? "at-risk"
          : st.every((x) => x === "met")
            ? "evidenced"
            : "pending";
      return { decision, impact: impactOf(decision.trace!.selectedId, h), state, outcomes };
    })
    .filter((v) => METRICS.some((m) => v.impact[m.id] !== 0));
}

export function sumImpact(rows: { impact: Impact }[]): Impact {
  return rows.reduce<Impact>(
    (t, r) => ({ revenue: t.revenue + r.impact.revenue, churn: t.churn + r.impact.churn, purchase: t.purchase + r.impact.purchase, cltv: t.cltv + r.impact.cltv, cost: t.cost + r.impact.cost }),
    { revenue: 0, churn: 0, purchase: 0, cltv: 0, cost: 0 },
  );
}

/** Expected (everything committed) vs evidenced (only decisions whose outcomes were all observed). */
export function valueSummary(s: Snapshot, h: Household) {
  const ledger = valueLedger(s, h);
  return {
    ledger,
    baseline: baselineFor(h),
    expected: sumImpact(ledger),
    evidenced: sumImpact(ledger.filter((v) => v.state === "evidenced")),
    atRisk: sumImpact(ledger.filter((v) => v.state === "at-risk")),
  };
}

const gbp = (n: number) => `${n < 0 ? "−" : n > 0 ? "+" : "±"}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
const pp = (n: number) => {
  const v = Math.round(n * 1000) / 10;
  return `${v < 0 ? "−" : v > 0 ? "+" : "±"}${Math.abs(v).toFixed(1)} pts`;
};

/** Signed change for display. */
export function formatDelta(id: MetricId, n: number): string {
  if (id === "churn" || id === "purchase") return pp(n);
  if (id === "cost") return n === 0 ? "£0" : `£${n < 1 ? n.toFixed(2) : Math.round(n)}`;
  return gbp(n);
}

/** Absolute level for display. */
export function formatLevel(id: MetricId, n: number): string {
  if (id === "churn" || id === "purchase") return `${Math.round(n * 100)}%`;
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

/** good / bad / flat, relative to which direction is better for BT. */
export function tone(id: MetricId, n: number): "good" | "bad" | "flat" {
  const eps = id === "churn" || id === "purchase" ? 0.0005 : 0.5;
  if (Math.abs(n) < eps) return "flat";
  const better = METRICS.find((m) => m.id === id)!.better;
  return (n > 0) === (better === "up") ? "good" : "bad";
}
