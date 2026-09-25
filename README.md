# BT Consumer — Experience intelligence

A working local demonstrator and design pack connecting Mark's pitch to customer memory, operational context, ambient agents, arbitration and accountable action. It carries forward interaction and engineering patterns from Jio CX, Sainsbury's and Soho House.

## Run the app

Requires Node 24 or newer. No Docker, cloud account or API key is needed for this first slice.

```sh
cd app
npm install
npm run dev
```

Open **http://127.0.0.1:5185/**. Vite serves the React/TypeScript app on 5185; the loopback-only API and worker use 5186. The earlier design review stays on 5181 and Jio's historical preview on 5182.

Press **Play**. The same missing heartbeat produces three different policy decisions. The replay adds the shared incident, observes Daniel's restoration and records Aisha's kept callback. It pauses for Daniel's **“It’s working again”** response in the phone. That response writes a source event and closes the case after the worker processes it.

- Five panels read one persisted session snapshot. Each opens its own full-page section with one **Back to account** action; sibling navigation and customer switching stay on the account overview. Opening a section pauses replay and preserves the customer, session and historical cutoff.
- **Customer memory** brings the lab atlas, original-space cosine retrieval, 384-component fingerprint, current customer readout and clickable source timeline into one desktop screen. The atlas groups 42 example memories into five computed cosine-space clusters, with group filters, six nearest matches, drag rotation, zoom and source inspection. It uses saved synthetic lab contexts; the readout and timeline use the current session. It remains a single section with one return control.
- **Source records** opens the event ledger. Click a record to inspect IDs, source, occurred/received time and payload.
- The numbered replay positions are read-only historical snapshots. **New session** preserves the previous session and starts an isolated one. Its URL is the return point.
- The **Visual lab** contains the semantic atlas, decision flow and memory timeline. These are clearly labelled independent studies, not a live view of the app session's records. A link returns to the same app session.
- SQLite stores records, jobs, decisions, actions and receipts in `app/.data/bt.sqlite` (ignored by Git). A server worker processes pending jobs independently of browser visibility and recovers them after restart. An in-app delivery is a simulated external effect.

```sh
npm test          # eight behavioural checks over temporary databases
npm run test:lab  # vector integrity, retrieval and memory checks
npm run build    # strict typecheck and production bundle
BT_PORT=5185 npm start  # serve the built app + API from one local process
```

Stop the dev processes before starting the production server on the same port. This is a local synthetic demonstrator, not a public multi-user deployment. Local presenter/origin checks are not a replacement for deployed authentication.

### What is real in this slice

React UI, SQLite writes, transactional jobs, idempotency, deterministic arbitration, session isolation, source-time projection, action/receipt persistence and local MiniLM vector computation. Eight engine tests cover separate household decisions, retries, historical causality, retained promises and restart recovery.

### What is still planned

The dedicated RX Supabase/Postgres deployment, full domain schemas, live Gateway/Jev assessments, a larger longitudinal corpus and backtested forecasts. No live AI response is fabricated. The local first-slice schema is not the proposed complete BT schema or a substitute for deployed RLS, leased jobs and outbox delivery. All source records and external business effects are synthetic.

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

Design pack moved from `../SohoHouse` on 25 September 2026. Original BT specification commit: Soho `a38501c`. The first working app is in `app/`; hosted database, Gateway configuration and deployment remain unconfigured. This is a local Git repository; no GitHub remote has been created or published.

Reference implementations remain in the sibling `SohoHouse`, `ecd_jio_cx` and `sainsburys-demo` repositories. The spec records the inspected revisions. No credentials or customer datasets were transferred.

## Review decisions

- Does the first customer view make the moment clear without technical explanation?
- Do the two memory panels and the arbiter show the evidence that actually changed the decision?
- Does the operational view give the business a credible state and capacity model?
- Can each important point in Mark's pitch be demonstrated by an observable behaviour?

The first implementation is the event-to-outcome loop described above. Follow the full specification as the hosted data and model integrations are added.

## Historical Jio comparison currently running

For the visual review, the unmodified UI from Jio commit `621fa991` (9 July 2026, immediately before Studio became the default view) is extracted to `/tmp/bt-jio-july-621fa991/ui` and served at `http://127.0.0.1:5182/`. It already contains a Studio shortcut. It is a UI-only historical preview: API/WebSocket targets point to an unused local port, so backend-dependent panels are offline. No Docker or production services are started. The current Jio checkout is not changed.

The user confirmed this July screen as the fidelity reference: tidy technical records, compact typography and realistic panel structure. The BT review adapts those qualities into two memory panels, the central phone, an arbiter panel and an action trace. Each expands to a full-page breakdown. Duplicated controls and merged Studio sections are excluded. The earlier April reference remains typography provenance; July `621fa991` is the confirmed visual benchmark.
