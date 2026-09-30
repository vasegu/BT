# Mark’s Feedback: Story and Value Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing BT demo demonstrate how remembered customer context changes an action and produces a meaningful, evidenced customer outcome.

**Architecture:** Retain the seven-section presenter, proportional phone and full-screen inspectors. Reuse the existing snapshot, decision traces, household profiles and outcome contracts; add one small presentation projection for the context-to-action explanation. Keep retrospective evaluation and illustrative learning separate from runtime decision-making.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, existing Postgres/Supabase runtime and evaluation tooling; no new dependencies.

**Spec:** Mark’s feedback, supplied at `/Users/v.eguren/.codex/attachments/1c24becc-e227-4077-a08e-b4c8f2265edf/Pasted text.txt`, with accepted scope below. Baseline: commit `b744806`; audit evidence in `docs/reviews/2026-09-30-full-panel-audit.md`.

## Accepted scope and constraints

- Preserve three equally complete household stories, as the user previously requested. Show one household at a time, with the existing compact selector and optional comparison. Do not default to Daniel as the only complete story.
- Keep all seven sections visible; show one explanation in the centre and an undistorted phone on the right. Expanded inspectors retain technical depth and require Back before switching section.
- Improve evidence and presentation rather than redesigning the application or manufacturing additional complexity.
- Customer memory must explain a consequential difference, not merely display more attributes.
- All displayed facts must respect occurrence time, receipt time, subject scope and the selected replay moment. Historical explanations retain their original context.
- Synthetic risk/revenue/usage values are illustrative, not calibrated predictions or BT business results. An observation after an action is not proof that the action caused it.
- Preserve existing recorded sessions. Changes to synthetic history require a versioned dataset and fresh replay, never silent rewriting of historical decisions.
- No autonomous bandit or recursive optimiser in scope. Show the evidence-to-policy learning loop honestly.
- No new live WhatsApp, insurance, voice or agent integration is required. Existing voice remains available; future concepts remain labelled as a vision.
- Plan only in this turn. No application changes, data import or deployment.

## Review focus

1. Revisiting an earlier beat must not expose future devices, adoption, consent or outcomes (Tasks 1 and 3).
2. Missing evidence must produce “not established”, not a confident personalised explanation (Task 1).
3. A quiet outcome must distinguish observation, intervention and deferred communication (Task 3).
4. An irrelevant identity claim may affect wording only where justified; it must not grant authority or change fault eligibility (Task 4).
5. The densest persona/beat must remain legible at 1440 × 720, without shrinking type or distorting the phone (Tasks 2 and 6).

## Story contract

| Story | Promise to the audience | What makes it personal | Ending to demonstrate |
|---|---|---|---|
| Daniel | BT remembers and follows through | Failed restart, named adviser, callback commitment, prior reliability history | Callback kept; restoration confirmed; monitoring completed before formal closure |
| Sam | BT helps the household use everything it bought | New household, included products not yet used, setup progress and subsequent engagement | Included services used; relevant later offer is eligible, with acceptance/value only claimed if recorded |
| Maya | BT knows when to intervene and when to stay quiet | Established rhythm, actual line evidence, communication preferences and household timing | A specific technical improvement, explained at an appropriate time, with its observation window visible |

The central question at every beat is: **What did we know that changed what we did?**

## Task 1: Connect memory to consequential decisions

**Files:** Create `app/src/decision-context.ts` and `app/tests/decision-context.test.ts`; modify `app/src/CustomerProfile.tsx`, `app/src/CustomerMemoryView.tsx`, `app/src/PresenterWorkspace.tsx`.

**Interface:** `decisionContext(snapshot: Snapshot, person: PersonId): { facts: { domain: 'customer' | 'operations' | 'governance'; text: string; evidenceIds: string[] }[]; action: string | null; consequence: string; alternative: string | null; limitation: string | null }`. Return at most three decisive facts. Reuse the selected trace and existing competing-proposal selection; do not create a second arbiter.

- [ ] Add tests: an outstanding Daniel promise changes the explanation; an absent trace produces no invented alternative; future/late-arriving evidence is excluded; shared evidence must actually apply to the household.
- [ ] Run `cd app && node --test tests/decision-context.test.ts` and confirm the new assertions fail before implementation.
- [ ] Implement the projection using recorded evidence and checks. An alternative is a recorded rejected proposal, never an asserted counterfactual causal result.
- [ ] Render the same compact “Known → Decision consequence” explanation beside the relevant memory and in the presenter. Keep renewal, products, revenue and history available in the expanded profile. Use only decision-relevant fields in the overview.
- [ ] Annotate the existing memory chart with what a point represents, what proximity means, which memories were retrieved, and which evidence the decision actually cited. Explicitly distinguish visual proximity from policy eligibility.
- [ ] Rerun focused tests and build; inspect Daniel before the signal and at confirmation. Commit this independently reviewable change.

## Task 2: Make the walkthrough’s reading order unambiguous

**Files:** Modify `app/src/GuidedPresentation.tsx`, `app/src/PresenterWorkspace.tsx`, `app/src/presentation.ts`, `app/src/presentation.css`; extend `app/tests/presentation.test.ts`.

**Consumes:** Task 1’s decision-context projection plus existing `changeSummary` and `momentView`.

- [ ] Add tests that each persona/beat has an explicit current change or an explicit retained-context state; future beat content must not appear in the current summary.
- [ ] Make the centre follow one consistent sequence: what changed, why it matters for this home, selected action, evidence/constraints. Reuse inspector components and remove duplicate summaries.
- [ ] Preserve the selected section when advancing time; mark other changed sections visibly without automatically pulling the presenter away. Keep one concise story-value line per persona.
- [ ] Make the arbiter’s three inputs readable together, using Task 1’s customer/operations/governance facts. Retain deeper gates, candidates and source inspection behind Open arbiter.
- [ ] Verify all seven overview sections at 1440 × 720 and normal desktop dimensions. Use layout and progressive disclosure, not smaller body text, to resolve overflow. Run presentation tests and commit.

## Task 3: Finish the three customer outcomes

**Files:** Modify `app/src/PhoneExperience.tsx`, `app/src/message-explanation.ts`, `app/src/presentation.ts`, `app/src/ActionsView.tsx`; only where evidence is missing, modify `scripts/generate-bt-history.ts`, `fixtures/bt-households/v1/stories.json`, `app/server/engine.ts`, `app/server/outcomes.ts`. Extend existing lifecycle, history, message and outcome tests.

- [ ] First inventory the existing dated evidence for each story contract. Identify missing evidence separately from evidence already present but poorly surfaced.
- [ ] Add regression assertions for Daniel’s promise/confirmation/closure ordering; Sam’s included-product use before any adoption claim; Maya’s intervention before a “fixed” message and her selected communication window; missing offer acceptance remains unproven.
- [ ] Daniel: make the actual repair, callback receipt and monitoring result visible at their respective moments. Never imply the conversational agent itself repaired the network.
- [ ] Sam: make the opening emphasise “helping you get started”; retain the actual incident honestly. Make later beats clearly progress through setup, included-service adoption, then a relevant permissioned offer. Do not infer TV preference from generic bandwidth contention.
- [ ] Maya: show the concrete intervention and the reason for deferred notification. At the morning beat, give her a concise useful explanation; later show the observed result. Do not claim no repeat contact merely because no record is displayed.
- [ ] If synthetic records need changes, version the dataset, rebuild/import through the existing workflow and create a fresh replay. Otherwise retain current data. Run lifecycle/history/message/outcome tests; commit.

## Task 4: Give agent review a clear purpose and a guided example

**Files:** Modify `app/src/SwayReview.tsx`, `app/src/context-sway-types.ts`, `scripts/build-context-sway.ts`, `app/src/sway.css`; extend `app/tests/context-sway.test.ts`.

**Interface:** Extend evaluation examples with an optional structured comparison `{ baselineId: string; variantId: string; expected: 'invariant' | 'may-change'; explanation: string }`; both IDs must resolve to existing displayed points. Keep existing artifact provenance.

- [ ] Add tests: an unverified “gamer” claim leaves fault-action eligibility unchanged; verified relevant usage can affect a later offer only with the existing consent/eligibility gates. Do not hardcode an artificial outlier just to make the map interesting.
- [ ] Provide a default guided comparison: original context, one changed input, resulting action and any available wording/tone differences. If modifiers were not captured by the evaluator, say so rather than inventing them.
- [ ] Keep the semantic action clusters as the main visual. Explain that the axes are a projection, not business scores; distance/outlier status is a review lead, not an automatic failure.
- [ ] Offer “irrelevant claim” and “relevant evidence” examples before the broader explorer. Preserve input/action inspection and make the post-evaluation scope obvious.
- [ ] Rebuild with `npm --prefix app run build:sway`; run context-sway tests; verify both examples and artifact provenance. Commit.

## Task 5: Close with demonstrated value and bounded learning

**Files:** Modify `app/src/ActionsView.tsx`, `app/src/LearningView.tsx`, `app/src/learning.ts`, `app/src/FutureView.tsx`; extend `app/tests/outcomes.test.ts` and `app/tests/screen-semantics.test.ts`.

- [ ] Add assertions that pending observations remain pending, observed adoption is not labelled causal uplift, and future policy changes stay unavailable before their effective date.
- [ ] Structure each ending around action → expected effect → observed evidence → remaining uncertainty. Surface the existing outcome contracts rather than add summary metrics with no source.
- [ ] Connect the household result to one illustrative learning question: monitoring duration, onboarding help or quiet-fix communication. Keep synthetic cohort assumptions and human policy approval visible in the expanded view.
- [ ] Make the future screen a short optional coda: richer services and a customer’s own agent using the same memory, permissions and outcome architecture. Avoid mixing envisioned capabilities with the live demonstration.
- [ ] Run outcome and semantics tests, inspect each ending, and commit.

## Task 6: Complete verification and presenter handoff

**Files:** Update `docs/reviews/2026-09-30-full-panel-audit.md`; create `docs/reviews/marks-feedback-acceptance.md` with the feedback-to-evidence checklist and links to relevant screens.

- [ ] Finish the outstanding post-fix Sam/Maya compact-layout repeat and expanded-view repeat before claiming the prior audit is closed.
- [ ] Run `npm --prefix app test`, `npm --prefix app run build`, and `git diff --check`. Record pass/fail/skip counts and any remaining warnings.
- [ ] Verify 3 personas × 9 moments × 7 overview sections (189 states), plus the corresponding 189 loaded expanded views. Exercise Back, persona switching, time reversal, refresh and direct links; confirm source evidence and phone explanations retain historical context.
- [ ] Repeat overview layout checks at 1440 × 720 and the normal desktop viewport. Phone contents may scroll internally; the presenter overview must fit without page scrolling to reach its core content.
- [ ] Rehearse each household as a standalone short story and verify the same claim appears consistently in overview, inspector and phone. Record any unverified claim instead of disguising it with copy.
- [ ] Write a compact presenter route for each household, plus one optional technical digression into memory/arbiter and one into agent review. Map every item from Mark’s feedback to addressed, partial or intentionally illustrative.
- [ ] Commit the evidence and final fixes. Push/deploy only according to the user’s instruction at execution time.

## Definition of done

Mark can tell each household story without explaining the UI first. He can point to specific remembered evidence, show why it changed the decision, then show what actually happened. Technical detail is inspectable, claims match the records, all three stories are equally complete, and no visualisation implies more certainty or runtime capability than the system has.

## Self-review

All feedback categories are assigned: profile/chart explanation (1), navigation/changed-state/arbiter synthesis (2), proactive care/adoption/quiet resolution/growth (3), evaluation clarity (4), recursive learning/future architecture (5), and legibility/story consistency (6). A dedicated insurance product and live autonomous learning are deliberately outside this pass; the future screen can illustrate them without asserting implementation. No new generic framework, schema rewrite or design-system replacement is needed.

## Execution outcome — 30 September

Tasks 1–6 implemented and verified; see `docs/reviews/marks-feedback-acceptance.md` for the evidence, presenter routes and scope boundaries. Reused existing history, outcome contracts and learning views rather than duplicating them. Guided evaluation examples are selected from actual existing pairs at render time, so no artifact schema change or rebuild was required. The relevant example uses incident scope, which this fixture actually tests, rather than introducing an unmeasured usage factor. Final checks: 131 tests passed, 3 skipped; build passed; 378 overview and 189 expanded states checked. No push or deployment performed in this pass.
