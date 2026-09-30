// Bakes the all-customer Agent review (context sway) into a static file.
// The replay is deterministic: fixed dataset, rules policy, seeded layout. Re-run after
// changing the dataset, arbiter policy or the embedding text:
//   npm --prefix app run build:sway
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
    const snapshot = engine.snapshot(session.id);
    const data = await contextSway(snapshot, (at) => engine.snapshot(session.id, at));
    const sourceHash = createHash("sha256");
    for (const path of ["../app/server/engine.ts", "../app/server/arbiter.ts", "../app/server/context-sway.ts", "../app/server/assessment.ts", "../app/server/encoder.ts", "../app/server/projection.ts", "./build-context-sway.ts"])
      sourceHash.update(path).update(readFileSync(new URL(path, import.meta.url)));
    return { ...data, provenance: {
      builtAt: new Date().toISOString(),
      datasetVersion: snapshot.session.seedVersion,
      policyVersions: [...new Set(snapshot.decisions.map(d => d.policyVersion))].sort(),
      sourceHash: sourceHash.digest("hex"),
      scope: "global-static-fixture" as const,
    } };
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
