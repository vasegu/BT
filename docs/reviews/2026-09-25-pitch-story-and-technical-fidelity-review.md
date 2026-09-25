# BT: pitch, story and technical fidelity review

Reviewed 25 September 2026 against `8da63b7` on `feat/bt-runtime`.

This is a review and proposed direction, not an implementation claim. No application behaviour was changed during this review.

## Implementation follow-up — 25 September 2026

The first authorised implementation slice now adds the full-page arbiter workbench while preserving the concise account panel. New runs persist nine domain proposals, hard eligibility checks, explicit policy priorities, specific evidence references, memory changes, historical links and execution/receipt records. Selecting a proposal connects those records across the workspace; selecting an earlier run shows its original trace.

The engine now derives decisions from context rather than customer identity. Fresh incidents and cases can override a remembered habit; incident scope and callback capacity come from source payloads. A new fault resets current restoration/confirmation state while retaining past decisions. These changes address the corresponding findings below; the remainder of this document records the original audit against `8da63b7`.

Still outstanding from the broader proposal: competing resource reservations and replanning, Eve outcome write-back, retrieval influencing arbitration, watch expiry, a complete Sam outcome, subsequent reuse of learned episodes and measured commercial impact. Domain proposals are deterministic; delivery remains simulated. This slice makes the existing decision loop inspectable without claiming those future capabilities.

## Verdict

The five-panel composition is the right foundation. The current demo makes retained context, named ownership and a consistent customer experience tangible. Its strongest moment is a restored connection that does **not** erase a promised callback or stand in for customer confirmation.

The implementation is substantially narrower than Mark's pitch and our design specification. The interface is more finished than the decision model underneath it. Most of the apparent arbitration is an authored choice among fixed branches, operational memory is a small snapshot, and the embedding study runs beside the decision process. The demo does not yet prove that context can overturn an established interpretation, that competing plans can be reconciled under capacity constraints, or that an outcome improves a subsequent decision.

More agent cards, animated connections or confidence percentages would not fix this. Technical difficulty should be visible in a consequential decision: evidence changes, a credible proposal becomes invalid, a promise remains protected, and the system finds an executable alternative.

Keep the opening **“same signal, different meaning.”** Add the stronger proof: **“same person, new evidence, different decision.”**

## Presentation direction clarified after the review

The user clarified that Mark will narrate the important pieces. The product should support that narration while leaving substantial technical detail available to explore. A concise arbiter answer in the small account panel is desirable. The full-page expansion must reveal the working system in materially greater depth.

This corrects any implication above that technical density itself is the problem. The overview and the expanded workspace have different jobs. Keep the five-panel overview readable; use the full expanded canvas for a dense, connected technical investigation. Preserve back navigation and avoid tabs within tabs. Fit the main workspace to the viewport, with selectable records and an inspector for deeper detail rather than reducing all content to a handful of summaries.

Revisited the local Sainsbury's repository at `7316a13`, including the latest dashboard and presenter changes. The concrete patterns to adapt are:

| Sainsbury's implementation | BT application |
| --- | --- |
| `SystemHeartbeats` and `RawSignalsFeed`: source activity, silence and timestamped inputs. | Router telemetry, provisioning, care and incident feeds; actual observation windows and freshness. |
| `DetectionEvidence`: neighbouring-lane comparison, expected versus observed, queue history. | Personal heartbeat baseline versus tonight; provisioning expected versus observed; affected versus unaffected service evidence. |
| `StoreMemoryPanel` and `MemoryWritesFeed`: current context, domain state and visible writes. | Operational and customer memory snapshots with exact before/after changes, writers and source references. |
| `ArbiterStripe`, `ReasoningTrace` and `ScoreCurve`: ranked tasks, factors, thresholds and inspection of a selected decision. | Candidate queue plus the selected candidate's criteria, policy gates, urgency, evidence and decision path. Define BT-specific rules rather than copying retail weights or thresholds. |
| `reassessHeld`: time and new context can promote a held task. | Watch deadlines and new customer/incident evidence visibly reconsider pending work. |
| `AwaitingDecision`, expiry and dispatch surfaces: accountable action with a time window. | Named care ownership, callback constraints, expiry, execution status and the phone consequence. |

These mechanisms give the presenter specific things to point to. A selected task can explain the signal, memory change, assessment, threshold or constraint, and resulting action without requiring the audience to absorb every row.

Sainsbury's also demonstrates that a reproducible scenario with deterministic decision logic can have substantial technical fidelity. We do not need a production infrastructure programme or an LLM deciding every field before demonstrating this. Controlled synthetic inputs are appropriate; the displayed evidence, calculations, transitions and consequences must agree. Some reference visuals are illustrative, so adopt their presentation patterns while grounding BT's displayed values in its own scenario state.

The revised design brief is therefore: **a clear account overview, with technically rich full-page workspaces behind each panel; Mark controls how deeply to explore the connected use case.**

## Scope and verification

Read Mark's supplied narrative, the pitch-to-experience mapping, the design specification, lab methodology and the runtime/UI code. Inspected representative populated states in the live five-panel overview, customer memory, operational memory, arbiter, actions, source records and reference lab; also inspected the phone/Eve implementation. This was not an exhaustive visual test of every person × revision × viewport combination.

Ran isolated in-memory counterfactuals without changing the user's session. The existing 17 application tests pass. The lab verifier passes for 132 real 384-dimensional vectors, 42 deduplicated episodes and five computed clusters. Passing these checks establishes the implemented paths; it does not resolve the counterfactual failures below.

## 1. What Mark is promising, and what we currently prove

Mark explicitly supplied a CEO narrative to validate with BT, not a solution design. Ambient agents, an arbiter, Jev-style assessments, operational memory and these screen layouts are our proposed implementation of that narrative.

| Pitch commitment | Current proof | Missing proof |
| --- | --- | --- |
| Customer memory changes the response | Failed diagnostics, a named promise and a stated habit are retained and inspectable. | A current fact overrides an old interpretation; derived habits are calculated from underlying observations; a correction changes subsequent decisions. |
| Reasoning and planning use wider context | Three characters receive different fixed responses; incident scope changes Daniel and Sam's paths. | Genuine proposals, incomplete evidence, conflicting prerequisites, constrained resources and replanning. |
| Decisions become governed actions | Persisted decisions, idempotent demo messages, scoped contact authority and simulated delivery receipts. | A bounded operational tool execution, capacity reservation, pre-execution freshness check, rejection/retry and named handoff. |
| Outcomes compound into learning | Restoration, callback fulfilment and confirmation remain separate events. | An outcome becomes a reusable episode or revised belief and demonstrably changes a later decision. |
| Governance is part of the system | Historical reads, scoped Eve context, source records and policy labels. | Specific evaluated policy results attached to proposals; executable expiry/wake rules; complete decision-to-outcome lineage. |

The four customer moments are covered unevenly:

- **First seven days:** Sam starts the right question—delivery is not activation—but never reaches confirmed first use. The central success condition remains unproved.
- **Silent router:** the comparison is legible, but its most important claim fails when Maya's circumstances change.
- **Proactive memory:** Daniel is the strongest story. Extend it across incoming conversation and operational action, not just outgoing updates.
- **One household, several products:** there is one broadband service per fictional customer. Cross-product continuity is currently outside the demonstrated scope. Keep it as a clearly bounded extension until identity, service ownership and authority are modelled.

“Why Accenture” will be most convincing when one trace crosses a customer contact, a service record, a network observation, an operational constraint and a named human responsibility. This makes the integration and experience-design work visible without another consultancy slide in the app.

## 2. Priority findings

### P0 — The decision can contradict its own evidence

[`engine.ts`](../../app/server/engine.ts) selects Maya's watch branch by customer ID before evaluating the incident branch. Outgoing messages are also suppressed by her ID. Other paths include character-specific logic and authored explanations.

The isolated checks produced these results:

| Changed input | Projected state | Recorded decision |
| --- | --- | --- |
| Baseline Maya fixture | No case or incident | Watch, consistent with the intended story. |
| A fresh incident explicitly includes Maya | `incident: true` | Still watch; explanation says her service is outside the incident. No message. |
| A new unresolved case is opened for Maya | `caseStatus: open` | Still watch; explanation says there is no open case or promise. No message. |

These are engine-level counterfactuals beyond the scripted UI, not claims that the existing replay exposes those inputs. They reveal why the current demo cannot yet withstand the obvious question: “What if she really does have a fault tonight?”

**Required correction:** decisions follow evidence, obligations and policy; names are presentation data. Reasons must describe the predicates actually evaluated. Add a regression proving that exchanging customer identities while retaining the same relevant facts does not change the decision.

### P1 — Operational memory describes constraints it does not enforce

The `snapshot.operations` projection hardcodes Daniel and Sam as the affected services whenever an incident exists. The two callback slots are literals. They do not change with resource allocation and are not inputs to `assess`.

Consequently “capacity is finite” is currently a claim on a screen. The system cannot demonstrate two reasonable requests competing for one resource, a held promise consuming capacity, or a slot becoming unavailable before execution.

Separate three useful layers: current operational state, derived typical conditions, and resolved operational episodes. Begin with actual event-projected incident membership and versioned appointment capacity. Forecasting should follow coherent history and validation; it cannot be substantiated by adding a forecast label to a fixture.

### P1 — The arbiter is a result display, not a difficult decision

The worker projects each household and calls one assessment function. There are no persisted ambient flags, domain mandates, competing domain proposals or reconciliation records. “Repeat restart” and “new product offer” are always the held alternatives. Both are generally obvious exclusions, so rejecting them demonstrates little judgement.

The enlarged screen reinforces that thinness: a large six-node architecture diagram, a decision already stated above it, record counts, and the same two alternatives. At 1280 × 720 the document was approximately 1,074 pixels tall, with the detailed constraints below the fold. The diagram itself occupied roughly 339 pixels vertically.

The current “watch until 21:10” is text, not a scheduled expiry. The picture keeps pointing to the original heartbeat even when a later event caused the latest assessment. Evidence IDs contain the household's entire available evidence set; this records supplied context, not the decisive dependencies of the conclusion.

### P1 — The embeddings are real, but disconnected from the decision

[`MemoryAtlas.tsx`](../../app/src/MemoryAtlas.tsx) loads a saved corpus and selects one of six precomputed scenario queries by person and incident presence. It performs real cosine retrieval. The underlying lab uses 42 synthetic episode motifs, three formulations each, real 384D embeddings, five computed clusters and a lossy 3D projection.

This is legitimate exploratory work, honestly labelled. However:

- Retrieval does not feed the runtime arbiter or Eve.
- The query does not evolve with restoration, callback fulfilment or conversation.
- These are general example episodes, not embeddings of the selected customer's actual retained records.
- The documented silhouette of approximately 0.12 indicates overlapping illustrative groups. The 3D projection retains 26.7% of variance. Neither establishes strong customer segmentation.

The useful visual is a selected current context retrieving a relevant prior episode, showing its source, and changing a proposal. Keep similarity explicitly distinct from confidence, likelihood of failure or permission to act.

### P1 — Eve reads the story but cannot contribute to it

Eve's model connection and scoped context are real. [`server/eve.ts`](../../app/server/eve.ts) deliberately makes it read-only; conversation is retained in browser session storage rather than written as customer source records.

If Maya says “I'm working late and the connection is broken,” Eve can discuss that statement, but the arbiter never receives the new evidence. A verbal confirmation also cannot fulfil an account action. This is an important product boundary, currently stated honestly, but it breaks Mark's promise of one memory across channels.

Add narrowly defined server-validated tools for recording an explicit report, requesting a handoff and submitting a confirmation where allowed. Store the customer's statement separately from a model interpretation. The assistant should only announce completion after receiving the actual result.

### P1 — The feedback loop and value case stop too early

The completed replay has 18 events, 15 decisions and six simulated messages. Daniel finishes; Sam remains unconfirmed; Maya receives no contact. None of those counts alone proves avoided calls, reduced churn or incremental revenue.

There is no retained resolved episode that changes the next retrieval, no comparison against an existing policy, and no measured incremental value. Closing a case is useful state management; calling it self-learning would overstate what happened.

## 3. Screen-by-screen direction

| Screen | What to keep | What weakens the story | Recommended proof on this screen |
| --- | --- | --- | --- |
| Five-panel account | Two memories left, phone centre, arbiter and outcomes right; compact Jio-style evidence treatment. | Repeated facts and explanatory copy compete. At smaller desktop heights the actionable phone update and lower panels are below the fold. | One changed fact, one decision consequence and one next observation. A small comparison strip can show recovery / activation / watch without requiring three separate tours. |
| Customer memory | Fact-to-source inspection, time context and restrained BT chart palette. | A small cube inside a large canvas; generic precedents sit apart from personal records. Vector dimensions are more prominent than what memory changes. | Distinguish stated / observed / derived. Show retained promise, current exception and retrieved episode together. Selecting a point reveals the exact records and proposal it informs. |
| Operational memory | Explicit affected-service membership and separation of shared incident from personal context. | Large headings and sparse cards; actual capacity lower down; no enforced contention or uncertainty. | A service-to-incident matrix with freshness, plus a demand / capacity / promised-work timeline. Pin the selected household to the shared picture. Add forecasts only once fitted and validated. |
| Arbiter | A dedicated full-page inspection with back navigation. | Architecture labels occupy the space that should explain the difficult choice. Fixed alternatives and all-record evidence counts obscure the reasoning. | Candidate comparison, changed evidence, hard constraints, selected bounded plan and execution recheck. See the proposed layout below. |
| Actions and outcomes | Restoration, callback and confirmation are separate. Receipts and action IDs exist. | Simulated receipt is immediate; no resource rejection, useful retry or outcome-to-memory link. | Planned → committed → delivered → observed outcome, with timestamps and exact lineage. Show one real simulated execution failure and recovery. |
| Phone / Eve | Native phone shell, simple support entry, coherent voice transition and same server context. | “Your home, connected” is poorly matched to an unresolved problem. The relevant update can sit below the hero and support entry. Conversation does not change account memory. | Put the current service moment first. Let an explicit customer statement update the shared story through a bounded tool. Preserve a clear human route and named responsibility. |
| Source records | Readable descriptions, occurred/received times and inspectable payloads. | The selected-person context surrounds an all-session ledger without enough scope indication or filters. IDs alone do not demonstrate lineage. | Default to this case; offer clearly labelled all-session scope. Filter by subject/source/type and traverse record → memory → proposal → decision → action → outcome. |
| Visual lab | Memory lanes, retained obligations, temporal differences and vector inspection. | Separate authored state, dates and examples interrupt continuity when reached as if they explain the current runtime decision. | Reuse the strongest visual components against current session data. Keep standalone studies under an explicit lab entry. |
| Static design review | Argument map and comparison of proposed concepts. | Some scope descriptions predate the live runtime. | Keep it labelled as design/reference material and reconcile its implementation status with the app. |

### Visual hierarchy across the app

Keep the agreed white surfaces, cool lilac canvas, BT purple selection and system sans/mono hierarchy. Another palette or font overhaul would distract from the substantive work.

Use sans for the decision and its consequence; mono for times, identifiers and technical attributes. Reserve colour for meaning: selected path, observed outcome, unresolved state and held/stale constraint. Avoid using colour to imply unsupported probability.

Reduce repeated section titles, tall explanatory banners and oversized empty graph regions. The eye should find **what changed → why it matters → selected response → proof**. Expanded sections should fit the agreed presenter viewport, with a side inspector for detail and back navigation to the account. No nested tabs or new navigation hierarchy is needed.

## 4. A more convincing arbiter

The role split remains useful:

1. A bounded ambient watcher notices a typed observation and flags its quality, subject and time.
2. The arbiter reads relevant customer and operational context and issues bounded domain mandates.
3. Domain workers return proposals, prerequisites, evidence and unresolved questions.
4. The arbiter reconciles them against obligations, authority, capacity and competing actions.
5. An executor rechecks the latest state before committing. Subsequent observations establish the outcome.

These responsibilities can initially run in one local process. Independent agent services are not necessary to make them real and inspectable.

### Full-page composition

| Position | Content | Purpose |
| --- | --- | --- |
| Compact top strip | Actual trigger, context revision, changed records, policy version, run state. | Establish why this run happened and what information was available. |
| Left, about 25% | Decisive customer and operational evidence; freshness; bounded interpretation questions; record links. | Separate observations, interpretations and unknowns. |
| Centre, about 50% | Three to five credible proposals: outcome, proposer, prerequisite/resource, conflict and disposition. | Make the hard trade-off legible. |
| Right, about 25% | Chosen plan, named owner, tool scope, preserved obligation, expiry and expected observation. | Define what can actually happen next. |
| Bottom strip | Revision / recheck / commit / receipt / outcome timeline. | Show a decision changing and the action surviving, or failing, execution checks. |

At 1280 × 720 the main argument should fit without scrolling; detailed JSON and full evidence open in an inspector. The architecture diagram can become a small orientation breadcrumb rather than the central visual.

For Daniel at incident confirmation, proposals might look like this **once implemented**, rather than pretending these records exist now:

| Proposal | Why it is plausible | What decides it |
| --- | --- | --- |
| Run a fresh diagnostic | Earlier troubleshooting failed and line state is still uncertain. | A current network observation may make this unnecessary; record the specific fresh test being considered. |
| Continue the existing recovery case and callback | A named person already owns an obligation. | Preserve it through network restoration; do not equate technical recovery with a fulfilled promise. |
| Send an immediate incident update | New affected-service evidence is useful to the customer. | Check what has already been sent and whether it duplicates a near-due human contact. |
| Create another callback | An automatic domain proposal may request extra support. | Merge or reject if it duplicates ownership; otherwise require a real available slot. |
| Offer a relevant product | It could become useful in a later, resolved relationship moment. | Hold without verified service recovery, applicable contact authority and relevant intent. |

Show one selected plan becoming stale because capacity or incident state changes before commitment. A rejected reservation with a recorded reason, followed by a revised plan, demonstrates more engineering than several animated agent nodes.

Borrow Jev's explicit question, answer alternatives, criteria and evidence presentation. Use actual model outputs only where interpretation is required. Incident membership and appointment availability are deterministic facts. Any displayed distribution must be labelled for what it measures; model preference over answers is not automatically a calibrated probability. Do not invent scores to fill a chart.

## 5. A tighter demonstration story

The customer stakes should stay understandable while technical depth unfolds on demand.

**Beat 1 — Three quiet routers.** A management heartbeat is overdue. The cause is unknown. Daniel has an unresolved case and a promise; Sam has delivery without first use; Maya has a stated habit supported by observed history. Three responses follow from those facts.

**Beat 2 — Shared evidence arrives.** Explicit incident membership changes Daniel and Sam's plans. The arbiter joins previously separate work, avoids redundant diagnostics and keeps the existing owner. Show exactly which proposals changed and which obligation did not.

**Beat 3 — A remembered pattern is contradicted.** Maya reports a problem tonight, or a fresh incident record includes her. Her typical behaviour remains useful history, but the current exception changes the action. The new statement reaches the same memory through Eve. This is the strongest proof that the system knows a person without trapping them in a profile.

**Beat 4 — The plan meets operational reality.** A desired resource is no longer available. The executor rejects the stale proposal, preserves the promised callback and produces a feasible plan or named handoff. Show the actual version conflict and receipt.

**Beat 5 — Establish the outcome and retain it.** Restoration, the promised call and customer confirmation close separately. Complete Sam's first-use journey too. Retain a sourced resolved episode and show it being retrieved in a subsequent relevant case.

Do not squeeze every variation into a single autoplay sequence. Keep a short default walkthrough and a small number of explicit scenario variations that recompute the same system. Changing the data should change the decision; changing screens should not.

A later commercial chapter can show newly expressed need → eligible recommendation → activation → subsequent paid use. It should demonstrate earned relevance and incremental adoption, with service obligations and authority still respected. The current service story does not establish that value yet.

## 6. Data and contextual fidelity

Use coherent synthetic records to support real computations. High volume by itself is not fidelity.

- **Separate telemetry meanings.** Missing management heartbeat, line sync, traffic, provisioning state and successful first use are different observations. Declare the source contract and what absence means.
- **Make the history inspectable.** Maya's “26 overnight gaps” currently comes from an authored summary. Generate the underlying intervals and source availability, then calculate the baseline. Her ten-minute evening recovery also needs to agree with the “overnight” explanation, or the explanation needs to change.
- **Distinguish knowledge types.** Preserve what the customer stated, what a system observed and what a model inferred. Record effective time, received time, freshness and supersession. A temporary exception should not silently erase a long-term preference.
- **Model operational resources.** Service-to-incident membership, incident updates, skills, shifts, occupied slots, due promises and reservation versions should project from records. A capacity chart must constrain a plan.
- **Use a connected decision record.** Link the trigger, snapshot revision, selected evidence, retrieved episodes, assessment, mandate, proposals, policy checks, chosen plan, resource version, execution and later outcome. Record model/prompt version where a model actually ran.
- **Distinguish kinds of learning.** Updating a factual memory, adding a resolved episode and improving a predictive model are different operations. Show the first two before claiming the third. Any forecast needs an appropriate baseline and held-out evaluation.
- **Keep authority scoped.** Household address or brand ownership alone does not authorise cross-person or cross-brand data use. This is part of the record model, not another warning banner.

Supabase could provide a hosted relational store, vector search and durable jobs later. Moving these fixtures into it would not itself solve the missing semantics, operational constraints or closed loop. Establish one correct causal trace first; preserve it through the storage migration.

## 7. The value case we can defend

Mark's value ranges are explicitly illustrative and are not BT forecasts. The app should expose the measurement mechanism beneath the argument rather than display those ranges as demonstrated results.

| Value hypothesis | Observable measure | What is still needed to claim impact |
| --- | --- | --- |
| Less repeated work | Repeated diagnostic instructions and contacts per resolved case. | Comparison with existing policy or a suitable control; not every held action would otherwise have happened. |
| Faster successful onboarding | First use confirmed within a defined interval, divided by eligible delivered orders. | Completed Sam path, a cohort and a clear first-use definition. |
| Better human follow-through | Promises met by deadline / promises due; adviser workload and queue age. | Real or coherent simulated allocation, including missed/renegotiated commitments. |
| More useful proactive contact | False contact rate, missed-fault rate and time to reconsider after contrary evidence. | Labelled outcomes and evaluation across variations, including failures. |
| Lower cost to serve | Measured contact minutes, diagnostic/tool cost and model cost per completed outcome. | Loaded rates, baseline and incremental costs; count suppressed notifications separately from avoided inbound calls. |
| Relationship retention | Retention over an agreed follow-up window. | BT pilot/control data; a resolved synthetic case is not evidence of churn reduction. |
| Broader relevant adoption | Eligible recommendation → acceptance → activation → paid continuation. | A separate completed journey, permission/intent, attributable incrementality and margin. |

Keep three levels visibly distinct: **observed demo counts**, **assumptions used to size a pilot**, and **measured pilot impact**. Do not double-count retention value, product margin and contact savings from the same unsupported causal assumption.

Useful technical measures include decision latency, source freshness, proposal rejection reason, execution retries and actual model cost. Agent count and message volume are activity measures, not business value.

### Pitch claims to tighten

The supplied internal Accenture references were not available for a full statistical audit. Their research percentages and commercial ranges remain attributed claims requiring validation before external use.

- “Network and price have stopped differentiating” is too absolute. The stronger argument is that relationship quality captures more value from the network and product investment.
- The ARPU paragraph describes 2015–2025 and then calls it “the same five years.” Reconcile the measurement periods and underlying margin definition.
- “Most churn risk” originates in the first week is stronger than the supplied evidence establishes. Frame failed onboarding as a testable early-risk hypothesis.
- The 1.6 million One Touch Switch figure is supported by [Ofcom's 12 September 2025 release](https://www.ofcom.org.uk/phones-and-broadband/switching-provider/1.6-million-brits-hit-switch-on-their-broadband-provider). Keep its historical period explicit.
- The Article 50 sentence overstates a general explainability requirement. It sets specified transparency duties, including identifying direct AI interaction; applicability depends on the deployment. Use the [European Commission's Article 50 guidance](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act) when revising the claim, rather than assuming it automatically governs every UK BT interaction.

## 8. Recommended order of work

1. **Make decisions context-driven.** Remove identity-dependent decisions; correct incident/capacity projections; make contradiction handling and decision explanations agree. Preserve existing history, idempotency and contact-scope checks.
2. **Build one difficult end-to-end run.** Persist ambient flag, mandate, domain proposals, arbitration and execution recheck. Include a real simulated resource conflict and a bounded outcome write-back.
3. **Connect the customer channel and memory visual.** Eve contributes explicit source statements through validated tools. Retrieval uses the same scoped snapshot as the decision and its selected episodes are visible in the trace.
4. **Recompose the existing screens around that run.** Prioritise the arbiter and operational memory; bring the lab's temporal memory visual into the runtime. Retain the current five-panel navigation and BT typography/surface hierarchy.
5. **Finish the outcome and value proof.** Complete Sam, demonstrate a later reuse of learned context, and add measured-versus-assumed value fields. Extend to commercial adoption or validated forecasts only after this loop holds together.

### Acceptance questions for the next build

- Can the same person receive a different decision when new facts contradict their history?
- Can every displayed decision reason be traced to a predicate and specific available records?
- Does a late-arriving observation stay out of earlier decisions and trigger a later reassessment?
- Can two plausible proposals compete for one resource, with one rejected and replanned?
- Does an existing human promise survive unrelated technical restoration?
- Can the customer tell Eve something that changes the next system decision without the model inventing an account action?
- Does retrieving a precedent affect a proposal, and can we inspect its source and outcome?
- Does a watch expire and reconsider if the expected observation never arrives?
- Are delivery, technical recovery, customer confirmation and business impact visibly different facts?
- Can the expanded arbiter explain the difficult choice on one screen?

If these hold, the demo will show technical capability through behaviour the audience can challenge, while retaining the clean format already established.

## Evidence index

- [Mark's original narrative](../source/marks-bt-consumer-pitch.txt)
- [Pitch-to-experience mapping](../design/2026-09-25-pitch-to-experience.md)
- [Experience design specification](../superpowers/specs/2026-09-25-bt-consumer-experience-design.md)
- [Runtime decisions, persistence and operational projection](../../app/server/engine.ts): original review locations at `8da63b7`: `assess` around line 125; Maya branch around 157; message suppression around 212; operational projection around 653. Current proposal evaluation is in [arbiter.ts](../../app/server/arbiter.ts).
- [Expanded screens](../../app/src/SectionView.tsx)
- [Customer memory visual](../../app/src/CustomerMemory.tsx)
- [Saved vector retrieval](../../app/src/MemoryAtlas.tsx): corpus load around 66; saved query selection around 88.
- [Embedding methodology](../design/lab/notes.md)
- [Eve's scoped context and read-only boundary](../../app/server/eve.ts)
- [Eve conversation storage](../../app/src/Eve.tsx)
- [Existing runtime tests](../../app/tests/engine.test.ts)
