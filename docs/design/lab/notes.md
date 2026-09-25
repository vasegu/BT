# Intelligence studies

Three visual studies. The semantic atlas is now integrated into the full-page customer memory view; decision flow and memory replay remain available as separate studies.

## 01 · Semantic field

126 synthetic record formulations (42 episode motifs × 3 formulations) and six scenario queries encoded locally with quantised `Xenova/all-MiniLM-L6-v2`. Mean pooling, 384 dimensions, unit normalisation. The shipped JSON includes every source text, vector, projected position and model artifact hash.

PCA/SVD is fitted on historical examples only. It preserves 26.7% of total variance in the first three components, so the chart is explicitly a lossy view. Nearest neighbours use cosine similarity in the original 384-dimensional space. Colour categories are authored; coordinates are computed. Neither cosine nor a PCA axis is a probability, behavioural trait or permission to act.

The synthetic corpus has deliberate closely related formulations. It is a design/retrieval demonstration, not an independent held-out evaluation or a trained BT customer model. Historical examples are anonymised synthetic episodes; they do not expose other real customers' records.

Rebuild from the BT repository root with `node scripts/build-visual-lab.mjs`. The script uses the existing sibling Soho encoder cache without network access. `BT_EMBED_RUNTIME` can point to another installed `@xenova/transformers` runtime containing the same cache. Python with NumPy produces the projection. The browser needs neither dependency: it reads the generated JSON.

### Integrated customer atlas

The customer view collapses the 126 formulations into **42 episode vectors**, each the unit-normalised mean of its three source embeddings. Spherical k-means operates on those original 384D vectors, with five groups and 24 deterministic starts. Query vectors and authored topic tags never affect membership. Five groups were selected after comparing 4–8-group exploratory fits; the cosine silhouette is approximately 0.12, so this is a small overlapping illustrative corpus, not strong customer segmentation. Names and colours are editorial descriptions of the computed groups.

The PCA basis is unchanged and fitted only to historical documents; episode means use the same transform. Flat tinted regions help locate groups but are not statistical confidence regions. Numbered points show the top three full-space retrieval ranks; the selected example shows its rank and cosine similarity. Full-space cosine similarity selects the six relevant examples. Group selection, drag/keyboard rotation, zoom and a source inspector expose what the picture represents. The inspector retains all three formulations. No source records were removed.

The cool white/lilac canvas shares the app’s typography and panel tokens. BT purple marks the query, selected memory, orbit control, source action and decision. Muted teal, purple, slate blue, mauve and bronze distinguish the five memory groups; these supporting chart colours are proposed, not official BT palette values. Solid ink marks replace luminous cores, glows and gradient backdrops. These describe example memory groups, not customer traits. The customer’s current readout and source timeline remain separate from the saved scenario query used for retrieval. The readout walks from stated history through observed evidence to the response; selecting a fact reveals its source in the evidence timeline. The three source formulations remain available in the memory inspector.

`python3 scripts/project-visual-lab.py` regenerates PCA coordinates, episode aggregation and clustering from the existing vectors; `node scripts/verify-lab.mjs` verifies normalisation, aggregation, coverage, nearest-centroid membership and retrieval. Full encoder regeneration invokes the same projection/clustering script.

## 02 · Decision flow

One typed ambient observation → both memories → arbiter mandate → selected and held domain candidates. Switching households or confirming incident scope changes the deterministic policy result. Every node exposes its bounded contract. Replay only animates that trace; it does not manufacture model reasoning or execute a customer action.

## 03 · Memory over time

One authored Daniel recovery sequence. The cursor applies only source records at or before the chosen step. Technical restoration, callback fulfilment and customer confirmation are distinct observations. The state tracks are categorical, not numeric scores. Later steps are proposed synthetic outcomes, not live observations.

## Reference lineage

The lab develops the Soho semantic atlas, memory runtime and operations workbench; Jio's customer/operational separation and bounded agent responsibilities; and Sainsbury's inspectable signal-to-dispatch path. It uses the BT review's compact typography and fine dividers, with restrained colour and annotated technical canvases.

Possible integration points: semantic field inside the expanded customer-memory panel; decision flow inside arbiter detail; evidence timeline inside the action/outcome detail. The main five-panel view remains concise.
