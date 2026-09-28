// Bakes the household memory map (six layers, embedded + UMAP) into a static file.
// Re-run after changing the dataset or the layer rules:  npm --prefix app run build:memory
import { writeFileSync } from "node:fs";
import { generateHistory } from "./generate-bt-history.ts";
import { buildMemoryMap } from "../app/server/memory-map.ts";

export const bakeMemoryMap = () => buildMemoryMap(generateHistory({ variant: "canonical" }));
if (import.meta.url === `file://${process.argv[1]}`) {
  const data = await bakeMemoryMap();
  writeFileSync(new URL("../app/public/memory-map.json", import.meta.url), JSON.stringify(data));
  console.log(`Wrote ${data.points.length} memories and ${data.queries.length} moment queries → app/public/memory-map.json (${data.fingerprint.slice(0, 12)})`);
}
