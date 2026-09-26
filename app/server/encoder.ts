import { pipeline, env } from "@huggingface/transformers";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hash } from "./memory.ts";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  readFileSync(
    new URL(
      "../../fixtures/bt-households/v1/encoder-manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
export const encoderModel = manifest.model as string;
export const artifactHash = hash(manifest);
let ready: Promise<any> | undefined;
const cache = new Map<string, Promise<number[]>>();
export async function embed(input: string): Promise<number[]> {
  if (!ready)
    ready = (async () => {
      const root = new URL("../.data/models/", import.meta.url);
      for (const [path, expected] of Object.entries(manifest.files)) {
        const actual = createHash("sha256")
          .update(readFileSync(new URL(`${encoderModel}/${path}`, root)))
          .digest("hex");
        if (actual !== expected)
          throw new Error("Local encoder artifact hash mismatch");
      }
      env.allowRemoteModels = false;
      env.localModelPath = fileURLToPath(root);
      return pipeline("feature-extraction", encoderModel, {
        dtype: "q8",
        device: "cpu",
      });
    })().catch((e) => {
      ready = undefined;
      throw e;
    });
  const key = hash(input);
  if (!cache.has(key)) {
    if (cache.size > 256) cache.delete(cache.keys().next().value!);
    cache.set(
      key,
      (async () => {
        const encode = await ready;
        const result = await encode(input, {
          pooling: "mean",
          normalize: true,
        });
        const values = Array.from(result.data) as number[];
        if (values.length !== 384 || values.some((v) => !Number.isFinite(v)))
          throw new Error("Invalid encoder output");
        return values;
      })().catch((e) => {
        cache.delete(key);
        throw e;
      }),
    );
  }
  return cache.get(key)!;
}
