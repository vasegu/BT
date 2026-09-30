# Eve knowledge audit — 30 September 2026

Audited after pushing `858f2cf` to `origin/feat/bt-runtime`. Read-only runtime inspection plus code tracing; no production code changes or model calls in this audit.

## Coverage

Fetched all nine snapshots of Supabase replay `703486b4-0591-45cd-a37d-59a06dbf8c35` and ran the actual `eveContext` and `voiceBrief` builders for Daniel, Sam and Maya: 27 persona/time contexts. Checked occurrence and receipt cutoffs against original scoped source records, other-household names and service identifiers, state progression and payload contents. See `2026-09-30-eve-knowledge-matrix.csv`.

No future records, late-received records, or other-household names/service identifiers were found in those contexts. The existing Eve/client/temporal test selection passed: 13 tests, zero failures. This verifies context construction and mocked transport behavior, not the reliability of actual generated answers or spoken delegation.

## What text Eve actually receives

`app/server/eve.ts:60–127` builds one customer’s server context, not browser-supplied account facts:

- Selected time, revision, historical flag and synthetic-data provenance.
- Full projected household: case, owner, promise, restoration, confirmation, activation, habits, permissions and later monitoring/engagement/offer flags.
- Household profile: members, observed devices, products, usage, contract, monthly revenue, illustrative churn score, preferences and contact history.
- Linked services and admitted customer-memory items, with epistemic tags and evidence IDs.
- Personal source records, reduced to ID/type/source/occurrence time/description.
- Shared incident ID/status/this-household scope, and this customer’s reserved slots.
- Latest personal decision title, reason, held alternatives, disposition and policy version.
- Personal conversation events and customer updates.
- A narrow list of available demo actions. Eve itself remains read-only.

Payloads in this run ranged from 4,968 to 16,349 JSON characters, with 7–20 personal source records. Customer memory is materially richer than the short phone summary.

## Knowledge by moment

Earlier knowledge carries forward unless superseded by later evidence. The table describes available facts, not guaranteed model wording.

| Moment | Daniel | Sam | Maya |
|---|---|---|---|
| 20:45 | Open proactive case, Aisha, failed restart, 21:15 promise; no verified recovery | Household/order/delivery and setup history; successful first use not established | Household, products, quiet-hour preference and stated overnight routine; no current recovery claim |
| 21:00 | Missing heartbeat added to existing care context | Setup/connection signal; activation still unconfirmed | Missing heartbeat plus routine; habit is not proof the line is healthy |
| 21:03 | Confirmed incident in scope | Same incident in scope | Incident exists but this customer is outside scope |
| 21:12 | Restoration observed, remote re-profile and active monitoring; callback still outstanding | Incident cleared; first use still unconfirmed | Returning heartbeat and recovery observation; no overnight repair yet |
| 21:15 | Callback fulfilled, confirmation still absent | First use still unconfirmed | Prior evidence retained |
| 21:18 | Customer confirmation; case remains open and monitoring active | Successful first use and closure of setup case; Daniel’s confirmation flag is not reused | Prior evidence retained |
| Saturday | Monitoring checkpoint, no premature closure | Included services not yet fully used; onboarding context | Overnight line repair and morning customer update |
| Monday | Monitoring still active at this checkpoint | Included-product activation/usage recorded | Quiet repair history retained |
| Six weeks | Monitoring complete and formal closure recorded | Engagement, sports/streaming usage and offer context; no inferred purchase | New devices and existing preferences; no marketing consent inferred from devices |

## Findings, in priority order

### P1 — historical conversation persistence conflicts with the settled snapshot cache

`app/server/postgres-repository.ts:249–257` returns cached historical snapshots. `saveConversation` at lines 652–681 permits writing an exchange at a historical beat, then invalidates only `fixtures`, not `settled`.

A no-database mock probe exercised the real `saveConversation` and `snapshot` methods: five simulated write statements completed; fixture cache was invalidated; historical snapshot cache remained; next snapshot did not contain the newly saved conversation. Thus a historical follow-up can depend on browser-carried messages rather than the supposedly refreshed server context. A later uncached view and an already cached view can disagree about the same saved conversation.

Recommendation: choose an explicit policy for replay conversations. If they are part of the beat’s knowledge, invalidate affected cached snapshots after saving and refresh relevant client snapshots. Alternatively keep exploratory chats in a separate branch/run rather than rewriting a frozen scenario history. Preserve wall-clock audit metadata either way.

### P1 — voice starts with a significantly thinner, sometimes misleading brief

`app/server/eve.ts:138–140,239–269` gives GPT-Live only a short operational brief plus local conversation history. It does not receive the full household/products/usage/memory context directly. Fresh detailed account questions depend on delegation to the text endpoint.

Concrete example: at six weeks the brief still says `Incident: INC-017, in scope true` for Daniel/Sam but omits the incident’s cleared status. It also omits Daniel’s completed monitoring and Sam’s product adoption/offer context. Text Eve has those flags; voice Eve must delegate before explaining them accurately.

Recommendation: include incident status, current lifecycle/monitoring and a small set of dated household facts in the initial/refresh brief; make account-specific delegation reliable and verify it with live response probes. Do not treat the current voice and text modes as having equivalent immediate knowledge.

### P2 — operational, governance and outcome evidence is incomplete

The personal-record filter at `app/server/eve.ts:93–101` removes every shared source. Eve receives incident status but not its full repair record. It receives offer flags/decision explanation but no structured approval record or full selected-candidate gates. Outcome contracts and their target/deadline/check/evidence are absent altogether.

Daniel’s personal re-profile and monitoring records *are* present; this is not a total repair-knowledge gap. It is a mismatch between what the detailed inspectors can prove and what Eve can independently explain. Sam’s shared `policy.offer_approved` evidence is absent from his raw records even when the offer flag is true.

Recommendation: project the selected household’s safe shared evidence, selected policy checks and personal outcome contracts, stripping other customers’ identities. Expose explicit dates and provenance rather than just flags.

### P2 — delegated voice answers are cut at a character boundary

`app/src/eve-client.ts:285` sends `reply.text.slice(0, 1000)` back to the voice session. A long answer can lose its final qualification or next step mid-sentence. The UI requests short answers but the server output limit permits a longer response.

Recommendation: produce a separately bounded spoken answer, or shorten at sentence boundaries while preserving essential limitations. Add a long-answer regression and verify actual speech.

### P2 — latest-state requests are not pinned to the visible revision

`app/src/Eve.tsx:43–48` sends `at` only for historical snapshots. That is appropriate for a live assistant, but if another tab advances the same run between rendering and sending, text/voice can read a newer revision than the visible phone. This is a source-level race risk, not observed leakage in the 27 captured contexts.

Recommendation: pin demo questions to the displayed revision, or clearly announce a server-state advance and refresh the phone before answering. Preserve a separate explicit live mode if desired.

## Isolation and refresh mechanisms that are already sound

- Persona is validated against the three known aliases; client messages cannot supply system/developer roles.
- Server loads the selected snapshot, then selects the household. It does not accept a client-built account context.
- App keys the phone by session/person/requested cutoff, remounting Eve across persona/replay switches. Cleanup aborts pending requests and disposes voice, including late microphone acquisition.
- Browser conversation storage is separated by session/person/historical cutoff (or live).
- Detailed voice delegation makes a new server request. It does not merely answer from its initial brief.
- Instructions distinguish technical restoration, callback and customer confirmation; forbid inferred outage from silence, repeated failed restart advice and invented account mutations.
- “Records read” is the supplied personal record list, not a verified citation list showing which records caused the model’s answer.

## Recommended next pass

1. Resolve historical chat/cache consistency and explicitly pin demo question scope.
2. Define one safe Eve knowledge projection with customer memory, relevant shared evidence, authority gates and outcome proof.
3. Derive a concise voice brief from that projection, including closed/cleared states and later relationship facts.
4. Add a 27-context regression plus question probes: what do you know about my household; what changed now; what repaired it; was the callback made; what remains open; what products are unused; why this offer; what are you not authorised to do?
5. Run text probes and a smaller representative live-voice suite. Score factual support, unknowns, persona isolation, historical cutoff and forbidden action claims separately. This audit has not yet run those generative evaluations.

## Fix verification — 30 September 2026

The five findings above are now addressed locally:

- Conversation writes invalidate server replay caches from their beat onward, guard against stale in-flight cache writes, and invalidate/refresh the browser snapshot. Earlier beats remain unchanged.
- Every Eve request carries the displayed cutoff. Changing person or beat remounts Eve and disposes the previous voice session.
- The knowledge projection includes scoped shared incident/approval evidence, selected authority checks and dated outcome contracts. Future and late-arriving records are excluded; other household identities are withheld.
- Voice briefs include cleared incident state, monitoring, repair and engagement facts within a whole-sentence budget. Detailed questions still delegate to the full context.
- Long delegated voice answers are retained in the written conversation with a short spoken handoff, rather than truncated mid-claim.

Validation: production build passed; full suite 139 tests, 136 passed, 3 skipped, zero failures. The new canonical matrix checks all three households across nine moments. Six live text probes covered early/late Daniel, early/late Sam, and early/next-morning Maya. They preserved the tested timeline boundaries, distinguished unknowns from confirmed facts, and did not claim account mutations. These probes are representative, not exhaustive model evaluation.

Microphone playback and end-to-end live voice were not exercised. Server cache invalidation is process-local; this does not establish cross-instance cache coherence.
