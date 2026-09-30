# Persona and replay-time audit — 30 September 2026

Audit only. Reviewed the current working tree, including existing uncommitted changes, against generated `bt-households-v2.4` canonical data. No application files, databases, or model services were changed/called.

## Findings

### P2 — Daniel's case is presented as closed before the recorded closure

- Source: `app/server/engine.ts:236–239`; consumers `app/src/App.tsx:506–513` and `app/src/PhoneExperience.tsx:557–564`.
- Reproduce: Daniel at Friday 21:18, Saturday 08:30, or Monday 08:30. `buildContext` yields `caseStatus: "closed"` while `monitoring: "active"`; customer memory and the phone's case details explicitly display Closed.
- The v2.4 fixture records the actual `case.closed` event on Monday 28 September at 20:15Z / 21:15 BST (`scripts/generate-bt-history.ts:1152`). The Friday customer reply unconditionally closes the projected case before that evidence exists. Monitoring completion and formal closure were deliberately deferred in this fixture, but case presentation still follows the older shortcut.
- Keep customer confirmation separate from case closure; retain case ownership/state until the closure event. Existing Monday test only asserts status is not `none`, so `closed` incorrectly passes.

### P2 — Daniel's phone detail still claims the old Monday morning closure

- Source: `app/src/PhoneExperience.tsx:208–217`, especially line 214.
- Reproduce: Daniel, 6 Nov, open the closure message's “See the checks” action. The detail says “Monday 08:25 · Aisha closed your case.”
- Actual v2.4 closure is Monday 21:15 BST, after the 72-hour window ends at 21:12. The detail would put closure almost thirteen hours before completion, contradicting both the revised source and the closure message.
- Derive the timestamp from the closure record, or update the fixture-specific text consistently. This is separate from the early projected-case issue above: fixing either alone leaves the other contradiction.

### P2 — Operational memory reports no change when it displays fresh network evidence

- Source: `app/src/presentation.ts:205–206,236–239`; `app/src/PresenterWorkspace.tsx:34`; fresh evidence is correctly surfaced by `app/src/DecisionFlow.tsx:43–67`.
- Reproduce: Daniel or Maya at 21:00; Maya at Saturday 08:30; Daniel at Saturday or Monday 08:30. The Operational memory rail says “Shared context retained”, its header says retained context, and its summary says “No change on the network”. Immediately beneath it, the facts show new router alarms, line degradation/repair, or monitoring checkpoints.
- `changeSummary` only counts shared `incident.*` events as operational changes, excluding the very household telemetry displayed in this panel. This makes the change rail unreliable for the presentation's central question, what changed at this moment.
- Classify relevant service telemetry as operational changes alongside incident changes, or label this summary specifically as incident-register status.

### P2 — The customer-memory change detector misses Maya's new household devices

- Source: `app/src/presentation.ts:205,230–233`; `app/src/PresenterWorkspace.tsx:33`; device additions in `scripts/generate-bt-history.ts:1068–1069`.
- Reproduce: Maya, advance from Monday 08:30 to 6 Nov, select Customer memory. The profile gains Alex's new laptop (30 October) and games console (2 November), but the panel says “Nothing new for this home”, the rail says “Context retained”, and no change marker appears.
- The detector considers only a whitelist of source-event types and never compares dated profile rows. These new devices are precisely the relationship change the six-week chapter is meant to expose.
- Include profile changes in the change summary (or narrow the copy explicitly to new service events).

### P3 — Daniel's Monday monitoring checkpoint is mislabeled as overnight

- Source: `app/src/presentation.ts:188`.
- Reproduce: Daniel at Monday 08:30, Customer memory summary says “Overnight check: no drops”. The actual checkpoint at Monday 08:20 BST covers 59 hours 8 minutes since Friday, with monitoring continuing until 21:12 that evening (`scripts/generate-bt-history.ts:1141–1143`).
- A fixed label for every `monitoring.checked` event loses the important distinction between Saturday's overnight check and Monday's cumulative check. Use the event's period/time or neutral “Monitoring checkpoint: no drops”.

## Coverage and verification

- Generated canonical v2.4 in memory and called the real `buildContext` projection for Daniel, Sam, and Maya at all nine engine clocks (27 combinations). Inspected case status, monitoring, household outcome titles, customer-memory change text, and dated product/profile data.
- Read `presentation.ts`, `PresenterWorkspace.tsx`, `DecisionFlow.tsx`, relevant engine/context/profile projection code, Postgres snapshot cutoff construction, fixture generation, and the implicated phone/customer-memory render paths.
- Ran `node --test app/tests/history-scenarios.test.ts`: 18 passed, 0 failed. This is a pure generated-history suite; it does not mutate the application database or call a paid evaluator.
- Verified the intended transitions: Sam remains unconnected until separate first-use evidence at 21:18; Daniel monitoring remains active Monday morning and only completes at the last replay cutoff; Maya's verified overnight repair appears Saturday; later profile data is cutoff-filtered.
- No browser use (root agent owns browser validation). The phone detail reproduction follows the static action mapping and render path, not an independent click test. No claims about visual layout, backend network access, persisted hosted sessions, or model evaluator behavior. The canonical state sweep did not recreate persisted action receipts/outcome rows; existing scenario tests cover selected arbitration/outcome transitions. Other agents/root cover broader panels.
