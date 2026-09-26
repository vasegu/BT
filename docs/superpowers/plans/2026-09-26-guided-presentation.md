# Guided Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Give three household stories equal, legible attention while preserving inspectable technical evidence.
**Architecture:** Pure presentation beat derivation from a frozen Snapshot plus a URL cursor. A React presentation surface coordinates existing panels; backend events are still applied once at chapter boundaries. Dataset v1.2 supplies Sam's scoped first-use proof.
**Tech Stack:** Existing React/TypeScript/CSS, Node tests, Supabase repository; no new dependencies.
**Spec:** docs/superpowers/specs/2026-09-26-guided-presentation.md

## Global Constraints
- Keep the existing five-panel layout and full-page deep dives.
- Three equal household stories; no persona is relegated to a background chip.
- One focal point per beat; readable surrounding panels; reduced-motion support.
- Synthetic sources and simulated delivery remain labeled.
- No repeated provider calls or event writes when navigating presentation beats.
- No future evidence or invented success; existing datasets remain immutable.

## Review Focus
- Historical snapshots and old datasets must not claim Sam succeeded without a source event.
- Pending/failed jobs must not reveal a prior decision as the new revision's decision.
- Deep-link/back navigation must preserve the beat and household.
- Keyboard shortcuts must not consume input/Eve/dialog interactions.
- New first-use proof must not override a later failure or another service's observation.

### Task 1: Recorded first-use outcome
**Files:** scripts/generate-bt-history.ts; fixtures/bt-households/v1/stories.json and canonical-manifest.json; app/server/{engine,arbiter,assessment}.ts; app/src/{types,CustomerMemory,PhoneExperience}.tsx/ts; app/tests/history-scenarios.test.ts and repository-contract.test.ts.
**Interfaces:** Existing `generateHistory`, `project`, `arbitrate`, `verifyOutcome`; add optional `Household.firstUseObserved` for legacy snapshots.
- [ ] Add failing history tests: Sam remains unconfirmed at revision 4; provisioning alone is insufficient; successful source evidence at revision 5 completes only activation, does not manufacture customer confirmation; later failure blocks completion. Explicit v1.1 reproduces its old manifest hash.
- [ ] Run `node --test app/tests/history-scenarios.test.ts`; expect new assertions FAIL.
- [ ] Version new fixture v1.2, add scoped provisioning/first-use observations, project the evidence, add gated first-use arbitration and a truthful customer update. Legacy new sessions receive equivalent observations; stored old records are untouched.
- [ ] Run targeted tests and `npm --prefix app test`; expect pass (hosted opt-in tests skipped).
- [ ] Commit.

### Task 2: Pure presentation chapters and cues
**Files:** app/src/presentation.ts; app/tests/presentation.test.ts.
**Interfaces:** `presentationBeats(snapshot: Snapshot): PresentationBeat[]`, `presentationCursor(beats, person, index)`, `householdOutcome(snapshot, person)`. Beat contains panel, household, title, detail, evidence IDs and optional before/after change. Null household/panel is the chapter comparison.
- [ ] Add tests for equal household coverage, no future source references, pending-job gating, legacy unresolved Sam and independent Daniel proof states.
- [ ] Run test; expect FAIL before implementation.
- [ ] Derive cues and comparisons from actual current household/decision/action/outcome records. Include only relevant stages and an end comparison. Clamp invalid cursors to a valid beat.
- [ ] Run tests; expect PASS.
- [ ] Commit.

### Task 3: Guided UI and end-to-end verification
**Files:** app/src/{App,Presentation}.tsx; app/src/presentation.css; docs presentation notes.
**Interfaces:** Present/Explore query mode; `beat` cursor survives panel open/back. Task 2 derives the visual focus and cue.
- [ ] Add compact Present/Explore controls, stable equal household rail, cue with Next/Back and inspectable evidence, focused panel styling, truthful three-way chapter comparison and decision receipt.
- [ ] Wire next chapter to existing advance once; disable while busy/pending/failed; leave Explore behavior available. Preserve historical navigation and deep-dive cursor. Arrow/Enter/Escape guard inputs, dialogs and focused views.
- [ ] Run `npm --prefix app test`, `npm --prefix app run build`, `npm --prefix app run test:lab`; expect PASS.
- [ ] Verify locally: all three paths; old and new dataset; deep-dive return; keyboard; first-use final proof; readable overview at normal desktop size.
- [ ] Import/replay a dedicated v1.2 Supabase session; verify observed outcomes and no replay duplicates. Push and deploy to existing RX Vercel project under prior authorization.
- [ ] One fresh final review, fix Important/Critical findings with regressions, commit and report.
