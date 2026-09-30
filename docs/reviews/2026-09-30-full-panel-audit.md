# Full panel, persona and replay-time audit

30 September 2026. Audit only; no application fixes made in this pass.

## Verdict

Not ready to call consistent or presentation-proof. Shared components improved continuity between overview and expanded views, but they also spread historical-state mistakes to both surfaces. The main fixes are temporal semantics and truthful change indicators, followed by the two remaining overview overflows.

## Coverage and evidence

- **189 overview states:** seven sections × Daniel, Sam and Maya × nine moments.
- **189 expanded states:** the same persona/moment/panel matrix, captured only after real panel headings appeared. An initial loading-placeholder sweep was discarded and repeated.
- Overview checks captured readable centre/phone text, panel client/scroll heights, phone proportions and horizontal overflow. Expanded checks captured rendered text/headings and horizontal overflow. This is not screenshot-by-screenshot aesthetic certification of 378 screens.
- Browser viewport: approximately 1680 × 823 CSS pixels. No claim of full responsive coverage at other viewport sizes.
- Browser replay: `7e5f1471-687d-45bc-b2bd-3507719a29d0`, a retained **v2.2** session. Existing recorded decisions were not rewritten. Separately projected all **27 current v2.4** persona/time states in memory, and inspected current rendering/source logic.
- Expanded nested actions tabs, phone subpages/sheets, arbiter selection controls and review filters were traced in source; their complete interaction permutations were not browser-exercised. Voice, paid model generation and external delivery were not triggered.
- Matrix: [2026-09-30-panel-matrix.csv](2026-09-30-panel-matrix.csv). Raw rendered-text captures remain at `/tmp/bt-overview-audit.json` and `/tmp/bt-expanded-audit.json`.
- Targeted current-fixture verification: 22 tests passed. Passing tests do not cover all the copy errors below.

## Findings, in repair order

| Priority | Finding | Persona / moment | Affected surfaces |
|---|---|---|---|
| P2 | Customer confirmation closes Daniel's case before the dated case-closure event. Recovery confirmation, monitoring and case closure are conflated. | Daniel 21:18, Saturday, Monday | Projected state, phone case details, customer memory, arbiter story |
| P2 | Resolved-fault memory notes still describe drops, an open case and a callback to keep. Retained historical promise selects current-fault copy. | Daniel 21:18 onward, clearest 6 Nov | Expanded customer memory |
| P2 | Historical message explanations change when time advances: activation evidence ages out, owner changes, and future records get counted as records not used by an earlier decision. | Sam/ Daniel old messages viewed 6 Nov | Phone Why sheet and shared centre explanation |
| P2 | Offer explanation can say the line is currently in a confirmed fault, using stale September evidence. Current v2.4 reason ordering can additionally push sports interest and opt-in outside the four-reason cap. | Sam 6 Nov | Customer experience centre and phone Why sheet |
| P2 | The monitoring next-step sheet still says Monday 08:25 closure; v2.4 requires Monday 21:15 BST, after the full 72 hours. | Daniel 6 Nov, See the checks | Phone detail sheet |
| P2 | Operational rail says retained/no network change while showing a new router alarm, repair or monitoring checkpoint. | Daniel/Maya 21:00; Maya Saturday; Daniel Saturday/Monday | Rail and operational centre summary |
| P2 | New household devices do not count as customer-memory changes. | Maya 6 Nov | Customer rail/header versus profile contents |
| P2 | Outcome cards omit dates, making Friday and Monday deadlines look like the same clock time. | Later beats, especially Daniel | Overview and expanded Actions & outcomes |
| P2 | Historical contact-permission audit uses the current permission flag. A later grant/revocation can rewrite the apparent legitimacy of an old message. Source-confirmed boundary defect; canonical demo does not revoke permission. | Any permission-changing history | Governance shared rule list/tallies |
| P2 | Centre content exceeds the panel by **49px** for Sam's final arbiter and **11px** for Maya's first signal arbiter. | Sam 6 Nov; Maya 21:00 | Overview arbiter |
| P3 | Monday's cumulative 59h08m monitoring checkpoint is called “overnight”. | Daniel Monday | Customer-memory summary |

Detailed code locations, reproduction and evidence are in [persona/time findings](2026-09-30-persona-time-findings.md) and [expanded-view findings](2026-09-30-expanded-view-findings.md). Shared closure-time finding counted once.

## Section-by-section assessment

| Section | What works | What is still weak |
|---|---|---|
| Customer memory | Real household/device component is shared; profile rows are filtered by replay time. | Current-fault narrative outlives the fault; new-device changes are invisible in the rail. |
| Operational memory | Telemetry comparison makes the three households visibly different. | Change classification excludes much of the evidence actually displayed. |
| Arbiter | Actual checks, source links and before/after state are visible. Canonical source links resolve. | Two overflows. Candidate preview takes the first two unselected candidates, not necessarily the most relevant competing options; ordering can dilute the decision story. |
| Customer experience | Shared explanation content is consistent with the phone sheet; full message body is visible. | Consistency propagates the same stale explanation. No-message states remain much thinner than delivered-message states. |
| Actions & outcomes | Shared expected/observed cards retain source links and distinguish proof from intent. | Missing dates. Overview shows only three outcome contracts, without stating how many are omitted. |
| Governance | Shared rule evidence and a separate standing policy register. | Permission is evaluated at the wrong time; some policy checks are hardcoded passes rather than evidenced tests. Scope is all households, despite the selected-person context, although it is labelled. |
| Agent review | Shared map, clear rules-fixture disclaimer, explicit separation from live-model evaluation. | Same global view across every persona/moment by design. Artifact lacks dataset/policy/build metadata; cannot prove it matches a retained session. It should not read as that selected person's live evaluation. |

## Layout and interaction result

- 187/189 overview states fit their centre content at the audited viewport. Two fail as recorded above.
- No horizontal page overflow in the 189 overview or 189 fully loaded expanded states.
- Phone proportion remains approximately 330:693 throughout the overview sweep.
- Expanded inspectors intentionally scroll; lack of horizontal overflow is not a claim that everything is visible without vertical scrolling.
- Several expanded-page audit waits timed out even though the page subsequently rendered. They were resumed and captured after a real heading existed. This is evidence of intermittent loading/wait instability, not enough to assign a browser-tool versus app/network root cause.

## Recommended repair sequence

1. Separate confirmed recovery, active monitoring and formal closure in the state projection; update dependent copy and policy wording together.
2. Bind historical explanations and permissions to the decision-time record, not the current household.
3. Make rail change detection reflect the data each panel actually renders, including dated profile additions.
4. Reuse dated outcome/monitoring data rather than fixed strings and time-only labels.
5. Bound arbiter overview content deliberately; disclose omitted outcomes and select relevant alternatives.
6. Repeat the same matrix on a completed current-v2.4 replay, with additional shorter-viewport and nested-interaction checks. Preserve old replay provenance instead of silently replacing its history.


## Fix verification — 30 September

Implemented lifecycle corrections, historical decision-time explanations, dated contact-authority checks, operational/device change indicators, dated outcome evidence, London batch timing, explicit evaluation provenance and shared presenter detail components. Rebuilt memory and context-review artifacts. Invalidated the prior client snapshot cache shape.

Verification: production build passed; 130 tests, 127 passed, 3 skipped, 0 failed. A fresh v2.4 replay completed all nine moments with 24 decisions. All 189 overview combinations were measured at 1440 × 720; that pass identified compact-layout overflow in customer memory, operational memory and one arbiter state. Subsequent shared layout corrections removed overflow in all 63 Daniel combinations. The Sam/Maya repeat and the post-fix expanded-view repeat were not completed before the requested commit; the earlier expanded audit covered all 189 loaded combinations. Do not interpret this as a completed post-fix visual sign-off.

## Follow-up: Mark’s feedback implementation

The outstanding compact Sam/Maya and expanded sweeps have now been completed. See `marks-feedback-acceptance.md` and `2026-09-30-marks-feedback-matrix.csv`: 378 overview observations across two desktop sizes plus 189 expanded states, no measured final layout overflow. These supersede the incomplete post-fix visual sign-off described above; nested interaction and live-voice limitations remain explicit in the acceptance report.
