# Mark's second round of feedback: review and plan

1 October 2026. Reviewed against `origin/main` at `e6ecee0`.

## What Mark asked for

1. **More richness at the summary level.** The drill-downs are good (customer memory especially), but the top level is thin.
2. **Sections as rows down the page.** Customer memory, operational memory and so on each become a row, so the story reads top to bottom: trigger, gathering context, decision and plan, then execution and tracking.
3. **Build out the compare view.** Answer the question: *why do three customers in the same incident get three different journeys?* Then drill into one.
4. **Future vision: BT starts the conversation.** Possible triggers are new devices (cover), rising bandwidth (a better plan), exam time (education support for a child), or all of them.
5. **An intro page.** It should say: we'll simulate one incident for three households and show how differently each journey goes.
6. **One slick flow.** Compare, drill-downs and Explore each add something, but the demo needs a single route.
7. Mark will write the three people's stories himself, on the train.

## Where the current build stands

| Ask | Today | Gap |
|---|---|---|
| Summary richness | Presenter shows a 7-item rail on the left, one section in the centre and the phone on the right. You click a rail item to see each section. | Only one section is visible at a time, so the chain from trigger to tracking is never on screen together. |
| Rows down the page | The rail lists the sections in the right order (memory, operations, arbiter, experience, actions, governance, review). | The order is right but they're tabs, not rows. Governance and Agent review sit at the same level as the story. |
| Compare | Three cards per moment: headline, arbiter decision, what the customer sees, plus a "Follow X's story" link. | No memory, operations or tracking. Nothing says *why* the three differ. The signal chips at the top are raw event types. |
| Future | Maya's agent starts. BT verifies the mandate, then quotes device cover and a renewal. | BT should start it. Maya has **no marketing consent** in our own data, so BT starting an offer to her would contradict the governance we show tonight. This needs designing, not just rewording (see below). |
| Intro | 20:45 "Before the signal" acts as an intro, but it opens straight into Daniel's detail. | No framing page. |
| One flow | Present (rail), Compare, drill-down panels, Explore (old tile grid, replay bar), 2030 view, Agent review. | Four ways to see the same thing. Explore still has its own header, controls and look. |
| Stories | Story text is spread across `presentation.ts` (leads, titles, outcomes), the generator (event descriptions) and component copy. | Mark can't drop in his rewritten stories without us hunting through several files. |

## Proposal: one route, five rows

### The flow

1. **Intro** (new, before 20:45). One screen: the premise, the three households as cards (who they are and what's going on in their lives, in one line each), the incident that's about to hit, and a "Start the evening" button. It doubles as the place for Mark's stories.
2. **Compare: the story matrix** (replaces the current compare and becomes the default view). Three columns, one per household. Five rows:
   1. **Trigger.** What the network saw (one alarm, the same for all three).
   2. **Context.** Customer memory and operational memory, two or three key notes each, in the arbiter-note style Mark and you both like.
   3. **Decision and plan.** What the arbiter chose, and the one thing that made it different.
   4. **Execution.** What the customer sees on their phone (a small message preview, or "nothing, by design").
   5. **Tracking.** What we expect to see next and whether we've seen it.
   
   A **"Why different?" band** above the matrix answers Mark's question in one sentence per household for the current moment, e.g. "Daniel: a promise is already in flight", "Sam: never connected, so it isn't an outage to them", "Maya: quiet is her normal". It comes from the facts that changed the decision.
   Rows that didn't change at this moment are greyed, so the eye lands on what moved.
3. **Drill into one household.** Click a column. The same five rows, now one household, full width, with richer content per row and the phone pinned on the right. This replaces the current rail-plus-centre layout: rows instead of tabs.
4. **Drill into a row.** Click a row to open the existing expanded panel (customer memory, operations, arbiter and so on). These stay as they are. They're the part Mark already likes.
5. **Governance and Agent review** move out of the story rows into a "How it's governed" link from the Decision row and the header. They're digressions, not part of the chain.
6. **Explore** is retired from the demo route: hidden behind a "Workbench" link or removed. The 2030 view stays as the closing link after 6 Nov.

The clock stays the spine across steps 2 and 3. Changing household or moment never changes which row you're looking at.

### Future vision, BT starts

Recommendation: BT's agent opens to **Maya's agent**, under a mandate Maya gave in 2030 that explicitly says *"tell my agent about anything that could save money or help the household"*. That's the consent, and it's the governance beat: tonight Maya has no marketing consent, so BT stays silent; in 2030 she's chosen to let her agent hear proposals. One opener, three signals, so it's "all of the above" without three separate scripts:

- **Devices:** two new devices joined. Device cover, £9 a month.
- **Bandwidth:** evening use is up 40% since September and the line is near its plan limit at peak, so a faster plan at the same price on renewal.
- **Exam season:** Maya told BT in spring that Alex has GCSEs next summer. BT offers a free study-hours profile: quieter gaming bandwidth between 4 and 7pm on weekdays, plus a link to a revision resource. This one is a free service, not a sale.

Guardrails to show on screen:
- The exam item uses only what Maya told us, never Alex's browsing.
- Maya's agent filters the three. Maya approves by voice and takes cover and the study profile, but not the plan.
- The plan offer isn't raised again for 90 days.

If you'd rather keep Maya consent-free, swap the 2030 household to Sam, who has opted in to offers.

### Make the stories easy to replace

Pull every piece of household-facing story text into one file, `app/src/stories.ts`: name, one-liner, intro paragraph, and per-moment lead and "why different" line. Mark can then edit his stories in one place, or send them as text for us to paste in. Event descriptions stay in the generator, because they're the data.

## Order of work

1. `stories.ts`: pull the story text into one place (quick, unblocks Mark).
2. Intro page.
3. Story matrix compare view with the "Why different?" band.
4. Single-household rows view replacing the rail.
5. Move Governance and Agent review out of the rows; retire Explore from the route.
6. Rework the 2030 view with BT starting.
7. Walk the full route at 1440 × 900, all three households × nine moments; tests and build.

## Open questions for you and Mark

- Future vision: Maya with a mandate that allows proposals (recommended), or switch to Sam?
- Explore: hide it behind a "Workbench" link, or remove it?
- Should the intro name the incident up front ("a fault takes out the local network at 9pm") or let it land as a surprise at 21:00?
