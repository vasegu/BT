import { test } from "node:test";
import assert from "node:assert/strict";
import { requestOriginAllowed } from "../server/hosting.ts";
import { projectVectors } from "../server/projection.ts";
test("hosting permits same-origin presenter requests without trusting arbitrary hostnames", () => {
  assert.equal(
    requestOriginAllowed("http://localhost:5185", "localhost:5186", false),
    true,
  );
  assert.equal(
    requestOriginAllowed(
      "https://bt-example.vercel.app",
      "bt-example.vercel.app",
      true,
    ),
    true,
  );
  assert.equal(
    requestOriginAllowed("https://evil.example", "bt-example.vercel.app", true),
    false,
  );
  assert.equal(
    requestOriginAllowed(
      "http://bt-example.vercel.app",
      "bt-example.vercel.app",
      true,
    ),
    false,
  );
});
test("Node projection retains geometry and duplicate identity without Python", async () => {
  const p = await projectVectors(
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ],
    3,
  );
  assert.deepEqual(p.points[0].position, p.points[3].position);
  assert.ok(
    Math.abs(
      Math.hypot(
        ...p.points[0].position.map((v, i) => v - p.points[1].position[i]),
      ) - Math.SQRT2,
    ) < 1e-6,
  );
  assert.equal(p.uniqueInputs, 3);
  assert.ok(Math.abs(p.variance.reduce((a, b) => a + b, 0) - 1) < 1e-6);
  await assert.rejects(() => projectVectors([[0, 0, 0]]));
});
