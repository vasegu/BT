# Operational memory and outcome verification

**Goal:** Make Mark’s “did the plan work?” inspectable for each person, with the result available to the next arbiter assessment.

**Design:** Borrow Jio’s linked action inspection and deferred verification contract. Use an evidence timeline rather than invented semantic clusters for this small live replay. Keep shared scope/capacity on the left, expectations and observations in the centre, and a linked verification inspector on the right. A bottom memory ledger explains what changes the next decision. Preserve the full-page BT hierarchy and the five-panel overview.

**Architecture:** Store immutable expectation contracts and one verification record per replay revision in SQLite. Match person-scoped, fresh observations against an explicit target and deadline. Feed this bounded ledger into Jev. Old sessions are reconstructed once from their stored decisions, with that provenance visible. No external messages, training, causal uplift claims or new dependencies.

## Work
- [x] Add lifecycle tests: delivery is not success; callback is not restoration; no future evidence; same-person matching; deadline without evidence; late evidence; idempotence; durable reopen; model context scope.
- [x] Implement `server/outcomes.ts`, typed contracts/checks, tables and worker writeback in `server/engine.ts`; pass outcome memory in `server/assessment.ts`.
- [x] Replace the operational section with `OperationalMemory.tsx` and scoped CSS; linked map, source inspector, capacity/scope, per-person progress, feedback and explicit value limitations.
- [x] Add a concise outcome readout to the overview. Validate empty, early, restored and complete revisions at desktop sizes and keyboard selection.
- [x] Run full tests/build/lab checks, independent review and fix material findings. Document shipped behaviour and limits.

## Review focus
No receipts counted as customer benefit. No global incident resolution inferred from one service. Missing evidence is unknown, not failure. Future/late records respect both timestamps. A repeated decision cannot create duplicate obligations or silently change its original deadline. Existing episodes are labelled reconstructed, never represented as contracts actually captured at dispatch. Similarity/probabilities are not causal effect.

## Sources
Jio: `FlywheelView.jsx`, `AgentHealthDash.jsx`, `agentHealth/specs.js`, arbiter `selector.py`, `outcome_checker.py`, `urgency.py`. Mark: architecture §4 data flywheel, §2 silent router/first seven days. We retain explicit proof requirements rather than Jio’s permissive “spine changed” resolution proxy.

Bandit constraint: user clarified that this is a conceptual handoff only. No trainer, reward optimiser, exploration or bandit infrastructure was implemented.
