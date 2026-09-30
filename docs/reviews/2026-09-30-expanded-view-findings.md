# Expanded-view audit — 30 September 2026

Audit only. No application files, stored sessions, databases, or generated fixture files were changed. Existing uncommitted changes were preserved.

## Evidence and coverage

Inspected expanded customer, operations, arbiter, phone, actions, governance, and review implementations, including the extracted `OutcomeProofs`, `MessageExplanation`, `GovernanceEvidence`, and `EligibilityChecks`. Traced phone Home/Services/Help/Account, Why and next-step sheets; actions Context/Outcome/Learning routing; arbiter run/candidate/record controls; governance record controls; review filtering and legacy navigation. This is source and fixture verification, **not browser interaction or visual certification**; the parent audit owns browser coverage.

Ran an in-memory canonical fixture projection through `generateHistory`, `buildContext`, and `arbitrate` for all three households at all nine clocks (27 states). No engine jobs, paid model calls, or persistence were invoked. The matrix checked household state, selected proposal, available message template, explanation evidence, and all candidate checks' first source references. Message templates were evaluated without simulating delivery deduplication; they are not a count of delivered messages.

| Moment | Daniel selected proposal | Sam selected proposal | Maya selected proposal |
| --- | --- | --- | --- |
| Before signal | none | none | none |
| 21:00 | recovery | activation | watch |
| 21:03 | incident | incident | watch |
| 21:12 | restoration | activation | watch |
| 21:15 | restoration | activation | watch |
| 21:18 | confirmation | first-use | watch |
| Saturday 08:30 | monitor | early-life | quiet-fix-note |
| Monday 08:30 | monitor | early-life-complete | steady |
| 6 November | monitor-close | offer | steady |

Verification: `node --test app/tests/screen-semantics.test.ts app/tests/history-scenarios.test.ts` — **22 passed, 0 failed**. These checks exercise the underlying semantics, not the rendered copy identified below.

## Findings

### P2 — Customer memory continues describing Daniel's resolved fault as current

**Location:** `app/src/CustomerMemoryView.tsx:145`, `:151`, `:157`, `:163`, `:181`.

`situation()` treats any retained promise or attempted restart as a current fault. Daniel's fulfilled promise remains present through the last replay moment, and he never receives Sam's `firstUseObserved` onboarding flag. Consequently the new first-use override does not prevent Daniel's stale notes. At 21:18 his case is already closed; at 6 November it is `none`, owner is null, and monitoring is complete. Nevertheless the notes still say the line drops, that every action keeps the adviser's call, and that the signal belongs to an open fault case.

**Reproduce:** Daniel → 6 November → Customer memory → read the notes under rhythm, memory layers, and map. Compare with the closed case and completed callback in the household record. Also inspect Daniel at 21:18, Saturday, and Monday. Choose notes from current unresolved obligations and dated recovery state; a historical promise must not select current-fault copy.

### P2 — The monitoring next-step sheet still gives the superseded closure time

**Location:** `app/src/PhoneExperience.tsx:214`.

The `monitor-closed` sheet says “Monday 08:25 · Aisha closed your case.” Canonical v2.4 source creation at `scripts/generate-bt-history.ts:1152` puts closure at `2026-09-28T20:15:00Z` (21:15 BST), after the full 72-hour observation ends at 21:12 BST. This contradicts the corrected evidence and implies the case was closed before the required monitoring finished.

**Reproduce:** Daniel → 6 November → Customer experience → Home → latest 72-hour check message → “See the checks.” Read the closure line against the source record. Populate the sheet from the completion and closure events instead of a fixed Monday-morning script. The parent audit independently identified this same defect; count it once.

### P2 — Historical message explanations change when replay time advances

**Location:** `app/src/PhoneExperience.tsx:130`, `:135`, `:155`.

`MessageExplanation` looks up the original decision but uses the current snapshot clock to age out its order/activation evidence, the current household to name the accountable adviser, and all currently held records to count “didn't use.” At six weeks Sam's September first-use evidence is over 30 days old and is removed, leaving “What we used” without its original activation source chips. At that same moment Daniel's current owner is null, so his earlier Aisha-owned messages now name the generic BT service team. Later records are also counted as records not cited in the earlier decision even though they did not exist then.

**Reproduce:** Compare Sam's “You're connected” Why sheet at 21:18 with that same message under “Earlier” on 6 November. Compare Daniel's incident/restoration Why sheets at their original moments and on 6 November. Bind explanation cutoff/accountability to the decision time and its recorded context, while clearly separating any present-day status.

### P2 — Historical event copy can describe an expired fault as currently active in the offer explanation

**Location:** `app/src/PhoneExperience.tsx:87`, `:98`, `:138`.

`because()` translates `incident.confirmed` into the present-tense “Your line is part of a confirmed network fault” whenever `h.incident` is true; that flag remains true after clearance. For Sam's canonical 6 November offer, evidence order is `case.opened`, `incident.confirmed`, `incident.cleared`, `policy.offer_approved`, `usage.pattern`, `preference.offers_opt_in`. The four-reason cap therefore displays the old fault narrative and approval, while dropping the actual sports-interest and opt-in reasons. Similarly a retained `promise.created` is always translated as “that still stands,” even after fulfilment.

**Reproduce:** Sam → 6 November → Customer experience → offer → Why. The explanation says both that the line is in a fault and that the fault was fixed, and does not list sports interest/opt-in in its numbered reasons. Inspect an earlier Daniel incident message after the callback to see the unresolved-promise phrasing. Use event-time tense and prioritize reasons relevant to the chosen action; distinguish evidence that clears a gate from the motivation for the message.

### P2 — Outcome proof cards omit the dates needed to understand multi-day obligations

**Location:** `app/src/ActionsView.tsx:17`, `:253`, `:302`.

The extracted `OutcomeProofs` still renders creation and due timestamps using only `HH:mm`; the chain's observed/due labels use the same formatter. On the later replay moments, September callback/recovery evidence and multi-day monitoring commitments coexist. A card cannot tell the user whether “due 21:12” means Friday or Monday, or whether an observed 21:15 belongs to tonight or a six-week-old callback. The extraction propagates the ambiguity into the presenter detail as well as the expanded Actions view.

**Reproduce:** Daniel → Monday or 6 November → Actions & outcomes → Outcome evidence; compare card deadlines with their source dates and the dated PromiseTimeline. Show a London date and time for cross-day proof obligations and observations.

### P2 — Governance audits historical message permission using current permission

**Location:** `app/src/GovernanceView.tsx:54`.

The “Nothing is sent without contact permission” tally checks each historical message against `snapshot.households[].contactAllowed` at the selected clock, rather than permission available at the message's decision time. A later revocation retroactively marks an earlier authorized message as unauthorized; a later grant can retroactively approve an unauthorized one. `GovernanceEvidence` shares the same tally, so both surfaces inherit the error.

**Reproduction boundary:** This is a source-confirmed temporal logic defect; the canonical 27-state matrix does not change contact permission after a delivered message. Reproduce with a read-only constructed snapshot containing a previously authorized action plus a later revocation (or the inverse), and compare the result before and after only the current flag changes. Do not present this as an observed canonical failure. Resolve authorization from the decision trace or dated authority evidence.

## Checked paths and limits

- All first source references rendered by `EligibilityChecks` resolved in the canonical 27-state matrix, including historical run context filtering. No canonical broken-link finding was established. The component exposes only the first source for a check; remaining evidence is not individually inspectable there.
- Phone is keyed by session/person/cutoff in `App.tsx:612`, so changing persona or time remounts its page/sheet state. No cross-person open-sheet leak was found in that route.
- Expanded review explicitly labels its data as a prebuilt rules fixture independent of replay/persona. Its invariance across the 27 states is intentional, not itself a defect. Browser interaction, filter accessibility, visual overlap, and legacy response-review rendering remain with the parent audit.
- Governance's static policy register is correctly separated from recorded application of policy. Its hardcoded passing claims for household-member and cross-product constraints (`GovernanceView.tsx:81`, `:86`) are weaker than an evidence-based audit; no canonical violating record was established here.
- Operations `LiveNotNightly` fixes the notional London 02:00 batch to 01:00 UTC (`OperationsPanels.tsx:26`), which is wrong after the autumn clock change. The canonical 6 November recent operational table is empty, so this was not reproduced as a visible canonical error. Treat it as a secondary boundary finding if a November signal is later introduced.
- No application edits or fixes were made. These findings describe the working tree read during this audit; concurrent parent edits may move line numbers.
