// Bakes the all-customer Agent review (context sway) into a static file.
// The replay is deterministic: fixed dataset, rules policy, seeded layout. Re-run after
// changing the dataset, arbiter policy or the embedding text:
//   npm --prefix app run build:sway
import { writeFileSync } from "node:fs";
import { Engine, steps } from "../app/server/engine.ts";
import { contextSway } from "../app/server/context-sway.ts";

export async function bakeContextSway() {
  const engine = new Engine(":memory:");
  try {
    const session = engine.createSession();
    for (const [i, step] of steps.entries()) {
      engine.advance(session.id, step, `sway-${i}`, i);
      await engine.processJobs();
    }
    return await contextSway(engine.snapshot(session.id), (at) => engine.snapshot(session.id, at));
  } finally {
    engine.close();
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const data = await bakeContextSway();
  const out = new URL("../app/public/context-sway.json", import.meta.url);
  writeFileSync(out, JSON.stringify(data));
  console.log(`Wrote ${data.points.length} contexts across ${data.bases} moments → app/public/context-sway.json (${data.fingerprint.slice(0, 12)})`);
}
