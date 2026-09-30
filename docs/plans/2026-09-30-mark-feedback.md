# Responding to Mark's feedback: design

Mark's asks, reduced: memory must visibly be the moat; every story needs an outcome that
comes off the back of the incident; the self-learning loop is missing; show a future vision;
and the frame must be simpler. Phases 2 to 6 below, then the frame is revisited once the
content it has to carry exists.

## The timeline: tonight, then the weeks after

The "same signal, three homes" construct stays for tonight. A second chapter follows each
home past the incident, so outcomes, monitoring, the early-life journey, the upsell and the
learning loop have somewhere to live.

| # | Clock (London) | UTC | Title | Step |
|---|---|---|---|---|
| 0 | Fri 25 Sep 20:45 | 19:45Z | Before the signal | — |
| 1 | 21:00 | 20:00Z | Three homes, one minute | heartbeat |
| 2 | 21:03 | 20:03Z | A network incident is confirmed | incident |
| 3 | 21:12 | 20:12Z | The line comes back | restore |
| 4 | 21:15 | 20:15Z | A promise is kept | callback |
| 5 | 21:18 | 20:18Z | The customers confirm | confirm |
| 6 | Sat 26 Sep 08:30 | 07:30Z | The morning after | morning |
| 7 | Mon 28 Sep 08:30 | 07:30Z | Before the working week | monday |
| 8 | Fri 6 Nov 19:00 | 19:00Z | Six weeks on | weeks |

Both runtimes change: the dataset generator (Supabase path) and the in-memory engine's own
scenario. Dataset becomes v2.0; v1.x stays reproducible.

## Phase 2 · Customer memory v2 (the moat)

New fixture tables, all time-aware (`valid_from`), read by the context builder into a
`profile` on each household at the cutoff. They are not on the Supabase import allowlist, so
no migration: current-version sessions read the generated fixture.

| Table | Holds |
|---|---|
| `customer.members` (extends memberships) | who lives there, relationship, age band |
| `customer.devices` | devices the hub sees, type, owner, first seen |
| `customer.product_usage` | each BT/EE product: since, used or not, last used, hours this week |
| `commercial.contracts` | start, end, months left, ARPU |
| `analytics.churn` | score, level, drivers, as of |
| `analytics.usage_profile` | typical share of use by hour, weekday and weekend |
| `customer.contacts` | every past contact: channel, topic, outcome, with whom |
| `customer.preferences` | channel, quiet hours, commercial consent |

Households:

- **Daniel Reed**, lives with partner Jo. Works from home Mon–Fri 09:00–17:00 (video calls).
  Devices: work laptop, 2 phones, smart TV, smart speaker. Products: BT Full Fibre 150
  (Oct 2025), EE SIM (multi-brand). ARPU £52 + £18 EE. Contract ends 21 Nov 2026 (8 weeks).
  Churn: high on Friday (2 faults in 7 days, 3 contacts, renewal due) → medium Monday → low
  six weeks on. Contacts: May Wi-Fi placement (resolved), 24 Sep call (case DR-2041), 25 Sep
  chat, 25 Sep 21:15 Aisha's call (appears once it happens). Preference: in-app, and a call
  from Aisha for anything about the case.
- **Sam Morgan**, household of four (partner Priya, two teenagers). Products: BT Full Fibre
  500, BT TV Entertainment, Netflix Standard (included). Nothing used yet on Friday; TV box
  and Netflix set up over the weekend; heavy evening use. ARPU £79, contract 24 months from
  18 Sep. Churn: early-life risk while not connected, low once engaged. Opted in to offers at
  setup (commercial consent). Devices appear after first connection: 3 TVs, 4 phones,
  console, 2 laptops.
- **Maya Patel**, with Alex. Products: BT Fibre 2 (May 2025), BT Mobile (Feb 2026), both
  used. Out of contract since June; ARPU £61; churn medium (out of contract). Quiet hours
  22:00–07:00 (her stated habit); in-app messages fine in the morning. Devices: 2 phones,
  laptop, tablet, smart speaker; six weeks on, a new laptop and console (Alex).

"How much does right now matter": usage profile share at the current hour against the
household's peak. Friday 21:00: Daniel moderate (evening TV), Sam peak once connected, Maya
off. Monday 08:30: Daniel high (work starts 09:00).

The Customer memory page is rebuilt around Mark's questions, top to bottom: Household
(members, devices), Relationship (products and whether used, contract, ARPU, churn with
drivers), History (every contact incl. Aisha's call), Right now (how critical this moment is,
from the usage profile), then the existing rhythm, six layers and memory map, each annotated.

## Phase 3 · Stories that end in an outcome

**Daniel: a real fix, proactive, personal, watched afterwards.**
- 21:03 (existing): told before he calls that a network issue explains it.
- 21:12: incident cleared by the network team (record: "cabinet line card replaced"). The
  line comes back. Because the intermittent sync predates the incident, BT also runs a
  **remote line re-profile** (backend fix, runs on its own, no customer message) and starts
  **72 hours of heightened monitoring**. Both are records, so "what did we do" is visible.
- 21:15: Aisha's call happens and is recorded in his contact history with notes.
- Sat 08:30: monitoring overnight: no drops. Nothing sent (weekend, nothing to say).
- Mon 08:30: monitoring closes stable. Message timed before his 09:00 work calls:
  "Your line has been stable since Friday. We've closed the extra checks; Aisha has closed
  your case." Personal: timed to his working day, from his own usage profile.
- Six weeks on: churn low, renewal due in two weeks: nothing pushed (policy: no sale within
  30 days of a fault case).

**Sam: early life, help every step (Jio-style), then a seamless upsell.**
- Tonight (existing): switch-on, hold off, go ahead, connected.
- Sat 08:30: "Your TV and Netflix come with your plan. Want a hand setting them up?"
  (guide, runs on its own).
- Mon 08:30: TV box activated Saturday, Netflix linked Sunday, 11 hours watched: early life
  complete; everything they bought is in use.
- Six weeks on: the household streams sport most weekends and often runs three TVs at once.
  Sam opted in to offers, and the offer sits in a catalogue signed off in advance by the
  Memory & Trust Officer, so it can run: "TV upgrade with sport, first month free". The offer
  is the upsell; governance shows why it's allowed.

**Maya: quiet resolution, communicated at the right time.**
- Tonight (existing): quiet watch; her hub returns.
- Overnight 02:10: a routine line test finds her line's noise margin falling (outside
  INC-017). 03:40: remote re-profile fixes it; nothing sent (her quiet hours).
- Sat 08:30: "While you were asleep we spotted and fixed a fault on your line. Nothing you
  need to do." In-app, outside her quiet hours. The proactive fix is the selling point.

**Eve and the app carry the early-life story (Mark's "Eve's story").** The app is undercooked:
the top panel tells the story while the phone lets you wander off. The phone should show what
the customer sees at this moment, with Eve as the guide:
- Every decision that reaches the customer arrives as Eve speaking in the app, with a clear
  next step (a button) that matches the story's next beat.
- Sam: Saturday, Eve offers to set up BT TV and Netflix, one step at a time; Monday, Eve
  confirms everything is working and in use; six weeks on, Eve suggests the TV upgrade in
  conversation, explains why (the household's own viewing), and it's easy to say no.
- Understanding the household shows in what Eve says: who's in, what they use, when.
- Free exploration of the app stays possible, but the story's path is the obvious one.

## Phase 4 · The learning loop

A "What we learned" view in Actions & outcomes. Baked, deterministic cohort of 1,000
synthetic homes: for each policy, the outcomes it produced, and the policy change that
followed, with its sign-off. Three loops:
1. Morning note after a quiet fix: repeat contacts 2% with the note vs 11% without → the note
   becomes default (signed off by AgentOps lead).
2. Heightened monitoring after a re-profile: 9% of lines drop again within 72h → window stays
   72h (no change: evidence supports it).
3. Early-life guide: homes guided in week one use 2.4 of 3 products vs 1.3 → guide expanded.
Per customer: Maya's quiet-watch confidence rises with each night her hub returns on its own;
Daniel's churn falls after the fix is kept.

## Phase 5 · Future vision (separate mode)

A "2030" mode, reached from the presenter, never mixed into the realistic story. Maya's
personal agent talks to BT's agent over WhatsApp: Alex's new laptop and console appear on the
network; the personal agent asks about insurance; BT's agent checks the mandate (what the
personal agent may agree to), quotes, and Maya approves by voice. Beside the chat, the
architecture: memory used, governance checks (mandate, spend limit, consent), the action.

## Phase 6 · Agent review as three questions

1. Did any fact swing a decision it shouldn't have?
2. Did anything irrelevant get through (the fake gamer claim)?
3. Where should a person look first?
Each answered from the baked replay; the map becomes an "explore" view below.

## Then: the frame again

With the content in place, simplify the frame with it: what the presenter shows per moment,
how chapter 2 is navigated, and what each panel's summary line says.
