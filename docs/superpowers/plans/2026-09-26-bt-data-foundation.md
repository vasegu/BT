# BT data foundation: gaps, model and simulation plan

> **For agentic workers:** After the user reviews this plan, use `superpowers:executing-plans` to implement it task by task. This document is a plan, not a record of completed database work.

**Goal:** Give Daniel, Sam and Maya coherent, inspectable histories in a dedicated RX Supabase project, then make memory, arbitration, Eve and outcome verification read the same evidence.

**Architecture:** Relational customer and operational records, an append-only source-event ledger, derived memories with evidence links, and separately persisted decisions/actions/outcomes. A deterministic simulator creates connected histories; the existing app keeps running while a hosted implementation is verified against its snapshot contract.

**Tech stack:** Supabase Postgres, SQL migrations, pgvector, the existing TypeScript server and React app, the existing local 384-dimensional MiniLM encoder. Hosted database; no Docker.

**Spec:** [Existing BT design specification](../specs/2026-09-25-bt-consumer-experience-design.md), especially sections 7–9; [Mark's supplied pitch](../../source/marks-bt-consumer-pitch.txt). This plan replaces the initial 250-household corpus proposal with **three households with rich histories first**, as requested on 26 September. Larger population modelling remains later scope.

## The recommendation

Build **three complete relationships**, not three large profile JSON objects. Start with the service/support stories we can already demonstrate and add the records needed to prove them. The first milestone is being able to open a statement such as “the restart failed” or “this is normal overnight behaviour” and inspect the dated observations behind it.

Keep four things distinct:

1. **Records:** what a source observed or a person actually said.
2. **Memory:** an interpretation or summary, with its evidence, validity and derivation.
3. **Decision:** what an agent proposed and what policy permitted at that time.
4. **Outcome:** what was observed afterwards, including unknown or unsuccessful results.

Moving today's JSON blobs into Supabase would improve hosting, but would leave most of the current fidelity gaps intact.

## 1. What exists today, and what is missing

Audit basis: the current BT checkout, including the unfinished review-screen changes. A fresh **rules-only, in-memory replay** contains 10 initial events, 18 events after all five steps, 15 decisions and 6 simulated messages. These are measured fixture counts, not the total contents of the user's local database or a claim about Jev outputs.

| Area | Present implementation | Gap and practical consequence | Proposed change |
|---|---|---|---|
| Persistence | SQLite stores sessions, events, jobs, decisions, assessments, actions, receipts and outcome contracts | Real persistence exists; most domain state is reconstructed from short event payloads rather than typed records | Preserve the working semantics, introduce typed domain tables and a hosted repository |
| Customer identity | Three IDs/names; one service each; `Household` also represents the person | Person, household, account and service are conflated. No explicit relationship supports a second product or authorised household member | Separate these entities and make account authority explicit |
| Contact permission | One seeded service/in-app authority event per person | No channel history, purpose changes, withdrawal or effective period | Effective-dated account roles and contact permissions; unknown stays unknown |
| Daniel's relationship | Case opened, failed restart, callback promise | No original chat, agent handover, diagnostic measurement or older resolved episode to inspect | Persist conversations, messages, diagnostic attempts, case ownership and named promises |
| Sam's onboarding | One delivery event | Order accepted, dispatch, provisioning, activation and first successful use are absent | Model the order journey and independent provisioning/first-use observations |
| Maya's routine | Stated preference plus one authored “26 recoveries” summary | The 26 underlying episodes do not exist. The displayed personal baseline cannot be recalculated | Generate actual observation windows, then derive a dated pattern with numerator, denominator and exceptions |
| Operational context | One incident payload naming affected people; two callback slots in JSON | No asset dependency, changing incident scope, typed reservation or operational history | Service-to-asset dependencies, incident-to-service membership and reservable capacity |
| Customer memory/atlas | Real local embeddings over independently authored example episodes; current facts use session records | The attractive retrieval corpus is not the household's actual history and does not currently drive arbitration | Build episode text from the seeded histories; record the exact retrieved context admitted to each run |
| Ambient agents and arbiter | Jev evaluates frozen facts and bounded proposals; policy gates and durable attempts are real | Proposal production is mainly one arbiter function, not independently persisted ambient observations | Store narrowly scoped flags separately from the arbiter's broader context snapshot and decision |
| Action expression | Authored messages vary with known context; the review work adds tone/commitment annotations | Tone is an authored brief, not an independently evaluated output. Action ID alone misses wording differences | Persist intended modifiers, rendered wording, template/model version and the input that produced them |
| Outcomes | Separate contracts/checks already distinguish restoration, callback and customer confirmation | Current success path is short; longitudinal recurrence and repeated contact are limited | Add due windows, contradictory observations, late fulfilment, reopened cases and unresolved endings |
| Eve | Live chat/voice reads the server snapshot; conversation retained in browser session storage | Eve exchanges do not become durable relationship history | Store bounded conversation turns with channel, speaker, time and consent/retention metadata; statements do not silently change account facts |
| Evaluation | Real bounded Jev perturbation suite; post-run review work is in progress | Very few unique contexts; invented cluster names or more decorative points cannot solve that | Add genuine scenario variants and completed run records; keep action choice, expression and post-run Hodoscope separate |
| Commercial evidence | Outcome obligations exist; no validated uplift or learned policy | Three households cannot establish churn reduction, causal savings, conversion propensity or a stable population forecast | Measure observable scenario outcomes; keep unit-cost assumptions explicit and statistical claims out of this milestone |

Code evidence: `app/server/engine.ts` (DDL, seeds, replay and projections), `assessment.ts` (frozen Jev input), `outcomes.ts` (proof obligations), `eve.ts` (read scope), `scripts/build-visual-lab.mjs` (independent synthetic atlas), and the current `behaviour.ts`/`agent-review.ts` work.

## 2. The domain model

Use schema boundaries for different responsibilities, not a table for every screen. The table list below describes the target for this bounded slice; migrations are delivered in the stages below rather than all at once.

| Schema | Records | Important relationships and meaning |
|---|---|---|
| `customer` | `people`, `households`, `household_memberships`, `accounts`, `account_roles`, `services`, `contact_permissions` | A person can belong to a household without being entitled to read its account. An account holds services; each service has a product, lifecycle and household. Account roles establish authority; permissions are channel/purpose specific |
| `operations` | `products`, `assets`, `service_dependencies`, `orders`, `incidents`, `incident_services`, `cases`, `diagnostics`, `conversations`, `messages`, `promises`, `capacity_slots`, `appointments` | Case → service; diagnostic → service/case; message → conversation; promise → case and owning adviser reference; appointment → one reserved slot. Incident scope is explicit service membership, not an address match |
| `ingestion` | `sources`, `events` | An immutable observation envelope with a source event ID, subject references, provenance and timestamps. Known customer/service/case references have typed FKs; JSON carries source-specific detail, not the whole domain model |
| `memory` | `items`, `evidence`, `embeddings` | An item is a sourced claim, pattern or episode. Evidence links to immutable events. Embeddings belong to a specific item version/content hash/model version; they are not the memory's truth |
| `runtime` | `datasets`, `sessions`, `jobs`, `flags`, `assessments`, `decisions`, `actions`, `receipts`, `expectations`, `outcome_observations` | Dataset version → isolated replay session. Signal → ambient flag → frozen assessment → governed decision → action. Expectations can exist for silence as well as contact; later observations resolve them |

Use UUID identities plus meaningful source references such as `DR-2041`, `ORD-SAM-31` and `INC-017`. Preserve these existing references in the new fixtures. Adviser identity can start as a validated source-system reference on case/promise/slot records; a workforce directory is unnecessary until we simulate workforce management.

**Identity path:** person → account role → account → service → product/asset dependency. Household membership provides relationship context; it does not grant account access.

**Evidence path:** source event → case/diagnostic/conversation → memory item → assessment evidence → decision → action/expectation → subsequent observation.

### Fields that matter more than table count

| Record | Minimum detail |
|---|---|
| Service | Account/household/product IDs, lifecycle state, ordered/provisioned/activated times, source ref, effective period |
| Diagnostic | Service/case, test name, measured result, units where relevant, initiated/completed times, source event. “Restart attempted” and “problem resolved” are separate fields |
| Conversation/message | Channel, participant role/reference, sent/received time, actual text, service/case association and source event. Include a handover summary only when a source records one |
| Promise | Case, named owner reference, kind, due time, fulfilment/cancellation event, effective period. Technical recovery cannot fulfil a callback |
| Incident scope | Incident/service pair, status of membership, effective period, source event; versioned changes retain the old state |
| Event | Session, source/source-event ID, event type/schema version, occurred time, known-at time, physical ingestion time, typed subjects, correlation/causation/supersedes references, description, payload, provenance |
| Memory | Scope, kind, claim/episode text, epistemic status (`observed`, `stated`, `derived`, `hypothesis`), evidence links, valid period, available-from time, derivation version and content hash |
| Assessment/decision | Trigger, customer/service scope, exact context manifest/text/hash, retrieval results, prompt/model/policy versions, proposed alternatives, checks, probabilities when available and permitted plan |
| Action | Decision, target, purpose/channel, intended tone/timing/commitments, exact rendered message or tool arguments, logical deduplication key, execution status and provenance |
| Expectation/observation | Explicit target and due window, baseline, required evidence, observed value/status, observation time and attribution limitation |

Do not put guessed emotions, “gamer” identity or an inferred willingness to buy into permanent customer facts. Keep the original statement, its date and its scope. An interpretation can be stored as a revisable hypothesis; it cannot grant permission or override an active fault.

### Time and replay integrity

Synthetic history is loaded today but describes earlier observations. Separate:

- `occurred_at`: when the source says the event happened.
- `known_at`: when BT would have received it in the simulated world.
- `ingested_at`: the actual server import time, assigned by the database.

Historical context requires both `occurred_at <= cutoff` and `known_at <= cutoff`. `ingested_at` audits the import and must not make a backfilled history disappear from a replay. A live adapter sets `known_at` from trusted server receipt time; only the controlled simulator can supply a historical value. Replay revision orders committed batches but never overrides the timestamp rules.

Corrections append a new event and a supersedes link; they never rewrite what an earlier run knew. Current domain rows are projections, not the source for reconstructing historical decisions. Each memory exposes the newest `known_at` among its evidence and its own availability time. A retrospective summary containing later facts cannot be retrieved into an earlier run.

### Isolation and access

Every mutable scenario record carries `scenario_session_id`. Use composite foreign keys `(scenario_session_id, id)` on scoped relationships so a decision cannot point at another session's case, action, memory or reservation. Dataset versions and product definitions may be shared read-only; do not share mutable customer state.

Provision a dedicated **BT** project in RX, London, when implementing. Soho's database remains separate. The project list was readable during this audit; the BT checkout is not linked to a Supabase project. No BT project or migration has been created by this planning task.

Keep schemas private initially, revoke client-role grants and enable RLS. The existing server remains the access boundary while presenter authentication/session ownership is added; a privileged database key is not customer authorisation. Before exposing browser data APIs, test the grants and the ownership policies together. Use migrations and a bounded server database role rather than public arbitrary-SQL RPCs. See [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas).

## 3. The three histories to simulate

The following are proposed fictional fixtures, not newly discovered customer facts. Retain the existing 25 September presentation sequence and its identifiers.

| Household | History to generate | What the system should learn | What tests that learning |
|---|---|---|---|
| **Daniel — continuity during a fault** | Up to 26 weeks of service observations, a previous resolved case, the current reported drops, an actual support chat, two dated diagnostic attempts where justified, Aisha's ownership and callback, incident scope, restoration, callback and his later confirmation | What has already been tried; what remains unresolved; who owns the case; which promise survives restoration | A second agent suggests restart; restoration arrives before callback; callback is late/cancelled; confirmation is missing; a fresh fault reopens the case |
| **Sam — delivery is not first use** | Order journey from purchase to dispatch/delivery, provisioning updates, welcome contact, setup attempt or lack of one, first-use telemetry only if observed, and incident membership | Identify the missing stage without assuming the hub is activated, the customer is at fault or the service has ever worked | Delayed activation update; equipment delivered to schedule but provisioning pending; portal says “complete” while diagnostics disagree; duplicate delivery event; successful activation but no successful customer use |
| **Maya — learn a routine, remain interruptible** | Up to 26 weeks of dated observation windows, a quoted overnight preference, genuinely quiet nights, exceptional gaps and recoveries, changes to contact preference, an explicitly unrelated incident | Estimate normal behaviour with a visible sample/window and respect preferred contact | A daytime failure, a new complaint, fresh incident membership or a changed routine must beat the historic pattern; two missing observation windows remain unknown |

For Maya, the current “26 recoveries” becomes a reproducible query, for example **26 observed returns among 28 recent overnight windows**, with the other two explicitly incomplete. It is not a desired ratio a model must learn. The existing 21:10 heartbeat is an observed early return; an overnight pattern must not be presented as evidence that return was predicted for 21:10.

Add one explicitly linked secondary product after the broadband histories work, to demonstrate Mark's “one relationship” point. Include a non-authorised household member as an access test. Neither a shared address nor a similar surname merges accounts or brands. New product/brand relationships remain synthetic and explicit.

## 4. How to generate believable data

### Generate a world, then the observations

1. **Write short household story bibles.** Stable identities, service start dates, products, authority, contact preferences and the few deliberate plot points. Separate stated preferences from hidden simulator conditions.
2. **Generate a deterministic timeline.** Seed a small TypeScript PRNG. Give order, case, promise, incident and appointment state transitions valid predecessors. Model routine service periods as well as exceptional incidents; do not generate a support interaction every day.
3. **Emit source-specific observations.** CRM emits a case note; diagnostics emits a measured result; the router emits an observation window; order management emits a lifecycle change. A latent fault is not an observed fact until a source reports it.
4. **Apply adapter delays and failures.** Versioned, seeded profiles control late receipt, missing observations, duplicate delivery and corrections. A duplicate retains the source event ID. A correction gets a new ID and references the superseded observation.
5. **Write constrained descriptions.** Use authored templates for names, references, measurements and timelines. Optionally generate bounded chat wording afterwards, validate it against the event skeleton and record text-generation provenance. Never ask an LLM to invent the authoritative timeline or outcome labels.
6. **Derive memory from available evidence.** Build episodes and measured patterns after records exist. Every assertion links back to its source. Rebuild after corrections; retain the earlier version used by earlier decisions.
7. **Run the agents against a cutoff.** Store the actual admitted context and actual outputs. If a model is not called, label the run as rules-derived. Viewing/replaying a saved assessment does not call the model again.
8. **Emit follow-up observations independently.** The simulator's service conditions and explicit user responses determine the observed outcome. Choosing an action must not automatically generate its “success.” A message never causes a line restoration unless the simulated intervention actually models that mechanism.

### Corpus size and variation

- First release: exactly three focal households. Up to 26 weeks for established services; Sam's broadband history starts at his actual synthetic order date.
- Target roughly **2,000–6,000 source observations**, mostly compact interval summaries and state transitions, plus a small number of carefully authored contact episodes. This is a planning budget, not a claim about generated counts; publish actual counts by source/type/household in the manifest.
- Observation summaries retain interval start/end, expected/received counts and coverage. Do not invent millions of individual heartbeats. An unobserved interval is not healthy traffic or zero usage.
- Keep one canonical narrative fixture and eight isolated variants: late diagnostic, duplicate delivery, corrected scope, revoked contact permission, slot conflict, unmet promise, misleading self-description and failure after apparent recovery.
- Dataset manifest: seed, generator version/commit, scenario date/timezone, enabled faults, entity/event counts, coverage periods and canonical hash. Determinism concerns the business dataset; physical import timestamps are excluded from that hash.
- Stable source IDs derive from dataset version + entity + event identity. Session isolation allows the same fixture to be replayed without mutating other runs.
- Hidden simulator truth and expected test outcomes live in evaluation fixtures that are never admitted to model context. These are explicit synthetic test oracles, not inferred ground truth about real customers.

### Example: one event should support a narrow claim

| Source record | What it establishes | What it does not establish |
|---|---|---|
| Router delivery at 12:00 | Equipment reached the recorded delivery stage | Provisioning, activation, correct setup or working Wi-Fi |
| Restart completed; drops continued | A particular restart attempt did not resolve the reported symptoms | Every future diagnostic is useless |
| Line test passed at 21:12 | The test observed technical recovery then | Aisha called, the customer is satisfied or the case should close |
| Callback receipt at 21:15 | The promised contact occurred, if linked to that promise | Fault resolution or successful first use |
| Customer says “I’m a gamer” | A dated self-description | An outage, permission to upsell, eligibility, budget or a verified need |

## 5. Memory and embeddings after the records

**Customer memory:** bounded support episodes, explicit preferences, unresolved obligations and measured patterns. For “restart failed”, open the diagnostic and associated conversation. For “normal overnight”, show the window, count, last recalculation and exceptions.

**Operational memory:** effective incident scope, dependency changes, recent diagnostic observations, available capacity and de-identified resolved operational episodes. Keep another customer's identifiable conversation out of shared operational retrieval. Current operational state is a typed projection; a similarity search never establishes whether a service is in an incident.

Embed episode-sized text, not every heartbeat, status row or customer ID. Store the exact text/hash, source evidence, model artifact revision/hash, 384-dimensional vector and available-from time. Separate customer-context embeddings from response-behaviour embeddings: they answer different questions. An embedding refresh is a new version, not a silent overwrite of the context used by a recorded run.

Retrieval first applies session, authority, service/purpose, validity and cutoff filters; only then does it rank eligible episodes by cosine similarity. Store admitted and rejected retrieval IDs/reasons with the assessment. Use the existing real local encoder; package its dependency/cache explicitly so the BT repository no longer relies on an undocumented sibling checkout.

Preserve the action fan for possible plans, then expose modifiers within the chosen action. Hodoscope stays post-run: input/context, action, actual wording and provenance. Meaningful labels are recorded agent/domain, action family, contact behaviour and prompt/policy version. Projection coordinates are geometric coordinates, not invented customer-value axes. Extra plotted points must come from real recorded replays, not visual padding.

## 6. What each screen earns from this work

| Screen | Evidence-backed story | Drill-down proof |
|---|---|---|
| Customer memory | “Here is what we know, what they said and what we inferred.” | Timeline → source conversation/diagnostic; measured personal pattern; retrieved episode/evidence |
| Operational memory | “Here is what the network and support operation can establish or do now.” | Service/asset dependency, incident membership/version, freshness and slot reservation |
| Arbiter | “A single flag met this wider context; these options survived or failed.” | Frozen input, ambient flag, retrieved context, proposal constraints, model preference, permitted action and pre-commit checks |
| Phone/Eve | “BT remembers what happened and communicates accordingly.” | Same scoped snapshot, channel history and explicit promise; saved conversation without silent account mutation |
| Actions & outcomes | “We did this, expected that and later observed this.” | Receipt separate from restoration, callback, first use and customer confirmation; unmet/unknown outcomes remain visible |
| Agent review | “Did the available context influence action or expression in an unexpected way?” | Completed input/output pairs, meaningful grouping, full trace and human review notes; controlled perturbations are a separate check |

## 7. Value case: what this slice can honestly prove

| Mark's pitch | Observable measure in these stories | Limit |
|---|---|---|
| First seven days | Order-to-activation and activation-to-observed-first-use time; unverified stages | A message delivered is not onboarding success |
| Silent router | Validated routine windows, bounded watches, contrary evidence detected, unnecessary repeat messages suppressed | “No contact sent” is observable; “a support call was prevented” needs a counterfactual |
| Remember the relationship | Prior diagnostics reused; promised contact kept or late; repeated questions/advice recorded | Perceived trust needs customer evidence; no invented satisfaction score |
| One household, several products | Correct service/account linkage and permission boundaries during a conversation | No claim about real cross-brand integration at BT |
| Safe action and learning | Actions within authority, duplicate suppression, failed preconditions, expectations verified or left unresolved | No causal uplift, autonomous bandit training or production reliability claim |

For commercial expansion later, add explicit product interest → permitted offer → acceptance → activation → observed usage/payment, including decline and lapse. Self-description alone never stands in for adoption. Unit-cost examples can illustrate economics with editable assumptions; they do not turn three synthetic cases into a forecast.

Forecasting is deferred until there is an appropriately labelled operational time series or a larger separate cohort. The immediate delivery shows personal baselines and current capacity. If synthetic operation-wide demand is added later, it must not be represented as learned from these three households.

## 8. Implementation sequence and acceptance gates

### Task 1 — Lock the three stories and the data contract

**Create:** `fixtures/bt-households/v1/stories.json`, `app/server/data-model.ts`, `app/tests/data-model.test.ts`.

**Interface:** `validateFixture(fixture: HouseholdFixture): ValidationIssue[]`; `HouseholdFixture` defines typed identities, relationships, source events and scenario branches. It carries `datasetVersion`, `seed`, `scenarioStart` and `timeZone: 'Europe/London'`.

- [ ] Pin the existing identities/references and September presentation sequence; author the prior histories and eight variants.
- [ ] Write failing assertions for activation before order, fulfilment without a promise, unknown service references, forbidden account linkage and an asserted pattern without source observations.
- [ ] Implement validation of entity relationships, state transitions and timestamp constraints; keep unknown states explicit.
- [ ] Run `node --test app/tests/data-model.test.ts`; all invalid fixtures must be rejected with a specific record/reference, and the three valid histories must pass.
- [ ] Commit this fixture contract. Gate: we can read each story in chronological order before designing richer graphics around it.

### Task 2 — Apply the relational foundation to a dedicated hosted project

**Create:** `supabase/config.toml`, `supabase/migrations/202609260001_domain_foundation.sql`, `supabase/tests/data_foundation.sql`, `scripts/check-hosted-schema.mjs`.

**Interface:** Typed customer/operations/ingestion relations above, `runtime.datasets` and `runtime.sessions`; all mutable links enforce session scope. Raw event deduplication is unique on `(scenario_session_id, source_id, source_event_id)`.

- [ ] Write rollback-only SQL checks for FK scope, role grants/RLS, duplicate source keys, invalid validity periods and competing reservations for one slot.
- [ ] Provision/link `bt-experience-intelligence` in RX/London, after checking for an existing dedicated BT project. Store credentials only in ignored server configuration.
- [ ] Apply the migration in a transaction with a version/checksum record. Use typed columns/constraints for domain facts; JSON only for source-specific payloads and model artefacts.
- [ ] Run `node scripts/check-hosted-schema.mjs` against that project. Anonymous/customer-role access must be denied until intentional policies are installed; expected cross-session inserts must fail and valid scoped joins pass.
- [ ] Commit migration and checks. Gate: browse the genuine relational rows in Supabase; the existing app still uses SQLite.

### Task 3 — Generate and import reproducible histories

**Create:** `scripts/generate-bt-history.ts`, `scripts/import-bt-history.ts`, `app/tests/synthetic-history.test.ts`, generated manifest under `fixtures/bt-households/v1/`.

**Interface:** `generateHistory({seed, datasetVersion}): HouseholdFixture`; `importHistory(fixture, targetSessionId)` returns inserted/duplicate/rejected counts and a content hash. A repeat import must not duplicate observations.

- [ ] Test determinism, valid lifecycle order, duplicate delivery, delayed knowledge, corrections, missing observation windows and Sam's lack of pre-order broadband history.
- [ ] Generate timelines from state transitions; add constrained wording and source delays afterwards. Keep runtime/model inputs separate from hidden evaluation truth.
- [ ] Import the three histories; publish counts and coverage. Quarantine invalid records with reasons rather than silently “fixing” their facts.
- [ ] Run `node --test app/tests/synthetic-history.test.ts` and import twice; second import must preserve the same business rows/hash.
- [ ] Commit generator/manifest. Gate: calculate Maya's pattern from records and trace Daniel's promise and Sam's order through real joins.

### Task 4 — Derive scoped memory and a common context builder

**Create:** `supabase/migrations/202609260002_memory.sql`, `app/server/memory.ts`, `app/server/context.ts`, `app/tests/memory-context.test.ts`.

**Interfaces:** `deriveMemories({sessionId, cutoff}): MemoryItem[]`; `buildContext({sessionId, personId, serviceId, cutoff, purpose}): ContextBundle`. `ContextBundle` includes canonical facts, unresolved obligations, operational scope, eligible retrieved episodes and their evidence/content hashes.

- [ ] Test cutoff leakage, changed permissions, superseded evidence, identical text with different access scopes and retrieval when there is insufficient pattern history.
- [ ] Build evidence-backed episodes/patterns, persist versioned embeddings and preserve the exact filtered retrieval manifest.
- [ ] Validate local encoder installation/artifact hashes independently of the Soho checkout. Report unavailable embeddings explicitly; structured facts remain usable.
- [ ] Run `node --test app/tests/memory-context.test.ts`; future, cross-session and unauthorised memories must never enter a context bundle.
- [ ] Commit the memory layer. Gate: every returned claim has evidence and a stated epistemic status.

### Task 5 — Move the existing runtime through a hosted vertical slice

**Create:** `app/server/repository.ts`, `app/server/postgres-repository.ts`, `supabase/migrations/202609260003_runtime.sql`, `app/tests/repository-contract.test.ts`. **Modify:** `engine.ts`, `server.ts`, `assessment.ts`, `eve.ts`.

**Interface:** Extract only the methods the engine uses: session creation, scoped historical snapshot, idempotent event append/job enqueue, leased job claim and atomic decision/action/expectation commit. Keep the existing `Snapshot` response during migration; `BT_STORAGE=sqlite|supabase` selects one store per server process. No dual writes.

- [ ] Capture repository contract tests from the current successful replay and its failure tests before switching storage.
- [ ] Implement Postgres transactions, optimistic revision checks, worker leases and unique action/reservation constraints. Provider calls stay outside transactions; recorded attempts survive retry without automatic rebilling.
- [ ] Integrate the common context builder with both Jev and Eve. Persist authorised conversation turns; extracted statements remain statements until an explicit domain transition accepts them.
- [ ] Run the same replay against both stores; compare facts, evidence scope, eligibility, obligations and deduplication, excluding generated IDs/import times. Replay saved model outputs for deterministic parity rather than making paid calls in tests.
- [ ] Commit the adapter and run the existing full app tests/build. Gate: the phone and five panels read one hosted session; restarting the worker preserves promises, jobs, actions and receipts.

### Task 6 — Outcomes, evaluation and presenter validation

**Modify:** `outcomes.ts`, `behaviour.ts`, `agent-review.ts`, the relevant screen read models and README. **Create:** `app/tests/history-scenarios.test.ts` and a dataset review report.

- [ ] Exercise canonical and eight variant histories. Verify lost contact permission, unmet promises, scope corrections and recurrent faults visibly alter permitted actions or outstanding obligations.
- [ ] Persist intended expression and actual outputs separately. Build post-run review only from completed runs; refresh when jobs complete and support rules-only runs without invented model probabilities.
- [ ] Run context-invariance checks using the same frozen context bundle; irrelevant “gamer” wording must not grant permission, bypass support obligations or manufacture an offer. Any live eval batch remains explicitly sized and persisted.
- [ ] Check every displayed metric against source rows. Distinguish observed change, simulated external delivery, hypothesised value and unmeasured commercial impact.
- [ ] Verify the phone, five-panel overview, deep views, historical cutoffs and empty/error states in the browser. Run `npm --prefix app test`, `npm --prefix app run test:lab` and `npm --prefix app run build`.
- [ ] Commit and publish the dataset manifest, verification results and limitations. Gate: Mark can follow one source record through memory, arbitration, action and independent evidence of what happened next.

## Global constraints and review focus

- Three households first; no automatic expansion to the old 250-household proposal.
- Preserve the running local app and existing saved sessions; hosted cutover is explicit and reversible.
- Node 24 or newer. Hosted Supabase; no local Docker or replacement microservice stack.
- All customer/source histories remain labelled synthetic; all external delivery remains simulated.
- Every schema/memory/runtime change must preserve session and subject access scope.
- Test late/corrected events, changed account authority, expired promises, conflicting reservations and worker interruption at the task that owns that behaviour.
- Separate service restoration, human follow-through, customer confirmation and commercial adoption.
- An action selection is not proof of success. Projection separation is not proof of a behavioural error. Silence is not proof of avoided cost.

## Decision point

The next implementation step is **Task 1: the three histories and event contract**, followed by the domain schema. This is intentionally a data-first return to basics; further Hodoscope styling and broader forecasting wait until their inputs are credible.
