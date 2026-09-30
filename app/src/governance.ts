import type { Authority } from "./types";

// The policy register: the one place that says what each action may do, who may authorise it,
// and whether the customer sees it. The arbiter enforces it; the Governance panel displays it.
export type ActionPolicy = {
  id: string;
  title: string;
  mode: Authority["mode"] | "conditional";
  /** Who authorises it. "Case owner" is resolved to the named person at decision time. */
  role: string;
  why: string;
  visible: boolean;
  reversible: boolean;
};
export const ACTION_POLICY: ActionPolicy[] = [
  { id: "watch", title: "Observe quietly", mode: "autonomous", role: "AgentOps lead", why: "No customer contact and no commitment. An internal watch only.", visible: false, reversible: true },
  { id: "activation", title: "Check activation", mode: "autonomous", role: "AgentOps lead", why: "A provisioning check and a status update. Nothing is promised.", visible: true, reversible: true },
  { id: "first-use", title: "Confirm first use", mode: "autonomous", role: "AgentOps lead", why: "Records an observed fact and confirms it. Reversible, and nothing is promised.", visible: true, reversible: true },
  { id: "incident", title: "Coordinate the shared incident", mode: "autonomous", role: "AgentOps lead", why: "One scoped update from the confirmed incident register. No new commitment.", visible: true, reversible: true },
  { id: "confirmation", title: "Confirm recovery", mode: "autonomous", role: "AgentOps lead", why: "Records the customer’s confirmation of recovery. The case owner retains responsibility until formal closure.", visible: true, reversible: true },
  { id: "restart", title: "Suggest a hub restart", mode: "autonomous", role: "AgentOps lead", why: "A local test instruction. Must never repeat a failed one.", visible: true, reversible: true },
  { id: "restoration", title: "Recovery follow-up", mode: "conditional", role: "Case owner", why: "Runs on its own after a fresh observation, unless a promise is open; then the person who made it keeps it.", visible: true, reversible: true },
  { id: "recovery", title: "Continue the recovery plan", mode: "human-led", role: "Case owner", why: "The case owner leads. The system keeps the history together so nobody starts again.", visible: true, reversible: true },
  { id: "monitor", title: "Keep extra monitoring running", mode: "autonomous", role: "AgentOps lead", why: "Watches a line after a fix. No customer contact while there is nothing to say.", visible: false, reversible: true },
  { id: "monitor-close", title: "Close extra monitoring and tell the customer", mode: "autonomous", role: "AgentOps lead", why: "Confirms a fix has held, timed to the household’s week. No new commitment.", visible: true, reversible: true },
  { id: "quiet-fix-note", title: "Tell the customer about a fix they didn’t notice", mode: "autonomous", role: "AgentOps lead", why: "One short note, outside their quiet hours. Nothing is asked of them.", visible: true, reversible: true },
  { id: "early-life", title: "Guide setup of included products", mode: "autonomous", role: "AgentOps lead", why: "Helps a new customer use what they already pay for. No sale.", visible: true, reversible: true },
  { id: "early-life-complete", title: "Confirm early life is complete", mode: "autonomous", role: "AgentOps lead", why: "Records that everything included is in use and stops setup guidance.", visible: true, reversible: true },
  { id: "steady", title: "Do nothing", mode: "autonomous", role: "AgentOps lead", why: "Nothing outstanding. The right action is none.", visible: false, reversible: true },
  { id: "callback", title: "Arrange a callback", mode: "sign-off", role: "Care team lead", why: "Reserves scarce capacity and makes a promise to the customer.", visible: true, reversible: false },
  { id: "engineer", title: "Book an engineer visit", mode: "sign-off", role: "Case owner + field scheduling", why: "Costs a field slot and the customer’s time. Only a person may book it.", visible: true, reversible: false },
  { id: "offer", title: "Recommend another product", mode: "sign-off", role: "Memory & Trust Officer", why: "Using service data for a sale needs the customer’s opt-in and an offer signed off in advance; otherwise it waits for a person.", visible: true, reversible: false },
];

/** Resolve a policy row to the authority recorded on a decision. */
export function authorityFor(id: string, owner: string | null, promiseOpen: boolean): Authority | undefined {
  const p = ACTION_POLICY.find((x) => x.id === id);
  if (!p) return undefined;
  const role = p.role.replace("Case owner", owner || "the care team");
  if (p.mode === "conditional")
    return promiseOpen
      ? { mode: "human-led", role, why: `The line is back, but ${role} still owes the call. The person keeps the promise; the system only updates.` }
      : { mode: "autonomous", role: "AgentOps lead", why: "A status update from a fresh observation. Nothing new is promised." };
  return { mode: p.mode, role: p.mode === "autonomous" ? p.role : role, why: p.why };
}
