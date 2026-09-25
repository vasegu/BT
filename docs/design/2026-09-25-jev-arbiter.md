# BT arbiter: Jev integration

Implemented 25 September 2026. This follows the authorised move from the rules-only workbench to real model assessments while preserving the five-panel overview and full-page inspection flow.

## Reference: the real Sainsbury's application

Inspected `../Sainsburys/acn_store_intelligence-ca2-context` at `5187bef`, including the current team handover, `arbiter/jev_client.py`, `deciders/jev.py`, the typed decision contract and MAF graph description. Also inspected the independent arbiter repository and its lift-and-shift notes. The maintained service is distinct from `sainsburys-demo` and its presentation UI.

The current CA2 handover describes a deployed evaluation service with frozen context, typed model decisions, deterministic constraints, provenance and cost receipts. It explicitly does not claim an automatic live-store signal-to-executed-action loop. Its latest comparison retained a Jev route failure and GPT action disagreement. BT therefore verifies its own provider route and does not inherit a claim of provider quality from that deployment.

| CA2 mechanism | BT implementation |
| --- | --- |
| Capture the situation and its provenance | Frozen scoped facts, source timestamps, records and input hash per customer/revision. |
| Typed model questions | Jev choice/score questions for interpretation, urgency and next permitted action. |
| Model answer versus effective decision | Returned distributions retained alongside accepted selection or explicit policy hold. |
| Constraints and autonomy boundary | Eligibility, existing ownership and contact authority stay in code. Only authored plans or defer. |
| Evaluation/cost receipts | Model, prompt version, Gateway generation ID, latency, token counts and reported cost. |
| Replay and execution boundary | Durable request/result ledger; simulated action plus delivery receipt in a transaction. |

BT does not copy MAF, Azure infrastructure or the full multi-alert contention/replanning graph. Its existing Node worker and SQLite store handle this bounded slice without additional packages.

## Runtime contract

A new scenario revision wakes the worker. For each customer it derives deterministic proposals, then freezes an allowlisted model request. It supplies source observations as data, excludes other customers' personal records and replaces known customer/adviser names. Shared incident evidence states only whether the current service is in scope; capacity describes free slots and existing commitments. This is scoped demo data, not a general-purpose anonymisation system.

One request asks three questions. Interpretation and urgency are inspectable assessments; action selection drives which permitted authored plan becomes effective. Existing hard gates prevent a high model probability from authorising an invalid restart, cancelling a promise, claiming recovery or sending without authority. A probability below 0.70 holds new actions. That threshold is a demo policy and requires labelled evaluation before any production use.

The model sees neither the rules baseline winner nor policy scores. Baseline factors stay inspectable for comparison. There are often few eligible actions in this scenario; choosing to defer is a real alternative. This is not proof that the system can independently invent a plan, negotiate resources or optimise commercial value.

The Gateway route is fixed to `https://ai-gateway.vercel.sh/v1/evaluate`, model `typesafe-ai/jev`, with TypeSafe-only routing and zero data retention requested. The key is read from the ignored server environment. No client key, provider error body, arbitrary endpoint or automatic paid retry is exposed.

Before a call, `model_evaluations` records the attempt; afterwards it records the validated result. Commit failure reuses the saved assessment. An interrupted call is held rather than billed again automatically. Calls occur outside write transactions and one worker prevents overlap. Multiple processes sharing this database are not supported; use leases before hosted parallel execution.

## Observed verification

The supplied Gateway key succeeded. A complete isolated replay produced 15 successful model assessments across three customers and five revisions. Observed provider round trips ranged from 249 to 415 ms, with Gateway-reported cost of zero for those calls. This is one local verification run, not a latency or quality benchmark; future calls use the provider's current billing.

Daniel's first interpretation assigned 58% to service fault, 23% to recovery follow-up and 19% to insufficient evidence, while the next-action distribution assigned 99% to continuing recovery. These separate judgments illustrate why interpretation uncertainty is not interchangeable with certainty about the next bounded step. Subsequent incident, restoration, callback and confirmation records produced separate saved decisions.

Automated regressions cover scoped requests, model-driven deferral, hard-gate rejection, uncertainty, malformed output, redacted failures, overlap prevention, replay reuse and key-removal recovery. Existing engine, Eve and voice tests remain in the suite.

## Next capability to add

The present next-action vocabulary is authored and eligibility is deterministic. A further slice can introduce multi-step domain plans, resource contention and retrieval-informed plans. Explicit outcome write-back was added in the operational-memory pass (see `2026-09-25-operational-memory.md`). That requires a richer scenario and measured evaluation, not merely more model calls or decorative confidence scores.

Official API contract: [Vercel evaluation documentation](https://vercel.com/docs/ai-gateway/modalities/evaluation). TypeSafe's [introduction](https://docs.typesafe.ai/introduction) describes its typed evaluation model.
