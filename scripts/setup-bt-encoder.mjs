import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const manifest = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/bt-households/v1/encoder-manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
for (const [file, expected] of Object.entries(manifest.files)) {
  const url = new URL(
    `../app/.data/models/${manifest.model}/${file}`,
    import.meta.url,
  );
  let bytes;
  try {
    bytes = readFileSync(url);
  } catch {}
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== expected) {
    const response = await fetch(
      `https://huggingface.co/${manifest.model}/resolve/main/${file}`,
    );
    if (!response.ok) throw new Error(`Model download failed: ${file}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== expected)
      throw new Error(
        `Artifact changed upstream: ${file}. Review a new encoder manifest before use.`,
      );
    mkdirSync(dirname(fileURLToPath(url)), { recursive: true });
    writeFileSync(url, bytes);
  }
}
console.log(
  "Pinned MiniLM artifacts verified in BT. No sibling repository dependency.",
);
