# BT first working app implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task. The user has authorised implementation of the accepted design in this session.

**Goal:** Deliver a persistent, working event → memory → arbiter → demo phone action → observed outcome loop in the approved five-panel BT layout, with the three visual studies available beside it.

**Architecture:** React/TypeScript reads one server-owned session snapshot. A local Node worker processes durable jobs independently of the UI; SQLite holds sessions, events, decisions and simulated action receipts. One fixed registry of synthetic scenarios and explicit policies makes this first slice inspectable and repeatable.

**Tech stack:** React, TypeScript, Vite, Node built-in HTTP and SQLite, native SVG. No Docker or agent framework.

**Spec:** [BT experience design](../specs/2026-09-25-bt-consumer-experience-design.md).

## Global constraints

- Keep the accepted two-left / phone / two-right layout, compact system sans and mono records, restrained BT purple.
- Synthetic source records, rule-derived decisions and simulated delivery must retain their labels.
- Customer and operational memory stay separate; preserve callback obligations through technical restoration.
- Session reset creates a new session. Events and decisions are durable and idempotent.
- Querying history is read-only and cannot apply records received after its cutoff.
- Hosted Postgres, Gateway/Jev and statistical forecasts remain explicit later integrations; this first local slice must not claim to implement them.
- Each account panel opens a dedicated full-page section. No nested tab strip or cross-section navigation: one Back to account control, with customer/session/cutoff preserved. The source ledger follows the same pattern.

## Review focus

1. Duplicate and concurrent event submission must not repeat a customer action.
2. A stale presenter must receive a conflict rather than overwriting a newer scenario step.
3. A second session must never share another session's incident state or actions.
4. Historical replay must exclude future observations and preserve the outstanding promise at restoration.
5. Server reload must retain the same session, jobs, decisions and receipts.

## Task 1: Complete the visual studies

- [x] Deliver `docs/design/lab/{index.html,lab.css,lab.js,logic.mjs,space.json,notes.md}` and the two reproducible encoding scripts.
- [x] Verify 384-dimensional unit vectors, original-space cosine retrieval, finite historical-only PCA coordinates and scenario-dependent retrieval.
- [x] Inspect atlas, decision and memory studies in browser at desktop width; fix clipping/overlap.
- [x] Add links from the accepted review and README.

## Task 2: Durable event and decision loop

Files: `app/server/{engine.ts,server.ts}`, `app/tests/engine.test.ts`, `app/src/types.ts`, `app/package.json`.

Interfaces: `Engine(path)` exposes `createSession()`, `advance(sessionId, step, key, revision)`, `processJobs()`, `snapshot(sessionId, cutoff?)`, `close()`. `snapshot` returns typed households, ordered source records, decisions, actions, receipts and current scenario step. HTTP exposes POST `/api/scenarios`, POST `/api/events`, GET `/api/snapshot`.

- [x] Write behavioural tests for the five review conditions, the three distinct heartbeat decisions and the kept-promise sequence. Run against the initially empty class to establish failures.
- [x] Create relational SQLite tables with foreign keys, per-session uniqueness and transactional event/job writes. Seed fictional identities and source histories only.
- [x] Implement event projection and ordered policies, durable job processing and idempotent simulated delivery. A selected action never proves restoration or customer satisfaction.
- [x] Run the tests against temporary databases, including reopen and parallel session checks.
- [x] Expose the loop through a loopback-only HTTP server with JSON size/type checks, same-origin mutation checks and clear 400/404/409 responses. The worker runs from the server, independent of browser polling.

## Task 3: Five-panel React account workspace

Files: `app/src/{App.tsx,styles.css,main.tsx,types.ts}`, `app/{index.html,tsconfig.json,vite.config.ts}`.

- [x] Mount customer memory and operational memory to the left, phone in the centre, arbiter and action trace to the right. All panels use the same snapshot and household selection.
- [x] Add one replay control, next event and new session. Persist the selected session in the URL; polling reads only. Display worker pending/error states and disable mutations while historical mode is selected.
- [x] Provide full-page panel expansion, evidence record inspection, a real source ledger, historical cutoff and customer confirmation through a validated source event.
- [x] Link the existing visual studies and preserve design review access.
- [x] Build/typecheck. Browser-check the complete replay, incident exclusions, history, reload, new session and mobile layout. Leave the app server running.

## Initial implementation decisions

- Local SQLite is the first durable store because no BT hosted project or credentials are configured. It establishes the event and projection contracts without Docker. Hosted Supabase remains the specified destination; moving storage later requires Postgres migrations and access policies, not a claim that SQLite is already Supabase.
- All first-slice arbitration is deterministic. Embeddings are real, locally computed lab assets; no provider response or learned probability is fabricated.

## Verification record

- Engine: eight tests pass; the initial missing implementation failed all six original tests. Additional authority and future-incident regression tests were observed failing before their fixes.
- Build: strict TypeScript and Vite production build pass.
- Lab: 132 unit vectors, original-space retrieval shifts, scope guards and time-bounded memory verified.
- Independent review found two historical causality bugs. Both fixed: no future incident in Maya's first decision; rewind UI derives its signal from the cutoff, not the session head. Browser reproduction confirmed before/after.
- HTTP boundaries reviewed: missing session, cross-origin mutation, missing presenter header, malformed/oversized JSON and invalid inputs reject correctly.
- Storage choice is explicit: SQLite for the first local slice; hosted RX Supabase and live models remain planned. No other scope deviations or deferred review findings.

## Full-page navigation refinement

- [x] Replace nested panel tabs and the duplicated narrow panel with dedicated full-width customer, operations, experience, arbiter and action sections.
- [x] Keep one sticky Back to account control. Hide sibling sections, replay controls and customer switching while expanded; preserve session, customer and cutoff in the URL.
- [x] Apply the same return pattern to Source records. Preserve record inspection and the customer reply interaction.
- [x] Browser-check all five sections at desktop and 390px width, return-to-account state and record inspection. No page-level horizontal overflow at 390px; no console errors.
- [x] Run engine tests (8/8), lab verification and production build after the final refinement.
