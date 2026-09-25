# BT Consumer — Experience intelligence

**Design specification · 25 September 2026 · proposed demonstrator, not a description of BT's deployed systems**

Companions: [visual review and UI mockups](../../design/review.html), [Mark’s pitch mapped to the design](../../design/2026-09-25-pitch-to-experience.md), and [BT brand extraction and styling](../../references/2026-09-25-bt-brand-audit.md).

## 1. The experience we are building

Show BT remembering the customer, understanding what is happening operationally, and taking a useful, accountable action. Start with a recognisable customer moment, then let the audience open the system underneath it. The same signal should visibly lead to different decisions when the evidence changes.

The demonstration must work for a Consumer leadership audience in six minutes and withstand a technical inspection afterwards. It should substantiate the supplied proposal's connected argument: customer memory, reasoning, governed execution and outcome learning form one working loop. Operational memory gives that loop a view of what the business can actually deliver.

**Working line:** “A connection problem is a customer moment. Remember the history. Understand the situation. Follow through.” This is proposed demo copy, not a BT campaign line.

The commercial purpose is to improve dependable service, reduce avoidable effort, keep promises and earn the opportunity to deepen the relationship. Product breadth and spend are outcomes to observe after a relevant offer; they must not override unresolved service needs or become proxies for customer satisfaction.

This specification and its review mockups now live in the dedicated `GitHub/BT` repository. They propose the next build; no BT database, production connection or deployment has been created. Soho remains the reference implementation. All BT households, operational records, capacities and prices used in the future demonstrator will be fictional and visibly identified as such.

### Success in one viewing

The audience can answer five questions without a presenter translating the screen:

1. What happened to this customer?
2. What did we remember that changed the response?
3. What does the business know, and what can it deliver now?
4. Why was this action chosen, held or escalated?
5. What evidence would establish that it worked?

## 2. What we take from each reference

| Reference inspected | Keep | Improve for BT |
| --- | --- | --- |
| Jio CX, local revision `b90f08f9` | Customer memory across channels; ambient signals waking an arbiter; domain ownership; pending-action continuity; durable plan and outcome records | Expose one comprehensible decision at a time. Reuse the separation of brain and channel, without importing its entire infrastructure stack. |
| Early Jio presentation, identified in the Soho design record as `772bce9e` | Expanding customer touchpoint → intelligence → outcomes panels | Preserve the selected customer, phone state and decision while revealing more detail. |
| Sainsbury's, local revision `7316a13`, including `b87716a` and `e90f14e` | Raw signals; operational state; resource constraints; held tasks reconsidered when context changes; dispatch and outcome surfaces | Make the operational memory structural and historical. Its `storeContext.ts` summary is rule-generated and `storeForecast.ts` is a hand-shaped projection; neither becomes “learned AI” by relabelling it. |
| Soho, local revision `b68b42d` | Polished phone; customer × operational context; linked evidence; historical cohorts; typed Jev assessments; hosted records; atomic action rechecks and write-back | Carry the successful interactions into a coherent BT story. Replace disconnected labs and manual “run the next agent” buttons with one automatic decision path. |
| TypeSafe / Jev | Small typed questions, visible answer distributions, criteria and uncertainty | Assess ambiguous evidence inside a domain. Keep deterministic facts, permissions and capacity out of model guesswork. |

Repository documents and relevant implementation paths are listed in section 15. These references establish patterns we can reuse; they do not establish BT capability or permission to transfer another client's records.

### Direction chosen

| Approach | Strength | Limitation |
| --- | --- | --- |
| Phone-led concept only | Immediate customer appeal | Cannot demonstrate memory, execution or operational judgement convincingly |
| Full operations dashboard first | Technical depth immediately visible | Repeats the dense, hard-to-follow screen the user has already rejected |
| **Connected customer story with progressive technical disclosure** | A simple entry point backed by inspectable records and working services | Requires one shared state and consistent selection across all views |

Choose the third. A technical workbench remains available directly, but it shows the same case and run as the customer story.

## 3. The hero story: three quiet routers

Set the replay on a fictional Friday at **21:00 Europe/London**. Three services receive the same event class: `router.heartbeat_overdue`. This says an expected management heartbeat was not received. It does **not** establish loss of line synchronisation, zero traffic, a powered-off router or a household's activity.

| Fictional household | Evidence available at the start | Appropriate initial path | Customer-visible result |
| --- | --- | --- | --- |
| Maya Patel · established service | Repeated overnight management gaps followed by recovery; previously stated habit of switching equipment off; no open issue; fresh independent service checks where available | Watch within a defined observation window; run permitted diagnostic checks; reconsider on new evidence | No interruption. The technical view explains the deliberate hold and its expiry. |
| Sam Morgan · first seven days | Installation order marked delivered; service activation not yet confirmed; no successful-use observation; no prior support case | Activation domain distinguishes incomplete setup, provisioning delay and insufficient evidence | A short setup offer only if the evidence supports it; otherwise an honest investigation update. |
| Daniel Reed · unresolved recovery | Repeated drops; open complaint; failed earlier troubleshooting; named owner; an explicit promise to call at 21:15 | Continue the existing recovery plan; keep the owner and promise; inspect incident and diagnostic context | A continuity message and existing case, rather than starting troubleshooting again. |

No claim is made about teenagers, what anyone is watching, or work dependence inferred from traffic. A stated need can be remembered with its source; a missing diagnostic stays unknown. An established habit lowers urgency only while contrary evidence is absent and the watch deadline remains valid.

### Six-minute presentation sequence

| Beat | What happens automatically | What the audience sees |
| --- | --- | --- |
| 1 · One signal | Presenter starts the scenario; persisted source events enter the runtime | One household phone and the event in plain language |
| 2 · Different histories | Household selector compares the three persisted decisions | Same event class, three responses; one is intentionally no message |
| 3 · Open the intelligence | Reveal customer memory, operational context, assessment and policy result | Evidence that changed the answer, with clickable source records |
| 4 · An area incident is confirmed | A new incident record identifies Sam and Daniel's services as affected; Maya's is outside scope | Arbiter revises relevant plans, avoids redundant reboot requests, consolidates updates and retains Daniel's promised owner |
| 5 · Capacity changes | A fictional support slot is consumed elsewhere before a pending action commits | Execution recheck prevents double allocation; a revised slot or named handoff appears |
| 6 · Follow through | Advance the scenario to subsequent diagnostic and customer outcome events | Technical restoration, customer confirmation and fulfilled promise appear separately; unresolved evidence stays open |

The incident must genuinely alter the input snapshot and create a superseding decision. It is not a caption change. Previously committed messages remain in the audit record; later context cannot rewrite the past.

### Second chapter: service earns the next opportunity

After an explicit jump to a later date, show Sam's service confirmed working, support completed and a previously stated interest in managing mobile and broadband together. The relationship domain can assess a fictional eligible proposition against remembered needs, current products and contact preferences.

Show Daniel's analogous commercial candidate held while recovery is unresolved. When Sam engages, separately record offer displayed, accepted, product activated and an illustrative later paid renewal. The customer declines or ignores path must also work. An offer is not adoption; adoption is not incremental revenue; classification confidence is not future purchase probability.

This chapter transfers Soho's “try something relevant, then see whether they return and pay” idea to BT. Its eligibility, price and benefit are explicitly demo policy, not a promise about current BT tariffs. It is a secondary chapter, not a sales interlude during a fault.

## 4. The screen and where the eye goes

Primary navigation: **Experience · Operations · Evidence**. These are views of one runtime, not separate simulations. Scenario time, household, case and selected run travel together in the URL; switching views never reruns a model or resets a conversation.

### Five panels around the customer

The chosen desktop composition returns to the Jio account view before the Studio expansion: **two panels on the left, the phone in the centre, two on the right**. The phone anchors the story; the surrounding panels show what the system knows, decides and establishes. This replaces the earlier progressive-thirds proposal.

| Position | Overview panel | Full-page breakdown |
| --- | --- | --- |
| Left, upper | **Customer memory** — the three facts that matter now | Records, current state and retained learning; six memory lenses; personal baseline, provenance and prior attempts |
| Left, lower | **Operational memory** — incident scope, constraints and promises | Affected-service matrix, source freshness, typical demand, conditional forecast and available capacity |
| Centre, full height | **Customer experience** — MyBT phone, current case and plain-language consequence | Service journey, message/case detail, bounded reply choices and a visible human route |
| Right, upper | **Arbiter decision** — disposition, decisive reason and held alternative | Ambient flag, bounded mandate, typed domain assessment, policy checks and reconciled proposals |
| Right, lower | **Actions & outcomes** — next commitment, owner and observed status | Execution recheck, receipt, rejection/retry, later observations and the resulting memory revision |

Every panel has an explicit expand control. It opens a **full page**, with a breadcrumb, the same household/scenario and a concise explanation above its evidence. It must add useful detail rather than merely enlarge the card. Back returns to the overview without resetting the phone, conversation or decision. Adjacent detail tabs support comparison. Household, incident and open panel are URL state; browser Back/Forward and reload preserve the selected state. Opening a panel does not issue a model call.

At desktop width, use `minmax(270px, 1fr) 330px minmax(290px, 1fr)` with two rows and a centre phone spanning both. At tablet widths, show the phone above two columns of summaries; on narrow screens, phone then the four cards in one column. Never shrink a desktop canvas to fit mobile. Full-page detail becomes one readable column on narrow screens.

Keep the pre-Studio Jio typography and density: compact system sans for UI, monospace for identifiers/times/records, warm paper, white panels, fine dividers and restrained shadow. Reference: `ecd_jio_cx` commit `ee83558b`, `WS2-mvp/phone/src/theme/tokens.css`, `App.jsx`, `MemoryPanel.jsx` and `ScenarioPanel.jsx`. Its April 2026 main layout predates the June Studio work; the user's requested two-left/two-right arrangement is the BT adaptation. Carry over the type stacks and visual rhythm, replace orange/Jio blue accents with BT purple, and use BT identity inside the app. No Jio font binaries are required by this operator UI. The user subsequently confirmed the running July 9 snapshot (`621fa991`) as the fidelity benchmark: attribute rows, source records, incident scope, domain checks and action traces. Use that level of technical realism while omitting duplicated merge-era controls and Studio sections.

Desktop chrome budget: 52px identity/navigation, approximately 38px scenario strip and one compact heading/household selector. Avoid another stage-navigation row. A 60-second first look should establish the customer consequence and the four connected responsibilities without navigating a Studio.

The phone remains mounted across panel changes. Preserve iPhone proportions, system status, readable timestamps and appropriate notification styling established in Soho. A notification opens its case or message; the proposed build persists replies through the server. This review mock uses authored states and a case preview. MyBT screens are concepts, not a claim of access to the actual app.

### Operations and Evidence

**Operations** opens on an incident/capacity timeline and a small set of affected services. Selecting a service identifies the related household and plan. The default covers the next hour: current workload, available support capacity, promises due and observed demand against a typical-period baseline. A headline explains the most important constraint: for example, “Two callbacks due; one slot remains.” Values must come from the active snapshot.

**Evidence** is the technical workbench: a filterable record table, selected payload, memory derivation, decision revision and execution receipt. It supports keyboard selection, copied IDs, source/subject/event filters and deep links. Default to records relevant to the selected case; “all records” is an explicit expansion.

Every chart selection coordinates with the same inspector. A presenter should never need to reconcile a selected dot, a different household and an unrelated agent trace.

### Visual studies to retain

| Visual | Exact mapping | Why it exists |
| --- | --- | --- |
| **Customer memory lanes** | Time on x; connectivity, contacts, orders and promises on separate rows; stated facts and derived patterns have different marks | Establish personal normality and unresolved history without turning memory into a tally |
| **Operational state matrix** | Service groups or incidents on rows; observed time on x; state colours plus freshness/unknown hatching | Explain shared conditions and data gaps; no decorative embedding cloud for operational truth |
| **Memory comparison** | Selected household's observed baseline beside a matched cohort, with denominator and time window | Separate individual learning from a typical customer/service pattern |
| **Jev assessment rows** | Named question, criteria, actual returned distribution, chosen answer and evidence set | Make model judgement inspectable in the style the user liked |
| **Arbiter comparison** | Candidate actions as rows; decisive evidence, blocked conditions, disposition, revisit time and owner | Explain conflicts without a mysterious combined “AI score” |
| **Forecast strip** | Observed arrivals, seasonal baseline, conditional forecast and uncertainty against capacity; one marked cutoff | Connect memory to what the operation should prepare for next |
| **Semantic episode atlas · optional lab** | Two-dimensional projection of real episode embeddings; neighbours use original-vector similarity, selection opens text | Explore related experiences. Axes are labelled projection coordinates, not invented human traits or risk scores. |

Ship the lanes, matrix, assessment rows and forecast strip first. The atlas is an optional study using the same data after the core story works. It must not displace a clearer evidence view simply because it looks technical.

## 5. Memory is a data product

Use three distinct layers for both customer and operations: **records → current state → retained learning**. A summary is a view over these layers, with source links; it is not their replacement.

| Layer | Customer memory | Operational memory |
| --- | --- | --- |
| Records | Service activation, authorised contact, diagnostic outcome, customer statement, promise and subsequent confirmation | Incident update, dependency mapping, queue arrival/completion, slot allocation, diagnostic freshness and restoration record |
| Current state | Services owned; open case; contact choice; pending action; unresolved promise | Incident scope and status; known service impact; support capacity; assigned work; tool health |
| Retained learning | Observed connectivity rhythm; earlier attempted fixes; stated preferences; relevant resolved episodes | Typical demand by time; observed incident-to-contact delays; recovery durations; comparable completed service journeys |

Each memory has a scope, subject, type (`observed`, `stated`, `derived`, `policy`), value, explanation, evidence references, derivation version, validity period, last-confirmed time and optional supersession link. Show sample size for derived patterns. Missing evidence and contradictory statements remain explicit. Old memory is expired or superseded, not silently overwritten.

Retain the supplied narrative's six customer lenses with disciplined meanings:

- Identity: verified relationships and service ownership, including what may be shown to whom.
- Behaviour: aggregate service observations and contact history; no browsing-content inference.
- Service: orders, faults, attempts, cases, obligations and unresolved promises.
- Context: supplied timing, availability and situational needs.
- Emotional: the customer's expressed concern in a dated interaction; not a permanent personality or vulnerability score.
- Intentional: an explicit request, a preference, a refusal or an expressed future interest.

Start the UI on **what matters to this decision**, with a full memory view one click away. Let an operator inspect, correct or supersede a derived memory; a correction creates an audit event and triggers a new assessment where relevant. Aggregate operational memory must not expose another household's private conversation through a shared summary or retrieval result.

## 6. Agents, arbiter and execution boundaries

```text
Source event → validated record → state projection
                              → ambient flag
Customer memory + operational memory + policy
                              → arbiter mandate
                              → domain assessment / proposed plan
                              → arbiter reconciliation
                              → execution recheck + committed action
                              → observed outcome + memory revision
```

| Responsibility | Input and output | Must not do |
| --- | --- | --- |
| Ambient watcher | A typed event or defined local pattern → evidence-linked flag with subject, expiry and deduplication key | Choose a recipient, invent wider household context or send a message |
| Arbiter | Flags, existing plans, customer/ops snapshot and policy → bounded domain mandate; then reconcile returned proposals | Treat a high model score as permission, forget an existing promise, or allocate unavailable capacity |
| Activation domain | Provisioning, delivery and first-use evidence → investigate, guide setup or escalate | Assume an order delivery proves activation |
| Service recovery domain | Diagnostics, affected-service membership, previous attempts and owner → next recovery step | Infer a line fault from missing telemetry, repeat known ineffective steps without reason |
| Relationship domain | Resolved service state, stated intent, products and contact eligibility → relevant proposal or hold | Optimise sales while an unresolved recovery obligation blocks it |
| Jev evaluator | Small, explicit questions over a bounded evidence packet → typed assessments | Grant permission, call tools, estimate a calibrated churn probability or supply hidden facts |
| Executor | Authorised proposal + current constraints → receipt, rejection or pending result | Mark an unacknowledged message delivered or an allocated visit completed |
| Outcome projector | Subsequent source events → updated memory and outcome state | Count its own recommendation as evidence it succeeded |

A conversational entry point uses the same domains and pending-action ownership. A customer reply to an existing setup request must not be taken over by a newly arriving ambient flag.

### Arbiter policy: ordered, explainable priorities

First enforce authority, permitted purpose, data validity and tool scope. Then consider verified service need and due obligations, existing case continuity, operational feasibility and contact coordination. Evaluate commercial relevance only after applicable service blocks clear. Within eligible work, sort by due time and evidenced service impact; persist the policy version and each comparison.

Available dispositions: `watch`, `investigate`, `dispatch`, `hold`, `merge`, `suppress`, `human_review`. Every hold has a reason and a wake condition or expiry. An incident update, customer response, slot change, fresh diagnostic or deadline can wake reassessment. No permanent silent queue.

Two proposals may be individually sensible but conflict: send setup instructions versus warn of a confirmed area issue; send an offer versus fulfil a callback; allocate a slot versus retain it for an already accepted appointment. Show the alternatives and the exact policy that resolves the conflict. Do not transplant Sainsbury's arbitrary fire/stack thresholds into BT.

### Jev question design

Use actual [TypeSafe primitives](https://docs.typesafe.ai/primitives): Choice for categories, Score for explicitly described levels and Noul for yes/no evidence judgements. Batch independent questions over the same state. SQL facts such as incident membership, permission and capacity remain deterministic.

| Question | Proposed type and criteria | Consequence |
| --- | --- | --- |
| `setup_help_evidence` | Choice: explicit setup difficulty / unresolved provisioning / insufficient evidence | Inform which activation investigation is useful |
| `request_continuity` | Choice: same unresolved request / distinct new request / unclear | Help attach the interaction to an existing case; structured case IDs take precedence |
| `stated_bundle_interest` | Noul: does the supplied customer statement explicitly request or express interest in combined services? | Inform a later relationship proposal; never substitutes for contact eligibility |

Store the exact input record IDs and snapshot, question text, criteria, prompt version, provider/model, response, timestamps and duration. For Choice/Score show the actual provider distribution and confidence separately. Noul has no separate confidence field. No fabricated distributions in live mode. Display only relevant questions for the active domain.

Model-dependent action proposals require a valid response and corroborating records. Proposed demo thresholds: a Choice needs selected-answer probability ≥0.70; a Noul supports yes at ≥0.70, no at ≤0.30, and is ambiguous between those bounds. These are configurable, explicitly uncalibrated policies; ambiguity selects further investigation or review. A strong “insufficient evidence” answer still means investigate, not permission to act. An unavailable model holds only the model-dependent step: deterministic incident coordination and existing promises continue. The UI displays the failure and never silently swaps to canned “live” output.

## 7. A real, bounded database foundation

Propose a dedicated **BT demonstrator Supabase project in RX** when implementation is authorised. Keep Soho's project and data intact. Use one Postgres database with domain schemas and ordinary foreign keys, not a JSON-only table presented as a complete customer architecture. No Docker is needed.

The following is the minimum relational model for these stories, not a proposed replacement for BT's BSS/OSS estate. Required relationships and selected fields are specified here; SQL migrations should implement them in the build stage.

| Schema | Tables and core relationships | Purpose |
| --- | --- | --- |
| `customer` | `households`; `people`; `household_roles(person_id, household_id, role, valid_from, valid_to)`; `accounts`; `services(account_id, household_id, product_id, status, activated_at)`; `contact_preferences(person_id, purpose, channel, allowed, quiet_hours)` | Establish identity, service ownership and permitted contact. Sharing an address alone never creates authority. |
| `operations` | `products`; `service_groups`; `assets`; `service_dependencies(service_id, asset_id, valid_from, valid_to)`; `orders(service_id, lifecycle_status)`; `diagnostics(service_id, test_type, measured_at, result)`; `incidents`; `incident_services`; `cases(service_id, owner_id, status)`; `promises(case_id, due_at, fulfilled_at)`; `capacity_buckets`; `appointments(case_id, capacity_bucket_id, status)` | Supply actual service context, commitments, affected-service membership and allocatable resources. |
| `ingestion` | `events`; `event_subjects(event_id, subject_kind, subject_id)`; `source_health`; `ingest_rejections` | Preserve incoming evidence, source identity, time, deduplication and malformed-record failures. Known subject references are validated on ingest; canonical domain tables retain typed FKs. |
| `intelligence` | `memories`; `memory_evidence(memory_id, event_id)`; `episodes`; `episode_evidence`; `episode_embeddings`; `assessments`; `assessment_evidence`; `metric_buckets`; `model_versions`; `forecasts`; `forecast_points` | Store derivations, semantic retrieval, actual model responses and reproducible forecasts with provenance. |
| `execution` | `scenario_sessions`; `runs`; `flags`; `tasks`; `decisions`; `policy_versions`; `actions`; `outbox`; `receipts`; `outcomes`; `audit_events` | Connect trigger, mandate, assessment, policy, bounded action and subsequent outcome. Persist retries and rejected actions as well as successes. |

All scenario-owned records carry `scenario_session_id`; seeds have a separate immutable dataset version. Mutable state is isolated per session. Shared historical fixtures are read-only. Composite keys and transaction checks prevent one session linking to or consuming another session's resources.

Canonical operational rows and projections retain their source event references, projection version and update time. Aggregated metric buckets reconcile to the qualifying contact/capacity events; they are not independently generated totals. Historical state is reconstructed from effective events and validity intervals, not today's rows with an earlier timestamp in the heading.

### Event envelope

```json
{
  "id": "evt_demo_00421",
  "scenario_session_id": "session_demo_01",
  "source": "router_management_simulator",
  "source_event_id": "heartbeat-svc-sam-2100",
  "event_type": "router.heartbeat_overdue",
  "schema_version": 1,
  "occurred_at": "2026-09-25T20:00:00Z",
  "received_at": "2026-09-25T20:00:03Z",
  "subject": {"service_id": "svc_sam_broadband"},
  "correlation_id": "journey_sam_activation",
  "causation_id": null,
  "provenance": "synthetic_source",
  "payload": {
    "last_received_at": "2026-09-25T19:55:00Z",
    "expected_interval_seconds": 60,
    "overdue_seconds": 240,
    "line_sync_status": "unknown"
  }
}
```

`received_at` is authoritative ingestion time. Source event IDs are unique within `(scenario_session_id, source)`. Corrections append an event with an explicit superseded record reference. Queries for a past replay moment require **both occurred and received time to be available by that cutoff**. Unknown is a state; zero is a value; neither substitutes for the other.

Minimum event catalogue:

| Family | Example types | Distinctions retained |
| --- | --- | --- |
| Service | `router.heartbeat_received`, `router.heartbeat_overdue`, `diagnostic.completed`, `service.restored_observed` | Telemetry missing versus test failure versus observed restoration |
| Onboarding | `order.delivered`, `activation.requested`, `activation.confirmed`, `setup.help_requested` | Delivered equipment versus provisioned service versus successful setup |
| Care | `contact.received`, `case.updated`, `promise.created`, `promise.fulfilled`, `customer.confirmed_working` | Contact versus resolution; technical state versus customer confirmation |
| Operations | `incident.confirmed`, `incident.scope_changed`, `incident.resolved`, `capacity.changed`, `appointment.accepted`, `appointment.completed` | Incident status versus each affected service; held slot versus completed work |
| Relationship | `interest.stated`, `offer.presented`, `offer.accepted`, `product.activated`, `payment.recorded`, `offer.declined` | Interest, adoption, payment and refusal |
| Runtime | `assessment.completed`, `decision.recorded`, `action.committed`, `delivery.simulated`, `action.failed`, `memory.superseded` | Model execution and database work are real; external business effects are simulated |

### Synthetic corpus with believable journeys

Proposed build scope: **250 fictional households including three hero households, six fictional service groups, 26 weeks of history, and approximately 25,000–75,000 source events**. Additionally keep 15-minute aggregate operational metric buckets, rather than fabricating a full raw heartbeat stream for every service. Exact generated counts are published in a dataset manifest; these are design targets, not existing data.

Generate coherent timelines with stable service/account/order/case IDs. Include completed and incomplete activation, healthy periods, repeated faults, incidents with shared scope, successful and unsuccessful diagnostics, expired promises, declined contact, accepted and cancelled appointments, and mature/unmatured product journeys. Reserve realistic free text for customer statements, case descriptions and resolution episodes. Event descriptions explain what a record proves and what it does not prove.

Use a seeded generator with explicit noise, delayed events, missing telemetry, conflicting notes, duplicate delivery and uneven service-group load. Known synthetic truth is stored separately for evaluation and never enters the decision input or training features. The three presentation households are excluded from model fitting and used as held-out narrative cases. Do not transplant Vasco's supplied profile or private Jio/Sainsbury's customer records into BT fixtures.

## 8. Embeddings, typical behaviour and forecasts

These have different jobs. **Embeddings retrieve relevant text. Statistical models forecast measurable demand. Policy decides what is permissible.** None is a replacement for the others.

### Semantic retrieval

Start with the existing local `Xenova/all-MiniLM-L6-v2` pipeline used by Soho: mean-pooled, normalised, 384-dimensional vectors. Pin the model artifact revision and record its hash in the dataset manifest during implementation. This is a reuse decision for the demonstrator, not a claim that it is the best production BT model.

Embed bounded customer episodes, resolved operational episodes and approved fictional service guidance. Do not embed each heartbeat. Store episode text hash, evidence IDs, model/revision, dimension, generated timestamp and access scope alongside a `vector(384)` value. Supabase provides the underlying [pgvector storage and similarity operations](https://supabase.com/docs/guides/database/extensions/pgvector).

Before ranking, filter by authorised subject/scope, event cutoff, relevant service and validity. A selected household may retrieve its own contact episodes and appropriately aggregated operational precedents, not another customer's identifiable notes. Return the nearest five eligible episodes with cosine similarity and source excerpts. Present similarity as similarity, never “chance of resolution.” If retrieval fails, structured facts still support the case; show the missing semantic context.

The first build uses precomputed document and fixed scenario-query embeddings generated by the real model. Arbitrary semantic search and a live query-embedding service are a later extension, not an unlabelled imitation. An optional atlas uses a reproducible two-dimensional PCA projection, with stable coordinates, and explicitly warns that visual distance is a lossy projection. No softmax transformation should make editorial categories look like discovered probabilities.

### Personal normal versus operational typical

Estimate each service's normal management-gap windows from observations, with days observed, gaps, recoveries and exceptions visible. A stated overnight switch-off preference strengthens interpretation but does not defeat fresh evidence of an incident. Without enough observations, the personal baseline is unknown.

Compare with a cohort matched on service lifecycle, product class, time window and available history. Show the denominator and distribution, not just the overall mean. Cohort fallback can inform an investigation but must not invent a personal habit. Require at least 20 eligible historical episodes for an actionable cohort estimate in the demo; otherwise display “insufficient history.” This minimum is proposed demo policy, not a statistically universal threshold.

### A genuine fitted forecast

Primary target: **support contacts arriving per service group in each of the next four 15-minute buckets**. This connects current incidents and customer promises to support capacity. Start with a same-weekday/time historical baseline; compare a regularised Poisson count model fitted offline from the seeded historical data.

Features available at forecast issue time: calendar hour/day, prior contact counts, known affected-service count, open cases, recent activation volumes and already published scenario schedules. Future incident onset, future resolution time and later customer outcomes are excluded. Synthetic weather/season modifiers belong to later studies unless there is sufficient historical evidence to fit and validate them; a season toggle with a hand-authored multiplier is a scenario assumption, not a trained forecast.

Store training cutoff, training rows, feature definitions, model version and parameters, forecast issue time, horizon and evaluation results. Use chronological rolling-origin evaluation, with the final four weeks held out after model selection. Report MAE and interval coverage alongside the baseline. Use training/validation residuals to construct empirical intervals; never tune them on the final holdout. Reference method: [Forecasting: Principles and Practice — time-series cross-validation](https://otexts.com/fpp3/tscv.html).

If the conditional model does not improve the agreed error measure over the baseline, deploy the baseline and display the comparison honestly. Sparse groups fall back to an explicitly labelled pooled estimate. Performance measures describe synthetic data only; they say nothing yet about accuracy on BT's estate.

Translate arrivals to a **queue projection** using observed service duration and available slots, with abandonment explicitly represented:

```text
next_queue = max(0, current_queue + forecast_arrivals - completions - abandonments)
```

Label the result as a capacity scenario, with its duration and staffing assumptions. Display observed contacts, current queue and forecast separately. Never add queued jobs and new arrivals twice or count both a household and each of its products as separate contacts without corresponding records.

## 9. Working runtime and honest execution

Use the familiar React/TypeScript presentation, a small channel-independent TypeScript decision module, server-side Gateway access and hosted Postgres. Reuse conceptual and tested primitives from Soho rather than importing the entire Jio stack. A fixed small registry of three domains is enough. No general agent framework, graph database, Redis, message broker or local containers are required for this demonstrator.

On ingest, a transaction persists the event and a durable pending job. A server runner claims the job with a lease, assembles the as-of snapshot, performs necessary model calls, reconciles proposals and commits a receipt. It runs independently of panel visibility. Failed/expired jobs are recovered by an authenticated scheduled runner; a browser polling timer is not the worker. On localhost this can be a single Node worker process alongside the dev server. A future hosted deployment needs an explicitly configured scheduler or durable worker before claiming unattended operation.

Proposed endpoint contracts:

| Endpoint | Contract |
| --- | --- |
| `POST /api/scenarios` | Create an isolated session from a pinned seed version; return session ID and initial clock |
| `POST /api/events` | Authenticated presenter or simulated adapter submits one schema-validated event with idempotency key; return event/job IDs |
| `GET /api/snapshot` | Authorised session/case/run projection at a specified cutoff; no mutation or model call |
| `POST /api/customer-response` | Validate actor, pending action, response and current state; append the response event |
| `POST /api/jobs/process` | Worker-only bounded claim/process operation; lease and retry rules apply |

Reset creates a new session; it does not delete shared history. Rewind is a read-only historical view. An interactive “what if” forks at the selected cutoff into a new session before accepting events, so later records cannot leak into an earlier decision.

Gateway credentials stay on the server under RX, following the existing Soho pattern. Provider authentication status is checked at runtime; a locally cached token is not assumed valid. Existing Soho code uses the [Vercel TypeSafe endpoint](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe) for `typesafe-ai/jev`; verify the supported API contract again during implementation. This specification made no model calls or credential changes.

### Action transaction and feedback

Before committing, recheck current permission, contact suppression, case status, incident version, pending promise, resource availability and mandate expiry. Use an optimistic version guard or row locks as appropriate. Enforce unique logical actions and slot ownership with database constraints. A changed prerequisite produces a rejected receipt and wakes replanning; it must not be silently ignored.

Commit decision, resource hold and outbox entry atomically. A sender then produces a **simulated delivery receipt** for the prototype phone. Delivery, read, response, restoration, customer confirmation and completed promise are separate states with separate events. Crash recovery retries the same action ID rather than creating another appointment or message. A customer-facing action always retains its case, owner, next step and promise time.

Memory write-back after an action records only what happened: “setup help offered” or “callback slot held.” Later observations may establish activation or resolution. Outcome aggregates wait until their observation window matures; an unanswered offer is pending until its window closes. Outcome learning revises summaries and model datasets. It does not autonomously change production policy or retrain a model during a demo animation.

### Truth labels

| Label | Exact meaning |
| --- | --- |
| Synthetic source | Fictional source record generated for this scenario |
| Live model | Provider request completed during this run; actual response stored |
| Recorded model replay | A previously captured model response replayed with its original run ID and time |
| Rule-derived | Deterministic code or database aggregation; no model inference |
| Fitted on synthetic history | Real estimation and backtesting, using fictional training records |
| Demo action | A database-backed action and simulated external result; no SMS, call, network change, charge or engineer dispatch occurred |

Recorded mode is valuable for presenting reliably. Switching to it is explicit; its outcome sequence is reproducible and it cannot masquerade as a new live provider call. The inspector shows provenance per element, while a concise session status keeps the main screen clean.

## 10. Commercial evidence and the leadership story

Lead with observed customer and operational outcomes, then show commercial interpretation with its assumptions. Preserve the value of “no unnecessary contact” without automatically counting every suppressed message as a saved inbound call.

| Measure | How to compute it | What it does not prove |
| --- | --- | --- |
| Activation completion | Confirmed activations / eligible delivered orders, by elapsed window | That the AI caused completion |
| Promise fulfilment | Promises fulfilled by due time / promises whose due time has passed | Customer satisfaction or all-case resolution |
| Confirmed recovery | Cases with required technical observations and applicable customer confirmation / cases with a matured observation window | That a message alone repaired the service |
| Repeated customer effort | Repeat contacts and repeated troubleshooting requests per case | Every repeat contact was avoidable |
| Capacity use | Committed slots / available slots, with missed promises and queue delay alongside | Maximum utilisation is the best experience |
| Relevant product adoption | Accepted offers, activated products and paid events, reported separately | Incremental sales, retention or customer lifetime value |
| Contact coordination | Duplicate candidates merged; contacts held for a stated reason; actual sends | Causal call deflection or cost reduction |

An optional economics drawer applies explicit, editable demo unit costs to observed scenario events. Display gross costs, benefits and uncertainty separately. Headline savings, churn reduction and uplift require a real baseline/control design; synthetic paired simulations can demonstrate the measurement method but are labelled simulated comparisons.

The six-minute leadership narrative ends with a concrete operating question: **which customer moment should BT validate first, against which source systems and outcome?** Accenture's role is demonstrated by connecting the moment, data, decision, execution and measurement, rather than a slide listing disciplines.

## 11. BT expression, accessibility and tone

Apply the [brand audit](../../references/2026-09-25-bt-brand-audit.md): observed BT indigo **#5514B4**, BT Curve identity where available, white surfaces, direct language and the unchanged circular mark. Our proposed tokens supply restrained neutral surfaces and explicit semantic states. The audit separates observed values from our choices and records the unavailable internal manual.

Customer copy is specific and accountable. Example, only when the incident and scheduled update support it: “There's a network issue affecting your broadband. You don't need to restart your hub. We'll update this case by 21:15.” Daniel's open promise remains attached to his existing owner. If no ETA exists, do not invent one; distinguish a promised update time from a restoration estimate.

For Maya the customer phone remains quiet. The explanation “No message needed yet” belongs to the presenter view, with watch expiry and evidence available. For uncertain activation, say what is being checked before proposing setup instructions. No numeric model confidence appears in customer copy.

Maintain readable technical labels, keyboard navigation, native disclosure controls, accessible chart descriptions, visible focus, reduced motion and a 390px mobile layout. A chart always has a tabular evidence alternative. During playback announce meaningful state changes without reading every telemetry record into a screen reader. Pause is always reachable.

## 12. Access and failure behaviour

Authenticated presenter access owns a scenario session. Phone interaction is a scoped simulation actor, not a public unauthenticated API. Server routes authorise the session and subject on every read and mutation; service-role keys never reach the browser. Private schemas, restricted RPC grants and RLS form part of the database setup. Privileged server access does not remove the need for explicit application-level scope checks.

Authoritative contact permissions, actor authority and policy checks stay outside model prompts. Treat retrieved text and customer notes as data, never tool instructions. Restrict model output to validated question answers or bounded proposals. Display concise evidence-based rationale and rule results, not a fabricated private chain of thought.

| Condition | Required behaviour |
| --- | --- |
| Missing or stale diagnostics | Mark unknown/stale; request a permitted fresh observation or review; do not label the service healthy |
| Conflicting memories | Show the conflict and effective timestamps; prevent unsupported automatic action |
| Duplicate/late event | Deduplicate or append correctly; preserve both time fields; never retroactively claim the event was known earlier |
| Provider timeout/malformed answer | Record failure; hold model-dependent work; retain deterministic duties and permit an idempotent retry |
| Database unavailable | Show disconnected state with last successful observation time; disable committing actions |
| Source collector failure | Show loss of observability; do not turn every missing heartbeat into a customer fault |
| Action fails after a hold | Release/expire the reservation through a recorded transition; preserve failure and retry ownership |
| Customer replies during an ambient run | Preserve the response owner and pending action; reconcile new proposals before sending |
| New incident contradicts a queued plan | Supersede uncommitted work; record the previous decision and reason for revision |
| No support capacity | Keep a named owner and feasible next step; no imaginary booking or promised completion time |

The prototype exposes neither genuine customer identifiers nor live BT controls. Cross-brand identity resolution, sensitive support needs, money movement, router configuration and external notifications require their own validated data and action contracts before any production pilot. They are outside this first build.

## 13. Build slices and completion criteria

These slices define scope and dependency order, not an implementation schedule or a claim that the work already exists.

| Slice | Deliverable | Complete when |
| --- | --- | --- |
| **1 · One credible loop** | BT shell, three households, structured source records, hosted session state, ambient/arbiter/domain separation, actual Jev assessment, bounded phone action, evidence and write-back | One event traverses the full path without manual agent buttons; holds and failures are visible; all three initial responses are supported by their records |
| **2 · Context changes the answer** | Area incident, shared operational memory, resource competition, plan revisions, continuity and outcome events | Incident membership changes only affected cases; an execution race cannot double-book capacity; previous promises survive |
| **3 · History becomes useful** | Linked synthetic corpus, real episode embeddings, personal/cohort memory, fitted contact forecast and backtest | Retrieval obeys scope and cutoff; forecasts have reproducible evaluation; memory corrections propagate |
| **4 · Relationship growth and polish** | Later-date commercial chapter, mature outcome cohort, optional economics, presentation replay and visual QA | Service gates hold inappropriate offers; offer/activation/payment stay separate; the six-minute flow and technical inspection both work |

The system should be shown as a complete working demonstrator only after all four slices pass. The atlas, voice integration, arbitrary semantic chat, large agent registries, real BT adapters, multi-brand pooling and production deployment are subsequent options. Avoid building them to make the first story appear larger.

### Acceptance scenarios

1. **Signal semantics:** overdue heartbeat alone produces an uncertainty-aware path; zero traffic and failed line test remain different facts.
2. **Personal context:** identical event classes yield Maya's watch, Sam's activation investigation and Daniel's continuing recovery, with exact source evidence visible.
3. **Operational context:** adding/removing confirmed incident membership creates a decision revision only for affected services.
4. **Authority and contact:** another household's records cannot be accessed through IDs, retrieval or aggregate drill-down; prohibited channels remain blocked even with a strong model answer.
5. **Promises:** a new ambient signal cannot erase a named owner, accepted appointment or due callback.
6. **Temporal integrity:** events received after a cutoff do not influence a past snapshot; rewind cannot create an action in the existing future session.
7. **Concurrency:** duplicate events, repeated button presses, two workers and a lease-expired worker yield one valid logical action; rejected writes have inspectable receipts.
8. **Execution race:** a newly occupied slot causes an explicit replan; capacity never drops below zero.
9. **Model honesty:** live distributions equal stored provider responses; unknown evidence remains unknown; recorded playback is labelled; no confidence is relabelled as purchase or churn probability.
10. **Outcome integrity:** delivery does not close a fault, technical recovery does not fabricate customer confirmation, and a product acceptance does not become a payment.
11. **Learning integrity:** a corrected memory is superseded with provenance; a retained episode and a fitted model can each be reproduced from their recorded inputs.
12. **Forecast integrity:** training excludes hero households and future knowledge; held-out evaluation includes the baseline and uncertainty coverage; observed series and scenario assumptions remain distinguishable.
13. **Interface continuity:** selection, phone screen, pending reply and run survive panel/view changes; one source signal drives automatic processing independent of the displayed panel.
14. **Presentation quality:** test 1512×900, 1440×900, 1024×768 and 390×844, keyboard-only flow and reduced motion; no clipped controls, unreadable legends, overlapping logo or hidden primary next step.
15. **Operational failure:** loss of DB, Gateway or telemetry produces the specified degraded state, without a false success receipt or an indefinite spinner.

Validation in the build phase should combine deterministic unit checks for policy/projections, SQL transaction tests for isolation and execution, captured provider-contract fixtures, retrieval and forecast evaluation, and browser journeys. No app tests were run for this documentation-only specification.

## 14. Evidence gaps and decisions still belonging to BT

The supplied “BT Consumer: Proposal Narrative” is the narrative input. Its numerical research claims, descriptions of current BT telemetry and legal interpretations are **not verified implementation requirements**.

| Topic | Working assumption for this demo | Validation needed for a BT pilot |
| --- | --- | --- |
| Router and line signals | Synthetic, separately typed management heartbeat and diagnostic events | Actual semantics, coverage, latency, failure modes and permitted use |
| Customer/household identity | Fictional verified account roles within BT | Current identity model, delegated authority and cross-brand boundaries |
| Existing decisioning | No assertion that BT lacks next-best-action, proactive care or shared memory | Inventory current capabilities and identify one gap to extend |
| Operational integration | Synthetic incidents, cases, promises, capacity and appointments | Source systems, field definitions, APIs, owners and action guarantees |
| Commercial policy | Explicit fictional product and contact rules | Approved eligibility, propositions, cost basis, permissions and measurement design |
| Brand | Public BT styling observed in September 2026 | Current Brand Central package, approved font files, asset usage and co-branding guidance |
| Business evidence | Scenario event counts and transparent demo assumptions | Source documents for research percentages; BT baselines and a credible experiment |
| Regulatory assertions in supplied prose | Not reproduced as legal conclusions | Appropriate legal review of applicability and the exact obligations claimed |

Do not put the draft's 5–10pp EBITDA, 30–50% cost-to-serve or 3–5pp churn ranges on a demo outcome card. Do not repeat the broad Article 50 statement as a universal explainability rule. Those claims are outside what this prototype can establish. Equally, frame experience as how BT delivers the value of its network investment; do not assert that network quality has ceased to matter.

## 15. Source and reuse map

### Local sources inspected

- [Mark’s pitch: BT Consumer Proposal Narrative](../../source/marks-bt-consumer-pitch.txt), supplied in the 25 September session; preserved verbatim as narrative input with unverified claims. The user identified this pitch as Mark’s; no further authorship metadata was supplied.
- Sibling repository `../SohoHouse`, revision `b68b42d`: `docs/design/2026-09-21-visual-hierarchy.md` (including the early Jio reference), `docs/design/2026-09-21-member-phone.md`, and `docs/design/2026-09-21-operating-intelligence-lab.md`.
- Same Soho revision: `README.md` for runtime constraints, `app/api/memory.ts` for the live endpoint pattern, and `app/scripts/embed-axis-lab.mjs` for the embedding pipeline. Source code stays in Soho; no secrets or application runtime were copied.
- Sainsbury's local repository: `README.md`, `AGENTS.md`, `lib/brain/arbiter.ts`, `lib/brain/storeContext.ts`, `lib/brain/storeForecast.ts`, and the recent change inventory for `components/StoreMemoryPanel.tsx`, `RawSignalsFeed.tsx`, `DetectionEvidence.tsx` and manager views. Upstream reference supplied by the user: [vasegu/sainsburys-demo](https://github.com/vasegu/sainsburys-demo).
- Jio local repository `ecd_jio_cx`: `README.md` and `AGENTS.md`, documenting channel-independent state, customer memory, pending ownership, ambient events, arbiter plans and durable outcomes. These were inspected as architecture references; this task did not rerun or audit the Jio service.

### Public sources

- [BT current consumer identity page](https://www.bt.com/broadband/why-bt), rendered style inspection on 25 September 2026.
- [BT May 2026 brand launch](https://newsroom.bt.com/bt-to-power-uefa-euro-2028-and-launches-behind-brilliant-things-campaign/) and [September 2026 campaign](https://newsroom.bt.com/bt-strengthens-broadband-leadership-by-putting-online-security-at-the-heart-of-new-campaign/).
- [BT Annual Report 2026](https://www.bt.com/about/annual-reports/2026summary/) for current multi-brand context.
- [BT supplier marks policy, March 2018](https://groupextranet.bt.com/selling2bt/downloads/BT%20MARKS%20BRANDING%20Policy.pdf), used only to locate the formal brand source, not as a current design manual.
- [TypeSafe question primitives](https://docs.typesafe.ai/primitives), [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector), and [rolling-origin forecast evaluation](https://otexts.com/fpp3/tscv.html).

Specification review: checked against the user brief, current local reference implementations and public BT observations. Proposed choices are separated from observed capabilities; data, judgement, policy, action and outcome have distinct contracts. Remaining BT-specific unknowns are listed above rather than filled with invented facts.
