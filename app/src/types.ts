export type PersonId = "daniel" | "sam" | "maya";
export type Step =
  | "heartbeat"
  | "incident"
  | "restore"
  | "callback"
  | "confirm";
export type SourceEvent = {
  serviceId?: string | null;
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
  linkedServices?: {reference:string;product:string;state:string}[];
  memory?: { hash: string; items: import('../server/memory.ts').MemoryItem[] };
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
export type AssessmentQuestion = {
  type: "choice" | "score";
  instructions: string;
  criteria: Record<string, string> | string[];
};
export type ModelAssessment = {
  id: string;
  status: "ok" | "error" | "interrupted";
  provider: string;
  model: string;
  promptVersion: string;
  inputHash: string;
  state: Record<string, unknown>;
  questions: Record<string, AssessmentQuestion>;
  answers: Record<
    string,
    { choice?: string; score?: number; probabilities: Record<string, number> }
  >;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  generationId: string | null;
  httpStatus?: number;
  error?: string;
  baselineId?: string;
  effective?: "model" | "policy_hold";
  resolution?: string;
};
export type ArbitrationTrace = {
  version: 1;
  assessment?: ModelAssessment;
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
  storage?: 'sqlite' | 'supabase';
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
    outcomes: OutcomeEpisode[];
    incident: { id: string; affected: PersonId[]; status: string } | null;
    slots: { time: string; owner: string | null; person: PersonId | null }[];
  };
  nextStep: Step | null;
};

export type OutcomeGoal =
  | "service"
  | "callback"
  | "confirmation"
  | "activation"
  | "watch";
export type OutcomeContract = {
  id: string;
  person: PersonId;
  goal: OutcomeGoal;
  scopeId: string;
  decisionId: string;
  actionId: string | null;
  revision: number;
  createdAt: string;
  dueAt: string;
  title: string;
  baseline: string;
  target: string;
  expectedEvent: string;
  deadlineBasis: string;
  attribution: string;
  evidenceIds: string[];
  provenance: "committed" | "reconstructed";
  version: "bt-outcomes-v1";
};
export type OutcomeCheck = {
  revision: number;
  checkedAt: string;
  status: "waiting" | "met" | "unverified" | "contradicted";
  observedAt: string | null;
  onTime: boolean | null;
  evidenceIds: string[];
  finding: string;
  nextDecision: string;
};
export type OutcomeEpisode = OutcomeContract & { check: OutcomeCheck };
