# Panel boundaries and behaviour space implementation plan

> **For agentic workers:** Use superpowers:executing-plans. Continue in the current checkout so the running preview updates.

**Goal:** Put operating conditions in Operational memory and action evaluation in Actions & outcomes, including a genuine Hodoscope-style view of recorded runs.

**Architecture:** Retain existing SQLite decisions/contracts. Move the outcome workspace to Actions & outcomes and preserve delivery receipts. Build Operational memory from shared incident and rota records with explicit scope, per-service observations, and source/arrival timestamps. A read-only behaviour endpoint embeds decision-time context plus actual selected action locally, then projects and clusters those vectors. Display the small honest run count; no fabricated density.

**Tech Stack:** Existing React/TypeScript/SVG, local MiniLM encoder already used by the lab, NumPy PCA and cosine clustering. No remote model calls for this feature.

**Spec:** User correction: outcomes have their own panel. Hodoscoping belongs with action behaviour; bandit remains conceptual.

## Global constraints
- Preserve the five-panel overview and Back-only section navigation.
- No bandit training, Docker, external delivery, or production-data claims.
- Historical cutoffs bound both input records and displayed outcomes.
- Embedding coordinates are not business metrics; neighbours use original 384D cosine similarity.
- A missing encoder shows an honest unavailable state while the outcome ledger continues working.

## Review focus
- Future observations must not enter earlier run embeddings or replay cutoffs.
- Empty, singleton, duplicate vectors and repeated selection must render safely.
- Receipt delivery must remain separate from verified customer change.
- Choosing another person or historical cutoff must not leave stale selected run data.
- Desktop fits one screen; narrow layouts stack without clipping interactive controls.

## Tasks
- [x] Move the current outcome workspace to Actions & outcomes, restore the receipt ledger there, and replace Operational memory with a focused shared-state workspace. Check each route in the browser.
- [x] Test run assembly using real in-memory Engine replays: earlier input stays frozen, later observations only colour as-of-cutoff outcomes, no-contract runs stay unknown. Test actual PCA/clustering for duplicates/empty/unit vectors. Implement a local encoder and read-only endpoint with explicit provenance.
- [x] Add selectable behaviour-space/evidence-timeline chart modes and linked run/evidence inspection. Preserve action/receipt IDs, real cosine neighbours, model-vs-policy provenance and a conceptual learning strip.
- [x] Run the full suite/build/lab verification, inspect desktop and narrow screens, request a fresh review, fix material issues and record limitations.

## Completion evidence

- 41 tests pass; production build and existing semantic-lab verification pass.
- GET behaviour-space returned 15 stored runs / 10 distinct inputs over the completed replay, locally encoded in about 1.3 seconds on first use.
- Browser: 1440×900 and 1280×720 fit; 716px layout stacks with no horizontal overflow. Checked account/back-only navigation, historical rev 0/1/5, scope unknown before incident, filters, keyboard duplicate cycling, run→contract→source inspection.
- Independent reviewer: no material findings; seeded inputs fit the model token limit.
- Ruling: group envelopes show membership rather than density because this replay is small. No synthetic point expansion and no bandit implementation.
