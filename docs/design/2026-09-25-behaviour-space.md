# Context → possible actions → governed action → customer evidence

Updated 26 September after clarifying the intended Hodoscope-inspired interaction. This recorded-comparison view is a local inspection tool. The adjacent [controlled eval](2026-09-26-context-invariance-eval.md) now uses the actual Hodoscope package and the Jio explorer structure. The earlier map embedded context together with the selected action. That mixed the input and output, so it could not support the question we actually want to ask: **where do nearby input contexts lead to different responses?**

## Mark's pitch is the organising question

> Given a signal, what does BT know about this customer that changes the right response?

The five-panel overview remains the simple narrative. Open Actions & outcomes to inspect recorded contrasts; open Operational memory for shared conditions, capacity and source freshness. Action verification and the future learning loop remain in Actions & outcomes.

| Mark's point | Demonstrable example | Detail available | Value and limits |
|---|---|---|---|
| First seven days: delivery is not successful first use | Sam has delivered equipment but unconfirmed activation | Decision-time activation facts, first-use support vs incident response, a still-open first-use contract | Measure successful activation, time to first use and avoided repeat contact. An outreach receipt alone proves none of these. |
| Silent router: identical signal, different household context | Maya's stated routine, Daniel's open case and promised callback, Sam's incomplete start | Same-revision household contrasts, actual model distributions and changed facts | Appropriate silence, relevant support, less repeated explanation. No counterfactual contact savings are claimed. |
| Proactive/reactive is a memory problem | Daniel's failed restart and named promise persist after restoration | Across-time comparisons; policy eligibility; committed message/receipt; independent callback, line and confirmation evidence | Keep the promise and avoid repeated failed advice. Trust and retention require measurement beyond this demo. |
| Safe action must have authority | A preferred model action does not itself grant permission | Recorded eligible actions, model preference vs governed selection, explicit policy hold | Observe policy compliance and blocked/merged work, not just model confidence. |
| Did the plan work, and what should BT remember? | Daniel's three proof obligations, Maya's bounded watch, Sam's unverified first use | Persisted contracts, deadlines, independent observations, scoped memory passed into later Jev calls | Separate message delivery from changed customer state. Do not attribute network restoration to a message. |

The broader pitch also covers household products, end-to-end activation journeys and commercial expansion. Those remain future scope, not behaviours claimed by this replay. Mark's illustrative cross-client commercial ranges are not BT forecasts.

## Interaction

1. **Find a meaningful contrast.** Compare the same scenario across households or one household across time. Rank review candidates by factual similarity × action-distribution shift. Select a pair, or choose any reference A and current run B.
2. **See the context neighbourhood.** Actual factual embeddings projected into 2D. Selecting stacked points cycles recorded runs; equal vectors are never artificially separated. A and B remain separately identified.
3. **See the action fan.** Ten categorical action options with actual persisted Jev probabilities for each run. Path thickness follows probability. The fan is a visual metaphor for possible responses; it is not a learned action embedding or a calibrated forecast of customer outcomes.
4. **Inspect the difference.** Changed facts, exact question-payload fingerprints, other changed context sections, eligibility changes, selected action, and the retrieved source records are linked to the frozen decision-time inputs.
5. **Verify downstream change.** Follow the selected run to its committed action and simulated receipt, then inspect the person's independent outcome obligations at the chosen replay cutoff. The outcome timeline remains available. The next-decision memory cards preserve unresolved as well as verified outcomes.

## Real calculations and evidence boundaries

`GET /api/behaviour-space?session=…&at=…` reads persisted decisions from one replay, limited to the requested cutoff.

- **Embedding input:** sorted factual fields from the frozen Jev request. Historical projected facts are used only for policy-only runs. Selected actions, explanations and subsequent outcomes are excluded. The inspector exposes the exact input. This is a factual-context projection, not the complete prompt/retrieved-record embedding.
- **Encoder:** local quantised `Xenova/all-MiniLM-L6-v2`, mean pooling and normalised 384D vectors. Viewing the page does not make a paid inference call or download a model.
- **Projection:** actual NumPy SVD/PCA fit to distinct vectors through the cutoff. Explained variance is shown. It refits when the cutoff changes; axes are not stable over time. Semantic similarity comes from original-vector cosine, not 2D chart distance.
- **Probabilities:** successful recorded Jev assessments only; finite values in [0,1] whose total is within 0.02 of 1. Missing, failed or policy-only assessments never receive invented probabilities. Raw reported values are displayed, rounded to whole percentages.
- **Distribution shift:** total variation distance (half the L1 distance), over the union of action IDs, with each valid distribution normalised. Zero means identical; one means no overlap. It is not statistical significance or an outcome probability.
- **Comparison eligibility:** both runs must have valid distributions and the same recorded model identifier. Question payload and prompt-version equality are reported separately. Candidate/action changes are not concealed.
- **Ranking:** max(0, cosine) × total variation. The corpus is fifteen runs in the completed replay, not a representative population. High values identify interesting comparisons, not proven anomalies. The shared factual template can itself produce high cosine similarity.
- **Prompt controls:** SHA-256 of the exact JSON question payload, plus prompt version. Section fingerprints separately compare clock, retrieved records, candidate definitions/constraints, recent actions and outcome memory. Matching question hashes do not mean all other inputs were held fixed.
- **Source boundaries:** retrieved-record IDs are the decision-time evidence list. Outcomes are associated contracts opened by that run's revision, evaluated only as far as the selected snapshot cutoff. They are not attributed to a single message.

The completed replay `a3d0a506-abb7-4c39-923e-dbd48394a9ba` contains fifteen saved successful Jev assessments. In this recording, several strong action shifts also change the action wording in the questions. The interface explicitly marks these as **Prompt also changed**. A useful observed example is Daniel's recovery follow-up versus eventual confirmation: very similar factual vectors, different model actions, and visible differences in case status, callback fulfilment and customer confirmation.

## What a controlled sensitivity experiment would add

The current view compares observations. To establish which context feature sways a decision, hold model/settings, questions, candidate policy and all other retrieved context fixed; alter one supported fact; repeat calls; compare distributions and governed selections. Record these as evaluation-only runs, never real customer dispatches. A one-off difference is not enough to infer a reliable causal relationship.

The first controlled experiment is now implemented as a separate **Controlled eval** view: frozen 21:00 requests, gamer self-description variants, three repeats and actual Hodoscope projection. See [method and pilot results](2026-09-26-context-invariance-eval.md). A trained contextual bandit remains unimplemented. The future loop is illustrated as context + action + outcome → reward → policy improvement, with an explicit Concept label. No reward model, policy update or commercial uplift estimate runs behind the visual.

## Runtime and verification

The local encoder reuses `../SohoHouse/app/node_modules/@xenova/transformers` and its cached model. `BT_EMBED_RUNTIME` can point to another installed runtime with the cache. Python 3 with NumPy is required for projection. If unavailable, the UI reports that and offers the evidence timeline. A bounded in-memory input cache avoids repeated encoding.

The behavioural tests cover frozen inputs, absence of selected-action leakage, cutoff-bounded outcome association, no-contract status, real projection/nearest-neighbour properties, repeated inputs, distribution validity, model compatibility, and prompt-confounded contrasts. Full runtime and lab checks also cover scenario scope, policy gates, independent proof obligations and persisted memory. All source scenarios and delivery effects are synthetic/simulated; records, model assessments, joins, embeddings and comparison calculations are real.
