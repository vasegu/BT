export type PersonId = "daniel" | "sam" | "maya";
export type Step =
  | "heartbeat"
  | "incident"
  | "restore"
  | "callback"
  | "confirm";
export type SourceEvent = {
  id: string;
  sessionId: string;
  revision: number;
  occurredAt: string;
  receivedAt: string;
  source: string;
  type: string;
  subject: PersonId | "shared";
  description: string;
  payload: Record<string, unknown>;
};
export type Household = {
  id: PersonId;
  name: string;
  serviceId: string;
  owner: string | null;
  caseStatus: string;
  promise: string | null;
  promiseFulfilled: boolean;
  serviceState: string;
  activation: string;
  habit: string | null;
  restartTried: boolean;
  restored: boolean;
  confirmed: boolean;
  incident: boolean;
  contactAllowed: boolean;
  evidence: SourceEvent[];
};
export type Decision = {
  id: string;
  person: PersonId;
  revision: number;
  time: string;
  domain: string;
  disposition: string;
  title: string;
  reason: string;
  evidenceIds: string[];
  held: { title: string; reason: string; wake: string }[];
  policyVersion: string;
  trace?: ArbitrationTrace;
};
export type ProposalCheck = {
  id: string;
  label: string;
  state: "pass" | "fail" | "unknown";
  detail: string;
  evidenceIds: string[];
};
export type Proposal = {
  id: string;
  agent: string;
  title: string;
  domain: string;
  disposition: string;
  reason: string;
  wake: string;
  effect: string;
  status: "selected" | "held" | "blocked" | "merged";
  priority: number;
  factors: { label: string; value: number }[];
  checks: ProposalCheck[];
  evidenceIds: string[];
};
export type ArbitrationTrace = {
  version: 1;
  triggerIds: string[];
  selectedId: string;
  previousDecisionId: string | null;
  candidates: Proposal[];
  changes: {
    field: string;
    before: string;
    after: string;
    evidenceIds: string[];
  }[];
  execution: {
    stage: string;
    status: "passed" | "committed" | "held" | "deduplicated";
    detail: string;
    actionId?: string;
    receiptId?: string;
  }[];
};
export type DemoAction = {
  id: string;
  person: PersonId;
  revision: number;
  time: string;
  kind: string;
  title: string;
  body: string;
  status: string;
  decisionId: string;
  receiptId: string | null;
  provenance: "demo_action";
};
export type Snapshot = {
  session: {
    id: string;
    seedVersion: string;
    step: number;
    revision: number;
    createdAt: string;
  };
  cutoff: number;
  historical: boolean;
  clock: string;
  pendingJobs: number;
  failedJobs: number;
  households: Household[];
  events: SourceEvent[];
  decisions: Decision[];
  actions: DemoAction[];
  operations: {
    incident: { id: string; affected: PersonId[]; status: string } | null;
    slots: { time: string; owner: string | null; person: PersonId | null }[];
  };
  nextStep: Step | null;
};
