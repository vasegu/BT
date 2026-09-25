# Intelligence studies

Three independent visual studies, kept outside the accepted five-panel account composition until review.

## 01 · Semantic field

126 synthetic record formulations (42 episode motifs × 3 formulations) and six scenario queries encoded locally with quantised `Xenova/all-MiniLM-L6-v2`. Mean pooling, 384 dimensions, unit normalisation. The shipped JSON includes every source text, vector, projected position and model artifact hash.

PCA/SVD is fitted on historical examples only. It preserves 26.7% of total variance in the first three components, so the chart is explicitly a lossy view. Nearest neighbours use cosine similarity in the original 384-dimensional space. Colour categories are authored; coordinates are computed. Neither cosine nor a PCA axis is a probability, behavioural trait or permission to act.

The synthetic corpus has deliberate closely related formulations. It is a design/retrieval demonstration, not an independent held-out evaluation or a trained BT customer model. Historical examples are anonymised synthetic episodes; they do not expose other real customers' records.

Rebuild from the BT repository root with `node scripts/build-visual-lab.mjs`. The script uses the existing sibling Soho encoder cache without network access. `BT_EMBED_RUNTIME` can point to another installed `@xenova/transformers` runtime containing the same cache. Python with NumPy produces the projection. The browser needs neither dependency: it reads the generated JSON.

## 02 · Decision flow

One typed ambient observation → both memories → arbiter mandate → selected and held domain candidates. Switching households or confirming incident scope changes the deterministic policy result. Every node exposes its bounded contract. Replay only animates that trace; it does not manufacture model reasoning or execute a customer action.

## 03 · Memory over time

One authored Daniel recovery sequence. The cursor applies only source records at or before the chosen step. Technical restoration, callback fulfilment and customer confirmation are distinct observations. The state tracks are categorical, not numeric scores. Later steps are proposed synthetic outcomes, not live observations.

## Reference lineage

The lab develops the Soho semantic atlas, memory runtime and operations workbench; Jio's customer/operational separation and bounded agent responsibilities; and Sainsbury's inspectable signal-to-dispatch path. It uses the BT review's compact typography and fine dividers, with dark plum reserved for the technical canvases.

Possible integration points: semantic field inside the expanded customer-memory panel; decision flow inside arbiter detail; evidence timeline inside the action/outcome detail. The main five-panel view remains concise.
