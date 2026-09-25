# Panel boundaries and behaviour-space inspection

Operational memory answers “What conditions can the arbiter act on?” It shows the explicit affected-service register, service observations, callback capacity and reservation status, and operational records with occurred/received times and elapsed age. It does not contain action verification or the learning loop.

Actions & outcomes answers “What did we do, what changed, and what should the next decision remember?” Its ledger preserves decision → action → simulated receipt IDs. A chart control switches between embedded runs and the existing verification timeline; the linked inspector follows the selected run or expectation. The account overview now shows each person’s actual expectations, so Maya gets a watch outcome and Sam gets first-use verification rather than generic recovery metrics.

## Hodoscope-style behaviour space

This follows Jio’s AgentHealthDash idea: embed a context/action pair, inspect nearby behaviours, and overlay observations. This is a local implementation, not a connection to the Hodoscope service.

`GET /api/behaviour-space?session=…&at=…` reads actual persisted decisions from the selected replay. Context is a compact summary of decision-time facts (the frozen Jev request when available, otherwise that historical projection), plus the selected decision, reason and effect. Later outcome observations are deliberately excluded from embeddings. Each run retains source IDs and exact committed action/receipt links.

- Encoder: local quantised `Xenova/all-MiniLM-L6-v2`, mean pooling, normalised 384D vectors. No gateway call, remote inference or model download occurs.
- Fit: distinct vectors through the selected cutoff; actual NumPy SVD/PCA. Axis labels include explained variance. The fit changes when new runs arrive, so coordinates across different cutoffs are not a stable distance benchmark.
- Neighbours: cosine similarity in original 384D, not chart distance. Similarity is not a probability, confidence or value measure.
- Groups: deterministic spherical k-means, up to three groups with farthest-first initial centres. Envelopes show membership, not estimated density. Labels use the most common recorded decision domain after grouping; labels never influence the fit.
- Repeats: equal vectors stay at the same location. Stack counts can be clicked or keyboard-activated to cycle through the individual records. There are no invented/jittered records.
- Outcome colour: current verification state of the person’s associated contracts opened by that run’s revision. This does not prove the selected action caused recovery. The inspector spells out the association and links each independent proof obligation.

The completed replay `a3d0a506-abb7-4c39-923e-dbd48394a9ba` has 15 persisted decisions and 10 distinct embedded inputs, with about 57.5% of variance retained in the two-dimensional view. This is deliberately a small synthetic scenario, not an operational sample or a statistically validated segmentation.

## Local runtime and limits

The encoder reuses the same installed runtime/cache as the existing BT customer lab: `../SohoHouse/app/node_modules/@xenova/transformers`. Set `BT_EMBED_RUNTIME` to another installed runtime containing the cached model if relocating the repo. Python 3 with NumPy is required for projection. If either dependency is unavailable, the UI explicitly reports the unavailable map and still offers the evidence timeline. A bounded in-memory cache avoids repeated encoding; restarting the server may re-encode the same inputs.

All BT sources and delivery effects remain synthetic/simulated. Stored assessments, contracts, source joins and embedding calculations are real. No extra paid Jev calls are made by viewing this map. No bandit, reward model or training process was built; the future learning loop remains a labelled concept.

## Verification

41 integration/unit tests pass, including frozen historical inputs, cutoff-limited outcome overlays, no-contract unknown status, duplicate and empty projection handling, PCA distance preservation on a rank-two fixture and original-vector cosine neighbours. The existing lab verifier passes. A fresh independent review found no material issues and checked that all 15 inputs fit the encoder token limit. Browser checks cover the separate routes, linked run/contract/source inspection, stacked runs, replay cutoffs and compact/narrow layouts.
