# Actions & outcomes: did the plan work?

The outcome workspace lives in **Actions & outcomes**. It follows action → expectation → observation → memory for the next decision. Operational memory separately owns shared incident scope, capacity, commitments and source freshness. This corrects the earlier placement of verification under Operations.

Jio references: `AgentHealthDash.jsx` (linked action selection and concrete inspection), `FlywheelView.jsx`, arbiter `selector.py`, `outcome_checker.py`, `urgency.py`. We use their traceable action/verification structure and linked behaviour-space inspection. The evidence timeline contains five actual expectations. Actions & outcomes also has a Hodoscope-style map of the replay’s stored decision runs, described in [the behaviour-space note](2026-09-25-behaviour-space.md). Customer Memory remains the separate customer-history atlas.

Mark’s narrative §3.4 asks whether the plan worked and whether its result returns to memory. This implementation answers a bounded version for the three quiet-router cases:

- Daniel: fresh service recovery, kept callback and explicit customer confirmation are distinct targets. A message receipt satisfies none of them.
- Sam: a delivered hub and proactive update still leave successful first use unknown. The replay does not invent that missing outcome.
- Maya: a recorded watch ends on a fresh heartbeat with no outbound message. This does not measure avoided calls or satisfaction.

## Runtime

`outcome_contracts` stores each goal, original decision/action link, scope anchor, expected event, deadline, baseline and attribution limit. Unique session/person/goal/scope anchors prevent duplicate plans from resetting a deadline. `outcome_checks` appends one verification per contract/revision: waiting, met, unverified or contradicted, with source IDs, observed time and on-time result.

The worker verifies existing contracts before calling Jev, then commits new contracts with the selected plan. `bt-jev-v2-outcomes` includes only the current person’s verification memory in the model input. The UI reports a model read only when a successful persisted assessment contains the contract. This is in-context reuse of outcome memory, not model training.

The checker matches fresh, same-person, qualifying events. Both occurred and received times must be in the historical snapshot. It uses the latest observation inside the original case/obligation boundary, so a later case cannot fulfil or fail an older episode. Missing evidence after a deadline remains unverified. Callback deadlines come from the existing promise; other verification windows (10-minute watch / 30-minute service, confirmation, activation checks) are explicit demo policy, not predicted repair times or production SLAs.

Old sessions are reconstructed from their stored decisions and source events, with `reconstructed` provenance visible. No old Jev assessments are rewritten or rerun. New runs capture contracts with their decisions. Writes are idempotent across restarts.

## Learning and commercial boundary

The bandit flywheel is a conceptual strip only, as requested: context + action + outcome → reward definition → improved action/timing policy. No trainer, exploration policy or automated reward optimisation runs. A real rollout needs attribution/evaluation design, negative outcomes, repeat-contact measures, sustained service observations and actual commercial follow-up. The UI does not convert five checks into a success-rate benchmark or claim causal churn/cost improvement.

Verification currently runs on replay events, not a wall-clock deadline scheduler. This is a fixed synthetic scenario; no operational tooling is invoked, no real callback is booked, and delivery remains simulated. Outcomes can inform selection among the existing bounded proposals; they do not invent new domain actions. The incident stays open until an explicit shared closure source exists.

## Validation

- Unit/integration suite: 41 tests pass, including delivery-vs-benefit, separate proof obligations, late-arriving records, historical isolation, durable reopening, scoped model input, wrong-person/wrong-promise records, repeated observations and replacement-case isolation and newer shared evidence overriding an earlier heartbeat.
- Fresh live Jev replay: `a3d0a506-abb7-4c39-923e-dbd48394a9ba`; 15 successful evaluations over five revisions. Initial requests contain no outcome memory; subsequent requests contain 3 Daniel / 1 Sam / 1 Maya contracts with the current check states.
- Independent review identified latest-observation, replacement-scope and failed-model-read issues; all corrected. A follow-up review found cross-source recency masking; the checker now compares personal and shared negative evidence in one timeline.
- Browser verification: desktop fit, keyboard path selection, source inspection, historical replay, filters and JSON contract dialog. Production build and semantic lab verification pass.
