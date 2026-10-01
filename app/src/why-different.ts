import type { PersonId } from "./types";

/** For each moment: why the same event leads to three different journeys. One headline, one line per home. */
export const WHY_DIFFERENT: { headline: string; lines: Record<PersonId, string> }[] = [
  {
    headline: "Before anything happens, each home already has a different story.",
    lines: {
      daniel: "An open fault, a restart that didn’t fix it, and Aisha’s promise to call at 21:15.",
      sam: "Brand new to BT. The hub arrived this week and has never been online.",
      maya: "A long-standing customer with a quiet evening routine and quiet hours from 22:00.",
    },
  },
  {
    headline: "To the network it’s one alarm. Memory says it means three different things.",
    lines: {
      daniel: "A known fault with a named owner: keep Aisha’s plan, and don’t send a message that repeats her.",
      sam: "Not an outage to Sam: a first setup that hasn’t worked. Help with setup.",
      maya: "Matches the routine Maya told us about, and Maya’s phone is active at home. Watch; don’t wake anyone.",
    },
  },
  {
    headline: "The incident register decides who is inside it, and that changes what helps.",
    lines: {
      daniel: "Inside the incident: tell Daniel it’s the network, not the restart, and keep the 21:15 call.",
      sam: "Inside the incident: stop setup attempts that can’t work yet.",
      maya: "Outside the incident: the quiet line is still a watch, not an outage.",
    },
  },
  {
    headline: "The line is back, but each home still needs something different.",
    lines: {
      daniel: "Working again, but the promise isn’t done: say so, and Aisha still calls at 21:15.",
      sam: "The incident has cleared, so setup can work now: invite another try.",
      maya: "Maya’s hub came back on its own schedule. The watch ends, and Maya never knew.",
    },
  },
  {
    headline: "A person keeps the promise; the system knows when to stay out of the way.",
    lines: {
      daniel: "Aisha makes the promised call. No automated message gets in between.",
      sam: "Still no first connection, so no new message until there’s evidence.",
      maya: "The watch is already closed. Nothing to say.",
    },
  },
  {
    headline: "Each loop closes on the customer’s own evidence, not on our assumption.",
    lines: {
      daniel: "Daniel confirms it works. That reply, not the line test, closes the evening.",
      sam: "First connection observed. Only now does a welcome make sense.",
      maya: "The evening ends without Maya ever being disturbed. That was the goal.",
    },
  },
  {
    headline: "The morning after: three different follow-ups, timed to each home.",
    lines: {
      daniel: "A repaired line gets 72 hours of extra monitoring before anyone calls it fixed.",
      sam: "Connected, but TV and Netflix aren’t set up: a setup guide, not an upsell.",
      maya: "We fixed something overnight while the house slept. Tell Maya in the morning, after quiet hours.",
    },
  },
  {
    headline: "Before the working week, only the home with something new hears from us.",
    lines: {
      daniel: "Extra monitoring is still running towards its deadline. Nothing to tell Daniel yet.",
      sam: "Everything included is now in use. Confirm it, and stop nudging.",
      maya: "Nothing new to say, so nothing is said.",
    },
  },
  {
    headline: "Six weeks on, the same data supports three very different relationships.",
    lines: {
      daniel: "Monitoring finished with no drops: one short note that the line is proven, then nothing more.",
      sam: "Watches sport most weekends and opted in to offers: one relevant offer, signed off in advance.",
      maya: "New devices at home, but no marketing consent. BT doesn’t sell.",
    },
  },
];
