import { contours } from "d3-contour";
import { projectVectors } from "./projection.ts";
import type { EvalMap } from "../src/EvalActionMap.tsx";
import type { ReviewRecord } from "../src/agent-review-types.ts";

export async function hostedReviewMap(
  runs: ReviewRecord[],
  vectors: number[][],
): Promise<EvalMap> {
  const projected = await projectVectors(vectors),
    xy = projected.points.map((p) => p.position);
  const bounds = [0, 1].map((axis) => {
    const values = xy.map((p) => p[axis]),
      min = Math.min(...values),
      span = Math.max(0.01, Math.max(...values) - min);
    return { lo: min - span * 0.35, span: span * 1.7 };
  });
  const points = runs.map((r, i) => ({
    id: r.id,
    position: xy[i].map((v, a) => (v - bounds[a].lo) / bounds[a].span),
    summary: r.responseText,
    person: r.person,
    variant: r.selectedAction,
    repeat: r.revision,
    model_choice: r.modelChoice || "rules",
    governed_choice: r.selectedAction,
    cluster: `cluster_${projected.points[i].cluster}`,
  }));
  const size = 64,
    bandwidth = 0.1;
  const groups = [...new Set(points.map((p) => p.cluster))].map((person) => {
    const members = points.filter((p) => p.cluster === person);
    const density = Array.from({ length: size * size }, (_, i) =>
      members.reduce(
        (sum, p) =>
          sum +
          Math.exp(
            -(
              ((i % size) / size - p.position[0]) ** 2 +
              (Math.floor(i / size) / size - p.position[1]) ** 2
            ) /
              (2 * bandwidth ** 2),
          ),
        0,
      ),
    );
    const peak = Math.max(...density);
    const shapes = contours()
      .size([size, size])
      .thresholds([0.1, 0.22, 0.38, 0.55, 0.72, 0.88])(
      density.map((v) => v / peak),
    );
    return {
      person,
      paths: shapes.map((c) => ({
        level: c.value,
        path: c.coordinates
          .flatMap((polygon) =>
            polygon.map(
              (ring) =>
                "M" +
                ring
                  .map(
                    ([x, y]) =>
                      `${(x / size).toFixed(5)},${(1 - y / size).toFixed(5)}`,
                  )
                  .join("L") +
                "Z",
            ),
          )
          .join(""),
      })),
    };
  });
  return {
    points,
    groups,
    diffs: {},
    bandwidth,
    projection:
      "PCA / SVD · Node runtime · normalised KDE display bandwidth 0.10",
    dimensions: 384,
  };
}
