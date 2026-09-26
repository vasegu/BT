# Final data-foundation review

# SDD ledger — plan: docs/superpowers/plans/2026-09-26-bt-data-foundation.md
Base: 95a1dfb. Baseline: 52 tests pass.
Ruling: Continue in the user's active feat/bt-runtime checkout with selective commits; preserve unfinished visual changes and the running app. No worktree/server move.
Pre-flight: Task 1 fixture feeds Task 3 generator/import and Task 4 context. IDs use stable UUIDs with separate source refs; import injects session scope. Task 2 SQL mirrors fixture relations.
Pre-flight: Task 5 adapter consumes the existing Snapshot contract; tests must compare semantic facts rather than IDs. Historical eligibility remains event-derived.
Task 1: in progress.
Task 1: verified six contract tests, including equal instants with different ISO formatting.
Task 2: Dedicated RX London project imvupiejuuyczrrwsnuy. Foundation applied transactionally and migration history repaired. Rollback SQL checks pass, including cross-session FK, source deduplication, competing reservations, append-only events and private grants.
Task 3: Eight generator/contract tests pass. Canonical 2,824 events imported to b2260926-0000-4000-a000-000000000001; repeat import inserts 0 and reports 2,824 duplicates. Three households / four people; linked source records present.
Task 4: Four context tests pass. Memory migration applied; local MiniLM 384D verified with artifact hashes. Embedding dependency moved to BT-owned Transformers.js; runtime no longer requires Soho.
Task 5: Ruling: Keep the existing SQLite engine unchanged as the legacy adapter; hosted repository implements the same snapshot/advance/worker interface using shared arbitration and context functions. This avoids rewriting saved SQLite sessions; cost is maintaining two persistence adapters.
Task 5: Ruling: Post-run evaluation artefacts retain a separate local SQLite cache in hosted mode; customer/operations/runtime business records use only Postgres. Cost: this optional local evaluation cache does not follow hosted sessions to another machine.
Task 4: Ruling: Upgrade the encoder package to maintained Transformers.js 3.8.1, pin the same MiniLM artifact hashes, and override its image-only sharp dependency to the patched 0.35.4. Existing 384D semantic model remains the same; cost is a new runtime-package dependency. npm audit now reports zero vulnerabilities.
Task 5: Hosted parity test passed all five revisions, 15 decisions, 6 actions, replay deduplication and connection reopen. Initial run took 585s; read queries and worker persistence subsequently batched to reduce network round trips. No provider was called.
Task 6: Full local suite 67 passed, one explicitly opted-in hosted test skipped (run separately above). Lab verification and production build passed. Fresh-failure versus later customer confirmation test failed before adding the reconciliation gate, now passes.
Task 6: Ruling: Eve text exchanges are stored with actual execution timestamps plus the replay cutoff in metadata, never backdated into an earlier decision. Historical simulation contexts exclude these later exchanges. Cost: saved Eve exchanges do not alter the September replay's frozen decision context.

Task 6: Current v1.1 hosted parity passed all five revisions in 340 seconds, plus separate lease/privilege tests. Full suite 70 pass / 2 hosted tests skipped here and run explicitly. Build/lab passed.
Task 6: Ruling: The user added deployment to RX Vercel. Use authenticated presenter deployment, server-only credentials and request-backed durable jobs. Replace Python PCA with equivalent Node SVD for live maps; retain native Hodoscope export and controlled eval batches locally. Cost: hosted map density smoothing differs and native export/batch execution requires the local presenter.
Task 6: Ruling: Retain the pre-existing agent-review UI changes in this branch while connecting them to hosted records. Cost: the final branch includes the user's earlier uncommitted visual work as well as the data foundation.
Task 6: Ruling: Durable Eve voice-transcript ingestion remains outside this first milestone; text exchanges are persisted and voice receives the same scoped context. Cost: voice history will not survive a client reset.

Task 1: complete (b1b5d8b; data-model.test.ts and final suite passed).
Task 2: complete (93f6b48 plus subsequent migrations; check-hosted-schema.mjs transaction rollback checks and hosted-integrity privileges/leases passed).
Task 3: complete (61e0ecc plus v1.1 reconciliation; deterministic generation/import, duplicate import zero writes, synthetic-history tests passed).
Task 4: complete (d1dddfd..70a459d; memory-context regressions and real hosted 384D endpoint passed).
Task 5: complete (d1dddfd..70a459d; five-revision hosted contract passed, then interruption/Eve no-rebilling test passed in 235.9s).
Task 6: complete (74 local tests passed / 3 separately exercised hosted tests skipped by default; build and lab checks passed; Vercel endpoints, original PNG, real atlas, post-run map and live Jev worker verified).
Final: fresh gpt-6-astra review: three Important findings, no Critical or Minor.
Final: fixed historical permission withdrawal — late-known withdrawal test RED→GREEN; full suite 74 pass.
Final: fixed cross-service incident membership — valid secondary-product fixture test RED→GREEN; matching outcome boundary regression RED→GREEN; full suite 74 pass.
Final: fixed future Eve messages changing historical context hash — future-event hash test RED→GREEN; hosted interruption recovery verifies zero repeated provider calls.
Final: Ruling: Verify deployment, database behavior and UI independently rather than treating reviewer omissions as verification. Owner-authenticated HTTP checks pass; live Jev returned recovery/activation/watch with status ok; phone and customer views inspected locally; the browser reaches Vercel sign-in. Cost: hosted voice and exhaustive visual QA are not claimed.
Final: Ruling: Keep the three-household presenter scope, native exports locally, and defer durable voice transcription, customer-facing authentication, unattended scheduling, population forecasts and causal uplift. These are outside this milestone and remain explicit limitations. Cost: this is not a production BT service or a measured commercial experiment.
Final: no deferred Minor findings.

Deployment: https://bt-experience-intelligence.vercel.app (ACN-RX-GeekOut; protected).
Git branch: feat/bt-runtime, preserved and pushed.
