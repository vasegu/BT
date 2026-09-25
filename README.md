# BT Consumer — Experience intelligence

A working local demonstrator and design pack connecting Mark's pitch to customer memory, operational context, ambient agents, arbitration and accountable action. It carries forward interaction and engineering patterns from Jio CX, Sainsbury's and Soho House.

## Run the app

Requires Node 24 or newer. The scenario works without Docker or an API key. Eve uses an OpenAI project key for live chat and voice.

```sh
cd app
npm install
npm run dev
```

Open **http://127.0.0.1:5185/**. Vite serves the React/TypeScript app on 5185; the loopback-only API and worker use 5186. The earlier design review stays on 5181 and Jio's historical preview on 5182.

Press **Play**. The same missing heartbeat produces three different policy decisions. The replay adds the shared incident, observes Daniel's restoration and records Aisha's kept callback. It pauses for Daniel's **“It’s working again”** response in the phone. That response writes a source event and closes the case after the worker processes it.

- Five panels read one persisted session snapshot. Each opens its own full-page section with one **Back to account** action; sibling navigation and customer switching stay on the account overview. Opening a section pauses replay and preserves the customer, session and historical cutoff.
- **Customer memory** brings the lab atlas, original-space cosine retrieval, annotated matches, current customer readout and clickable source timeline into one desktop screen. The atlas groups 42 example memories into five computed cosine-space clusters, with group filters, six nearest matches, drag rotation, zoom and source inspection. It uses saved synthetic lab contexts; the readout and timeline use the current session. It remains a single section with one return control.
- **Arbiter** opens a connected technical workspace: source activity, memory changes, nine domain proposals, eligibility gates, policy priority factors, decision history and the committed execution trace. Select a proposal to trace its inputs; select a previous run to inspect exactly what was known then. Source records and the persisted decision JSON remain one click away. The compact account panel continues to show the current answer.
- **Source records** opens the event ledger. Click a record to inspect IDs, source, occurred/received time and payload.
- The numbered replay positions are read-only historical snapshots. **New session** preserves the previous session and starts an isolated one. Its URL is the return point.
- The **Visual lab** contains the semantic atlas, decision flow and memory timeline. These are clearly labelled independent studies, not a live view of the app session's records. A link returns to the same app session.
- SQLite stores records, jobs, decisions, actions and receipts in `app/.data/bt.sqlite` (ignored by Git). A server worker processes pending jobs independently of browser visibility and recovers them after restart. An in-app delivery is a simulated external effect.

```sh
npm test          # engine, Eve grounding and voice lifecycle checks
npm run test:lab  # vector integrity, retrieval and memory checks
npm run build    # strict typecheck and production bundle
BT_PORT=5185 npm start  # serve the built app + API from one local process
```

Stop the dev processes before starting the production server on the same port. This is a local synthetic demonstrator, not a public multi-user deployment. Local presenter/origin checks are not a replacement for deployed authentication.

### What is real in this slice

React UI, SQLite writes, transactional jobs, idempotency, deterministic arbitration, session isolation, source-time projection, action/receipt persistence and local MiniLM vector computation. Eve adds live OpenAI Responses chat and GPT-Live voice, grounded in the same scoped server snapshot. Engine tests cover separate household decisions, retries, historical causality, retained promises and restart recovery.

### Arbiter: evidence to execution

The worker evaluates domain proposals against the same customer and operations snapshot. Hard gates determine eligibility before explicit policy factors rank the remaining proposals. The displayed 0–100 values are **policy priority units**, not model confidence or calibrated probabilities. The domain labels identify deterministic proposal evaluators in one worker, not independent live model agents.

A fresh case or affected-service incident can overturn a remembered routine for the same person. Incident membership and callback availability project from their source payloads. Restoration, fulfilment of a human promise and customer confirmation remain separate observations. New faults reset current recovery state without erasing previous decisions.

Each new decision persists its trigger, proposal checks and specific evidence IDs, selected and rejected alternatives, projected memory changes, prior decision link and execution stages. Message commits and simulated delivery receipts are linked to the decision in the same transaction. Duplicate prevention and contact-authority holds appear in the execution strip. Historical runs are read-only; older decisions without a trace retain a concise fallback.

Callback capacity is checked from the rota, but this slice does not reserve new appointments. Retrieval and predictive forecasts do not yet drive arbitration; their lab studies remain separate. The workbench exposes actual deterministic behaviour and source provenance, without claiming live autonomous agents or external delivery.

### Eve: live chat and voice

Open **Help** or **Talk to Eve** in the phone. Copy `app/.env.example` to the ignored `app/.env.local` and set `OPENAI_API_KEY`. The server reads it on demand; no restart is necessary. Never use a `VITE_` prefix for this key. `EVE_TEXT_MODEL` defaults to `gpt-5.6-terra`; voice uses `gpt-live-1`, which requires project access.

- Chat uses Responses. Each request reads the selected customer's latest SQLite snapshot (or the selected historical cutoff), own records, relevant incident scope and retained promises. Other customer identities and reservations are excluded. **Records read** shows the supplied evidence and revision, not model-generated citations.
- **Start voice** requests the microphone, negotiates WebRTC through the server and connects audio directly to OpenAI. GPT-Live delegates account questions to the same chat endpoint. Replay updates supply a compact context refresh. Chat and voice transcripts remain in session storage for this browser tab, isolated by demo session, customer and historical cutoff. Leaving Eve releases microphone/audio resources; reopening retains the conversation. Context → Clear conversation removes the local transcript.
- Voice has mute, end, connection errors, a five-minute demo limit and reduced-motion support. Voice opens a focused dark view with clean live captions, glass microphone/close controls and a soft colour bar; closing returns to text chat. The audio-reactive effect uses the MIT-licensed [`voice-glow`](https://libraries.dev/voice) component.
- Eve is read-only. It cannot commit business actions, fulfil promises, book callbacks or close cases. Existing deterministic arbitration and Daniel's explicit confirmation button remain authoritative. All account facts are synthetic; answers and speech are live generated responses. `store: false` is requested for Responses and Live; normal provider data policies still apply.
- The key remains server-side. This is a loopback-only presenter demo, not a deployed authentication boundary. Requests have size limits, timeouts, local origin checks and a bounded number of concurrent provider requests. No mocked answer is substituted for a provider failure.

API routes: `GET /api/eve/status`, `POST /api/eve/chat`, `POST /api/eve/context`, `POST /api/eve/voice`. POSTs require the existing `X-BT-Demo: 1` header. Voice and chat receive only a session ID, selected person, optional cutoff and bounded conversation; the server assembles account context itself.

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

## Workspace visual hierarchy

The React app shares three surfaces: `--canvas` (#F6F5F8) for the page and neutral insets, `--surface` (white) for panels, and `--soft` (#F1EBFA) for selection and decisions. BT purple (#5514B4) marks focus, the current query and primary actions. Chart colours identify groups; they do not introduce extra panel backgrounds. The native phone and explicit error states remain distinct.

One system sans-serif handles reading and controls; system monospace is for data, IDs and timestamps. Five shared sizes replace component-specific guesses: page 26px, section 18px, body 12px, supporting text 11px and metadata 9px. Compact desktop uses 24/16/11/10/8px through the same tokens. The customer view stays on one desktop screen; selecting a fact traces its source below. The account uses a 48px desktop header, a compact replay strip and a shared title/customer-selector row to give the five panels more space.

## Review decisions

- Does the first customer view make the moment clear without technical explanation?
- Do the two memory panels and the arbiter show the evidence that actually changed the decision?
- Does the operational view give the business a credible state and capacity model?
- Can each important point in Mark's pitch be demonstrated by an observable behaviour?

The first implementation is the event-to-outcome loop described above. Follow the full specification as the hosted data and model integrations are added.

## Historical Jio comparison currently running

For the visual review, the unmodified UI from Jio commit `621fa991` (9 July 2026, immediately before Studio became the default view) is extracted to `/tmp/bt-jio-july-621fa991/ui` and served at `http://127.0.0.1:5182/`. It already contains a Studio shortcut. It is a UI-only historical preview: API/WebSocket targets point to an unused local port, so backend-dependent panels are offline. No Docker or production services are started. The current Jio checkout is not changed.

The user confirmed this July screen as the fidelity reference: tidy technical records, compact typography and realistic panel structure. The BT review adapts those qualities into two memory panels, the central phone, an arbiter panel and an action trace. Each expands to a full-page breakdown. Duplicated controls and merged Studio sections are excluded. The earlier April reference remains typography provenance; July `621fa991` is the confirmed visual benchmark.
