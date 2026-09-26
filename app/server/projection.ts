import { Matrix, SingularValueDecomposition } from "ml-matrix";

// Same small-corpus PCA and spherical clustering as the local Python view.
// A Node implementation keeps the live atlas available in Vercel Functions.
export async function projectVectors(input: number[][], dimensions = 2) {
  if (!input.length)
    return {
      points: [],
      variance: Array(dimensions).fill(0),
      clusters: 0,
      uniqueInputs: 0,
    };
  const width = input[0].length;
  const unit = (row: number[]) => {
    const n = Math.hypot(...row);
    if (!n) throw new Error("Zero vector");
    return row.map((v) => v / n);
  };
  const dot = (a: number[], b: number[]) =>
    a.reduce((s, v, i) => s + v * b[i], 0);
  if (
    !width ||
    input.some((r) => r.length !== width || r.some((v) => !Number.isFinite(v)))
  )
    throw new Error("Invalid vectors");
  const vectors = input.map(unit),
    keys = vectors.map((r) => r.map((v) => Number(v.toFixed(8))).join(","));
  const uniqueKeys = [...new Set(keys)].sort((a, b) => {
    const x = a.split(",").map(Number),
      y = b.split(",").map(Number);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  });
  const unique = uniqueKeys.map((k) => k.split(",").map(Number));
  const mean = Array.from(
    { length: width },
    (_, j) => unique.reduce((s, r) => s + r[j], 0) / unique.length,
  );
  const centered = unique.map((r) => r.map((v, j) => v - mean[j]));
  const svd = new SingularValueDecomposition(new Matrix(centered), {
    autoTranspose: true,
  });
  const axes = Array.from(
    { length: Math.min(dimensions, svd.rightSingularVectors.columns) },
    (_, i) => {
      const axis = svd.rightSingularVectors.getColumn(i),
        peak = axis.reduce(
          (best, v, j) => (Math.abs(v) > Math.abs(axis[best]) ? j : best),
          0,
        );
      return axis.map((v) => v * (axis[peak] < 0 ? -1 : 1));
    },
  );
  const total = svd.diagonal.reduce((s, v) => s + v * v, 0);
  const variance = Array.from({ length: dimensions }, (_, i) =>
    total > 1e-14 ? (svd.diagonal[i] || 0) ** 2 / total : 0,
  );
  const positions = centered.map((row) =>
    Array.from({ length: dimensions }, (_, i) =>
      axes[i] ? dot(row, axes[i]) : 0,
    ),
  );
  const k = Math.min(3, unique.length),
    centers = [unique[0]];
  while (centers.length < k)
    centers.push(
      unique.reduce(
        (best, row) =>
          Math.max(...centers.map((c) => dot(row, c))) <
          Math.max(...centers.map((c) => dot(best, c)))
            ? row
            : best,
        unique[0],
      ),
    );
  const label = (row: number[]) =>
    centers.reduce(
      (best, c, j) => (dot(row, c) > dot(row, centers[best]) ? j : best),
      0,
    );
  for (let n = 0; n < 60; n++) {
    const labels = unique.map(label);
    const updated = centers.map((c, j) => {
      const rows = unique.filter((_, i) => labels[i] === j);
      if (!rows.length) return c;
      const sum = c.map((_, i) => rows.reduce((s, r) => s + r[i], 0));
      return Math.hypot(...sum) > 1e-12 ? unit(sum) : c;
    });
    const stable = updated.every((c, j) =>
      c.every((v, i) => Math.abs(v - centers[j][i]) < 1e-8),
    );
    centers.splice(0, centers.length, ...updated);
    if (stable) break;
  }
  const labels = unique.map(label);
  const points = vectors.map((row, i) => {
    const group = uniqueKeys.indexOf(keys[i]);
    return {
      position: positions[group],
      cluster: labels[group],
      neighbours: vectors
        .map((r, index) => ({
          index,
          similarity: Math.max(-1, Math.min(1, dot(row, r))),
        }))
        .filter((x) => x.index !== i)
        .sort((a, b) => b.similarity - a.similarity || a.index - b.index)
        .slice(0, 3),
    };
  });
  return {
    points,
    variance,
    clusters: new Set(labels).size,
    uniqueInputs: unique.length,
  };
}
