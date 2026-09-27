// Chart geometry for the Hodoscope-style context map.
// Ported from ecd_jio_cx ui/src/components/dashboards/agentHealth/specs.js so the
// density bands, ticks and diverging scale read the same way as the Jio action map.
import { contours } from "d3-contour";
import { geoPath } from "d3-geo";

export const GRID_W = 100;
export const GRID_H = 100;
export const CONTOUR_LEVELS = [0.1, 0.22, 0.38, 0.55, 0.72, 0.88];
export const CONTOUR_ALPHAS = [0.06, 0.1, 0.16, 0.24, 0.34, 0.46];
export const DIFF_LEVELS = [-0.85, -0.6, -0.35, -0.15, 0.15, 0.35, 0.6, 0.85];

export function niceTicks(min: number, max: number, count = 6) {
  const span = max - min;
  if (span <= 0) return [min];
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export function gaussianKDE(
  points: { x: number; y: number }[],
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
  bandwidth: number,
) {
  // Grid value [i,j] is the density at the centre of cell (i,j), matching d3-contour.
  const dx = (xmax - xmin) / GRID_W,
    dy = (ymax - ymin) / GRID_H;
  const grid = new Float32Array(GRID_W * GRID_H);
  if (!points.length) return grid;
  const inv2h2 = 1 / (2 * bandwidth * bandwidth);
  const rx = Math.max(2, Math.ceil((3 * bandwidth) / dx)),
    ry = Math.max(2, Math.ceil((3 * bandwidth) / dy));
  for (const p of points) {
    const cx = Math.min(GRID_W - 1, Math.max(0, Math.floor((p.x - xmin) / dx)));
    const cy = Math.min(GRID_H - 1, Math.max(0, Math.floor((p.y - ymin) / dy)));
    for (let j = Math.max(0, cy - ry); j <= Math.min(GRID_H - 1, cy + ry); j++) {
      const py = ymin + (j + 0.5) * dy;
      for (let i = Math.max(0, cx - rx); i <= Math.min(GRID_W - 1, cx + rx); i++) {
        const px = xmin + (i + 0.5) * dx;
        grid[j * GRID_W + i] += Math.exp(-((px - p.x) ** 2 + (py - p.y) ** 2) * inv2h2);
      }
    }
  }
  let sum = 0;
  for (const v of grid) sum += v;
  if (sum > 0) {
    const n = 1 / (sum * dx * dy);
    for (let k = 0; k < grid.length; k++) grid[k] *= n;
  }
  return grid;
}

/** t in [-1, 1]: rose for over-represented, blue for under, near-white at 0 (app palette). */
export function divergingColor(t: number) {
  const a = Math.min(1, Math.abs(t));
  const mix = (from: number[], to: number[]) => `rgb(${from.map((v, i) => Math.round(v + (to[i] - v) * a)).join(",")})`;
  return t >= 0 ? mix([250, 246, 248], [194, 65, 107]) : mix([246, 248, 252], [42, 120, 214]);
}

export function makeContourPaths(
  grid: Float32Array,
  levels: number[],
  mapToPlot: (gi: number, gj: number) => [number, number],
) {
  const path = geoPath();
  return contours()
    .size([GRID_W, GRID_H])
    .thresholds(levels)(Array.from(grid))
    .map((poly) => ({
      value: poly.value,
      d:
        path({
          ...poly,
          coordinates: poly.coordinates.map((rings) => rings.map((ring) => ring.map(([gi, gj]) => mapToPlot(gi, gj)))),
        } as never) || "",
    }));
}
