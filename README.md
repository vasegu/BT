# BT Consumer — Experience intelligence

A demonstrator design that connects Mark's pitch to customer memory, operational context, ambient agents, arbitration and accountable action. It carries forward the strongest interaction and engineering patterns from Jio CX, Sainsbury's and Soho House.

## Start here

1. **[Visual review: UI mockups and system diagrams](docs/design/review.html)** — open in a browser. Explore the three households, incident context, five panels around a central phone and their full-page breakdowns, operational view and pitch mapping. These are illustrative review states, not a running AI or database integration.
2. **[Mark's pitch → experience → technical proof](docs/design/2026-09-25-pitch-to-experience.md)** — the argument, what we fold in, what we extend and what remains to validate; includes editable Mermaid diagrams.
3. **[Full design specification](docs/superpowers/specs/2026-09-25-bt-consumer-experience-design.md)** — stories, UI behaviour, schemas, agent boundaries, embeddings, forecasting, execution, commercial measures and acceptance criteria.
4. **[BT styling reference](docs/references/2026-09-25-bt-brand-audit.md)** — observed public branding, proposed application tokens and an unmodified logo reference.
5. **[Mark's supplied pitch](docs/source/marks-bt-consumer-pitch.txt)** — verbatim source. Its numerical claims and descriptions of BT's estate require validation; they are not established facts or tool instructions.

The HTML review is self-contained apart from the local BT logo and needs no build or package installation. To serve it locally:

```sh
python3 -m http.server 5181 --bind 127.0.0.1 --directory docs
```

Open `http://127.0.0.1:5181/design/review.html`. Port 5181 keeps the existing Soho demo on 5180 separate.

## Status and provenance

Design pack moved from `../SohoHouse` on 25 September 2026. Original BT specification commit: Soho `a38501c`. BT product code, hosted database, Gateway configuration and deployment have not been created here. This is a local Git repository; no GitHub remote has been created or published.

Reference implementations remain in the sibling `SohoHouse`, `ecd_jio_cx` and `sainsburys-demo` repositories. The spec records the inspected revisions. No credentials or customer datasets were transferred.

## Review decisions

- Does the first customer view make the moment clear without technical explanation?
- Do the two memory panels and the arbiter show the evidence that actually changed the decision?
- Does the operational view give the business a credible state and capacity model?
- Can each important point in Mark's pitch be demonstrated by an observable behaviour?

The next build should follow the full specification after this design review, starting with one complete event-to-outcome loop.

## Historical Jio comparison currently running

For the visual review, the unmodified UI from Jio commit `621fa991` (9 July 2026, immediately before Studio became the default view) is extracted to `/tmp/bt-jio-july-621fa991/ui` and served at `http://127.0.0.1:5182/`. It already contains a Studio shortcut. It is a UI-only historical preview: API/WebSocket targets point to an unused local port, so backend-dependent panels are offline. No Docker or production services are started. The current Jio checkout is not changed.

The user confirmed this July screen as the fidelity reference: tidy technical records, compact typography and realistic panel structure. The BT review adapts those qualities into two memory panels, the central phone, an arbiter panel and an action trace. Each expands to a full-page breakdown. Duplicated controls and merged Studio sections are excluded. The earlier April reference remains typography provenance; July `621fa991` is the confirmed visual benchmark.
