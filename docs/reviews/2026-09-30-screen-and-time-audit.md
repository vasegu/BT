# BT current-state screen and temporal-data audit

30 September 2026. Reviewed HEAD `e5958ff`, including the uncommitted v2.3 history changes. This replaces the previous work queue with an audit; no application code, replay, deployment or user data was changed. The report is the only new source file.

## Verdict

The expanded story is stronger: recovery, quiet preventative care, getting value from included products, then an appropriate commercial opportunity. However, the data model and explanatory UI still carry assumptions from the original single evening. The result is several incompatible accounts of what happened, sometimes on the same screen. Fix those before adding more technical decoration.

The strongest design ingredients should stay: restrained BT purple, technical typography for records, the phone, the operational map, inspectable proposals, and post-evaluation context clusters. The main presentation needs less duplicated explanation and a stable view of every system section.

## Scope and evidence

- Local app at port 5185; health reported Supabase, configured Jev, running worker, configured Eve, simulated external actions.
- Browser inspection: customer memory at the opening and November; operations on Saturday; arbiter in November; actions/outcome evidence and learning on Monday; phone on Saturday; governance in November; Agent review; source ledger. Main presenter also reviewed from the user's current production screenshot and current source. Future vision and supplementary/legacy views reviewed in source; future landing checked in browser.
- Current completed hosted replay: `7e5f1471-687d-45bc-b2bd-3507719a29d0`, v2.2, revision 8. Opening replay: `8f062486-b295-4dc2-a905-065666ae4cd7`, v2.2. Current generator says v2.3. Older sessions retain their original imported datasets: new generator code does not repair their history.
- Read-only code review of projections, source generation, arbitration, conversation persistence, memory, outcomes, eval artifacts and screen copy. In-memory sequential replay checks were used. No new live model calls, voice sessions, replay advances or external messages were initiated.
- Build passes. Full test run: **100 tests, 95 passed, 2 failed, 3 skipped**. Failures: stale `public/memory-map.json`; session-loading test expects 2,846 records while current generator yields 3,590. Hosted integration test skipped. Passing tests do not validate all new cross-day claims.
- This is broad screen/data coverage, not exhaustive interaction testing of every control or voice path. Findings below distinguish visible contradictions from code-traced risks.

## The temporal contract that now matters

| Beat | London time | Meaning |
|---|---|---|
| 0 | Fri 25 Sep 20:45 BST | Existing history, before the new signal |
| 1–5 | Fri 25 Sep 21:00–21:18 BST | Alert, incident, restoration, callback, confirmation |
| 6 | Sat 26 Sep 08:30 BST | Overnight care and early-life opportunity |
| 7 | Mon 28 Sep 08:30 BST | Working-week follow-through |
| 8 | Fri 6 Nov 19:00 GMT | Established usage and commercial relevance |

September to November crosses daylight-saving time. Store UTC, render Europe/London, and distinguish four things everywhere: **when an event happened, when the system learned it, the selected replay time, and the real audit/write time**. A policy or cohort result also needs an effective/available date. These are not interchangeable.

## Findings that undermine the demonstration

### 1. P1 — 59 hours is presented as a proven 72-hour commitment

Monitoring starts 25 Sep 20:12Z. Completion is recorded 28 Sep 07:20Z: **59h08m**, before the promised 28 Sep 20:12Z deadline. The event even says `hours:59`. Nevertheless Monday's actions screen shows “Line holds for 72 hours: proven”, its total is “4 / 4 outcomes proven”, and Learning says “held for the whole window”.

Evidence: `scripts/generate-bt-history.ts:1133`, `app/server/outcomes.ts:118`, `app/src/LearningView.tsx:22`. Browser verified Monday.

Change: keep the commitment open until sufficient observed duration, or explicitly revise it with an authorised reason and stop claiming the original duration was met. Verification must check coverage and elapsed time, not only `drops === 0`. Saturday's presenter wording “Fixed, and watched for 72 hours” also needs future/in-progress tense.

### 2. P1 — The new v2.3 telemetry patch manufactures Maya's overnight availability

The new future windows start as `received:null / aggregate_unavailable`. A later normalization pass overwrites all Maya windows using overnight evidence that ends on 25 September. All **248 new Maya windows** become `240/240, observed`, including midnight–04:00. That contradicts the habitual nightly switch-off and makes missing evidence look like perfect coverage.

Evidence: `scripts/generate-bt-history.ts:285`, `:613`, `:655`. Confirmed from generated data, not an assumption about the existing v2.2 session.

Change: extend the actual underlying overnight evidence or preserve unknown coverage. Build observations first, then derive summaries from them. Never fill a chart by inventing full coverage. Regenerate the memory artifact only after correcting this.

### 3. P1 — Governance calls a permitted offer a breach, and simultaneously denies it occurred

At Sam's November offer the screen says **6/8 rules held**, **2 rules broken**, “1 sign-off actions ran on their own”, and “No offer made in 24 decisions.” The decision immediately below is “Offer a TV upgrade with sport”, with recorded opt-in and prior approval. “What we did not use” also says commercial or marketing data.

Evidence: `app/src/GovernanceView.tsx:45`, `:56`, `:185`. Browser verified.

Change: distinguish action requiring approval, approval already recorded, awaiting approval, and unauthorised execution. Derive each assertion from the actual authority and evidence record. A red policy failure cannot merely mean the candidate belongs to a sign-off category.

### 4. P1 — The approved offer describes a 30-day condition that the gate does not enforce

The source approval permits offers for customers with **no open fault in the last 30 days**. The gate checks current open case, outstanding obligation and current incident clearance, plus boolean approval/opt-in. It does not inspect the preceding 30-day fault window. Sam's canonical November example may qualify, but the claimed constraint is not protected against a recently closed fault.

Evidence: `app/server/arbiter.ts:453–500`, approval event in the November source ledger. Code-traced gap; no counterfactual live execution performed.

Change: represent the approval's eligibility window as enforceable policy data, evaluate dated case/incident history, and display the actual checked interval and evidence. Add a recent-closed-fault test, not just a currently-open-fault test.

### 5. P1 — Agent review overstates what its static rules replay proves

The visible review says “No” irrelevant facts got through, “0%” gamer-claim sway and “Live = replay 100%”. The page loads a prebuilt `context-sway.json`, generated using an in-memory rules engine independently of the selected live Jev session. The claim factor leaves policy facts unchanged; this demonstrates policy invariance, not live model resistance to the injected wording. “Live decision” and “The decision that actually ran” are misleading in this context.

Evidence: `scripts/build-context-sway.ts:1`, `app/src/SwayReview.tsx:53`, `:109`, `:606`, `app/server/context-sway.ts` FACTORS. Browser verified labels.

Change: prominently label dataset, rules/model mode, build time, policy version and tested population. Keep this useful rules sensitivity map, but do not present it as the current session's model eval. Actual frozen-request model trials belong in a separate explicitly identified results view. New factors should cover monitoring, first-week engagement, offer permission, approval scope and evidence age. Existing factors largely describe Friday's care case. Fix raw new action names and extend moment colours beyond six entries.

## State and explanation mismatches

### 6. P2 — Maya's Saturday phone contradicts itself four ways

It shows the delivered “We fixed something overnight” message while the right-hand caption says “No message is an intentional outcome” and “no new service notification”. The left side says “Removing friction here means saying nothing”. Current service state remains “Line quality falling”, while the phone says the connection is back.

Evidence: `app/src/SectionView.tsx:164` hardcodes the no-message caption by persona; `app/server/arbiter.ts:667` supplies stale routine reasoning; `app/server/engine.ts:165` does not clear degraded state on reprofile. Browser verified.

Change: derive channel explanation from the selected decision and actual receipts, not `person === maya`. Separate quiet observation from proactive fix followed by notification. Project recovered health only from appropriate fix/verification evidence; preserve the historical degradation as history.

### 7. P2 — Sam never graduates from first setup in customer memory

In November: “First connection observed tonight”, “has never checked in”, and “hub delivered but never connected” appear alongside established usage and a TV offer. The source logic treats `firstUseObserved` as the setup situation indefinitely.

Evidence: `app/src/CustomerMemoryView.tsx:140`, `:149`, `:155`; `app/src/Rhythm.tsx:91`; `app/src/DecisionFlow.tsx:27`. Browser verified.

Change: model unconnected → first connected → onboarding → established usage. Date the activation once and describe the current observation window separately. November memory should foreground six weeks' usage, included products in use, offer opt-in and current eligibility.

### 8. P2 — Operational capacity and service cards are historical records masquerading as current state

Saturday and November can show “1 callback slot free tonight” from Friday's rota. The operations screen's household product card still says Sam's broadband is “delivered” after first use. The map correctly reports incident clearance, but summaries and several status descriptions continue foregrounding the old incident. An on-change record can remain valid, whereas an expired appointment slot cannot.

Evidence: `app/src/DecisionFlow.tsx:43–62`, `app/src/OperationsView.tsx:461`, operations cards browser verified.

Change: expire capacity by the actual slot end, label rota date, and report “no current capacity feed” when appropriate. Derive current product state from the same event projection used by the phone. Keep old incident membership in history, distinct from a live incident. Label observation age and source cadence before interpreting an old record as stale.

### 9. P2 — Decision changes omit the new facts that explain the later actions

Sam's November arbiter says **“No projected fact changed”** while making a new commercial recommendation. Its diff whitelist excludes offer signal, offer permission, approval, monitoring, quiet-fix and engagement fields. Top summaries still discuss first connection and Friday capacity rather than the facts supporting the offer. The model's interpretation vocabulary also remains centred on fault/activation/recovery.

Evidence: `app/server/arbiter.ts:699–740`, `app/src/ArbiterWorkbench.tsx:452`, `app/src/DecisionFlow.tsx`. Browser verified.

Change: include all decision-relevant state in the recorded diff; group it into service, relationship, obligation and permission changes. Link current eligibility to closure/clearance evidence rather than only original `case.opened` and `incident.confirmed` records. Show the approval date: it is standing authority newly available within a long replay interval, not a signal received at 19:00 that evening. Expand typed interpretations to fit the new action domain.

### 10. P2 — The promise timeline compresses days into a Friday-evening axis

The axis is fixed to 25 Sep 20:45–21:21 London. Later decisions and messages are added and clamped to its right edge. Monday's “now 08:30” appears after Friday21:18; marks and labels overlap. A fulfilled callback is relabelled “No named owner” after the current case owner is cleared. Maya's headline continues claiming nothing was sent after her morning note.

Evidence: `app/src/PromiseTimeline.tsx:38–81`, `:112`. Browser verified Monday.

Change: either freeze this as an explicitly dated Friday episode with only Friday marks, or introduce separate day segments. Historical lanes must retain the owner attached to the historical promise. Use a new compact follow-through timeline for the weekend instead of stretching the existing evening diagram.

### 11. P2 — Eve writes conversations against real time, not selected simulation time

Conversation persistence writes wall-clock time into both event timestamps; the selected replay cutoff is metadata. On the audit date, a chat entered while viewing Friday/Monday is later excluded from those snapshots and can become visible in November. After November6, new chat would fall after every story cutoff. Eve's context display also keeps an incident “In scope” after clearance.

Evidence: `app/server/postgres-repository.ts:657–668`, cutoff filtering `:281`; `app/src/Eve.tsx:354`. Code-traced; no paid voice/chat executed.

Change: explicitly scope conversations to simulation session and beat. Store real write time separately from simulated availability. Retain historical incident membership while exposing current clearance.

### 12. P2 — Customer evidence disclosure denies evidence actually used

The Why sheet says other products in the household are not used for service messages. Governance explicitly reports linked mobile activity informing broadband decisions. The generic disclosure is therefore false for relevant Maya messages.

Evidence: `app/src/PhoneExperience.tsx:152`, `app/src/GovernanceView.tsx:78`.

Change: explain actual permitted evidence for that message, including a linked-product signal where used. Distinguish informing this broadband decision from authorising an action on that other product.

### 13. P2 — Learning/value claims go beyond what the synthetic records establish

The seeded cohort is helpfully labelled synthetic, but copy says a note “costs nothing and prevents calls” and guided customers have “lower early churn risk”. The simulation only samples contact and product-use outcomes. It does not measure cost, churn or causal effect. Final guide comparison figures are visible before the policy change date, without observation-window/as-of dates. Maya's Monday profile additionally says she read the note, without a read event.

Evidence: `app/src/learning.ts:40`, `:58`; `app/src/LearningView.tsx:33`; `scripts/generate-bt-history.ts:1100`.

Change: label illustrative assumptions versus observed outcomes, give cohort periods/availability, and restrict causal language. Add a synthetic read event if the story needs it. Retain the important statement that activation observed does not prove outreach caused it. Commercial success must distinguish offer delivered, viewed, accepted, activated and later retained value.

## Dates, artifacts and readability

### 14. P2 — New data, old sessions and old maps can tell different stories

The completed v2.2 replay has 2,846 records and missing subsequent telemetry; v2.3 generates 3,590. Its November rhythm is consequently almost entirely unknown. The v2.3 patch does not migrate existing sessions, and the memory-map fingerprint test confirms the compiled visualization is stale against current input.

Change: show a compact dataset version in the inspector, bind visual artifacts to dataset/policy fingerprints, and make incompatible artifacts unavailable with a clear explanation. Preserve old replays as old replays. Decide whether to create a new canonical demo session after correcting data rather than silently changing recorded history.

### 15. P2/P3 — Cross-day language is inconsistent across nearly every screen

Examples: phone “Good evening” at08:30; customer context “Saturday evening, 08:30”; operational 75-minute band called “tonight”; governance cumulative six-week totals “Tonight so far”; arbiter run options show two indistinguishable08:30 entries; promise deadlines omit dates; source-ledger header only says cutoff19:00 though rows have dates. “Live” currently means backend connectivity but sits beside a simulated November timeline.

Change: one shared date/daypart/relative-age formatter against replay time, with explicit Europe/London. Use full short date+time whenever records span days, and make absolute timestamp available on inspection. Rename status to “Supabase connected” or separate connection status from “Replay · Fri6Nov19:00”. Preserve UTC in machine records.

### 16. P3 — Technical detail has fallen below repeated introductory material

The arbiter repeats the chosen answer in the three-context flow, run bar and inspection pane; its meaningful gates fall below the fold. Expanded phone wastes width on captions yet clips the phone vertically. The customer screen can spend most of its opening viewport on an empty30-day chart. Agent review spends hundreds of vertical pixels on summaries before its map. Dense labels truncate in the nine-moment bar. The overall palette is coherent; hierarchy and information placement are the issue.

Change: retain technical density but give each surface one summary, one principal visual and one evidence area. Do not solve it by shrinking every font. Separate current evidence from retained history, and expose dates/unknown coverage directly in visuals.

### 17. P3 — Documentation is behind the runtime

README still describes planned hosted Supabase/SQLite assumptions and five-step presentation alongside newer hosted guidance. Stories metadata still describes the older short presentation. That makes it harder to tell which system is actually being demonstrated.

Change: update after the data contract is settled; document nine beats, three persona arcs, real versus simulated execution, static versus live evals, and dataset/artifact regeneration.

## Recommended presentation layout — responding to the new screenshot

The screenshot duplicates the same story in change tiles, three memory cards, a decision box and the phone. Replace that with a stable **seven-section vertical rail / explanation / phone** composition. The rail is architecture navigation, not a second time axis.

```text
BT  | Daniel · Sam · Maya       Fri25Sep21:18       Previous / Next
Compact clock: Tonight [six stops] | After [Sat · Mon · 6Nov]

SYSTEM SECTIONS              SELECTED SECTION                    CUSTOMER
01 Customer memory   changed Daniel confirmed the fix             phone
02 Operational memory —     Before → after                       full height
03 Arbiter           changed Why this changed                     visible
04 Customer experience new  2–3 linked pieces of evidence
05 Actions & outcomes proven What happens next
06 Governance        checked [Open full inspector ↗]
07 Agent review      —
```

- Every row remains in the same place. Each has a short current-state sentence; changed rows get a purple edge and a concise delta. Unchanged rows remain readable, with a neutral indicator. Avoid fading their text below legibility.
- Selected and changed are different signals: selected row gets a surface treatment; changed row gets a marker. A policy check repeated successfully is not automatically a policy change.
- One compact title for the current beat, not a title plus a second grid explaining all the same changes.
- Auto-select the section where the consequential change occurs when advancing, but allow the presenter to select another without advancing time. Never hide unchanged sections.
- Keep the phone legible; show the current message prominently and collapse earlier thread messages. Do not squeeze an entire phone transcript into the viewport. Full transcript and full technical inspector can scroll; the presentation overview should not.
- Target roughly230px rail, flexible centre,330–360px phone at a typical desktop width. Use a compact header/clock. At short window heights, reduce empty spacing and phone chrome before text. The user's screenshot includes browser chrome/banner, so test the actual content viewport, not only a large full-screen canvas.
- Seven sections are not seven temporal stages: there are currently nine time beats. Keep those concepts separate. Learning is reached through Actions & outcomes; 2030 remains an explicitly separate future vision.

## Screen-by-screen disposition

| Surface | Keep | Required change |
|---|---|---|
| Main presenter | Persona switching, clock chapters, phone | Vertical seven-section rail, remove duplicate deltas/cards, stable viewport, distinguish changed/rechecked |
| Customer memory | Layers, real source drilldown, semantic spaces | Lifecycle summaries; dated/covered rhythm; dataset-matched embedding artifact; relevant November facts |
| Operations | Geographic scope, feeds, event ledger | Expiring capacity; current product projection; event date/age and source cadence; recover/fix state |
| Arbiter | Proposal queue, typed Jev output, hard gates, receipts | Relevant state diffs; approval lifecycle; actual30-day gate; updated interpretations; dates; reduce summary duplication |
| Phone/Eve | Unified conversation and useful current action | Daypart; date separators; actual message explanation; coherent service state; scoped chat persistence |
| Actions/context | Context-to-action, expression and receipt distinction | Date every cross-day commitment; show new input fields; keep no-action distinguishable from no message ever |
| Outcome evidence | Separate technical recovery, promise and confirmation |72h proof; unclamped dated timelines; historical owner; pending versus met |
| Learning | Explainable illustrative loop | Availability dates, measured metric only, remove unsupported causal/cost/churn claims |
| Governance | Authority register, evidence-linked decision record | Approved versus unauthorised; actual commercial evidence; truthful tests/coverage |
| Agent review/hodoscope | Input clusters, sensitivity, outlier inspection | Clearly identify static rules fixture; scoped model evaluation separately; new lifecycle factors and colours |
| Source records | Occurred/known distinction and inspectability | Full cutoff date, received date when different, version/source clarity |
|2030 vision | Separate labelled future illustration | Keep separate from runtime proof and completed customer outcomes |

## Order of work and acceptance

1. **Correct data and authority first:** Maya windows, monitoring duration, post-fix state, approval constraints, disclosure. Reconcile derived summaries to the same state.
2. **Make time explicit:** clocks, lifecycle stages, current versus historic capacity, date-labelled timelines, replay-scoped Eve records.
3. **Align artifacts and proof:** regenerate from corrected data, version artifacts, identify static rules versus model eval, fix test expectations without merely accepting false data.
4. **Reshape the main presenter:** seven visible rows, centre inspector, full phone; remove repetition. Preserve deeper screens for technical exploration.
5. **Polish copy and value claims:** only claims supported by evidence available at that beat; intentional illustrative assumptions clearly labelled.

Acceptance should cover all three households at opening, confirmation, Saturday, Monday and November, with targeted checks at the incident/restoration beats. Specifically: no future evidence leaks; no premature72h completion; no old slot advertised as free now; no November “never connected”; no delivered message described as silence; no approval reported as a breach; unknown coverage stays unknown; and a newly recorded Eve message survives reload at its intended beat. Test BST/GMT explicitly. The presenter should fit the actual user viewport with readable text and all seven rows visible.

## Customer-memory recovery check — added after branch clarification

Fetched remote refs and inspected all published branches, local branches, worktrees and stash list without switching, merging or changing files. `main` and `feat/bt-runtime` remote tips both point to `e5958ff`. The additional `origin/v0/veguren-4661-4427ff86` branch ends at `c0098a6`; its divergent work is presenter capability annotations/closing synthesis, preview boot and backend configuration. It does not contain a customer-memory restoration. No second local worktree or stash was found.

### P1 — Profile improvements disappear when a dataset stops being current

This is stronger than the general version finding above. `scripts/generate-bt-history.ts:1020` explicitly notes that `profile.*` tables are not imported to Supabase. `scripts/import-bt-history.ts:14` confirms they are absent from the import allowlist. Current-version sessions can get these richer rows from the generated baseline fixture. When the version/hash differs, `app/server/postgres-repository.ts:142` switches to `fullFixture`, which reconstructs only the imported domain tables. `app/server/profile.ts:18` returns undefined without `profile.members`; `CustomerMemoryView` then omits the richer profile cards.

This explains why an older replay can lose household/device, contract/value, contact-history and usage cards even though the UI code still exists. The audited v2.2 completed replay has no profile after the current generator moved to v2.3. Do not mistake this for a branch merge losing the component.

**Required change:** persist the versioned profile facts, or persist an immutable complete dataset snapshot and reconstruct them from that. Preserve per-row availability/effective time. Do not patch an old replay by attaching today's generated profile: that would silently rewrite its history. A regression test must create/load dataset A, change the current baseline to B, reopen A and assert its original profile remains intact.

### Recoverable UI history

| Commit | What is recoverable | Current status |
|---|---|---|
| `6fbd351` | Customer memory lab composed into one desktop screen (`CustomerMemory.tsx`) | Historical implementation replaced by newer view |
| `1274b33` | Explorable customer atlas and computed memory groups | Historical design reference worth comparing |
| `9a82d14` | Unified workspace hierarchy and clearer customer memory | Historical refinement worth retaining |
| `9fccfb3` | New customer-memory view and memory-map direction | Replaced the earlier composed screen |
| `3bbcfbd` | Household, devices, product use, contract/churn, contacts and usage-by-hour cards | Code present; profile persistence gap can hide it |
| `e5958ff` | Case, owner, commitment and service detail on the small Customer memory tile | Already HEAD; changes `App.tsx`, not a restoration of the earlier full-page lab |

Before redesigning the memory inspector, compare the earlier compact lab with the newer profile content. Reuse the successful layout/interaction work selectively while retaining the new time-aware facts. Do not merge the unrelated v0 branch wholesale as a memory fix.
