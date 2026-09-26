"""Upstream Hodoscope projection/export plus Jio-style density layers for BT.
Actions are typed; summaries are deterministic and embeddings computed locally.
"""
import json
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
from matplotlib import pyplot as plt
from sklearn.neighbors import KernelDensity
from hodoscope.io import write_analysis_json
from hodoscope.pipeline import viz
from hodoscope.sampling import compute_projection, compute_bandwidth

source, output = map(Path, sys.argv[1:3])
data = json.loads(source.read_text())
rows = data["summaries"]
analysis = source.with_name("evaluation.hodoscope.json")
write_analysis_json(analysis, rows,
    fields={"model": "typesafe-ai/jev", "eval": data.get("mode", "bt-context-invariance-v1"), "summary_method": "deterministic recorded behaviour", "synthetic": True},
    source=data["suiteId"], embedding_model="Xenova/all-MiniLM-L6-v2", embedding_dimensionality=384)

# Use the real Hodoscope projection. No labels, jitter or invented action samples.
xy = compute_projection(np.array([r["embedding"] for r in rows]), "pca")
span = np.maximum(np.ptp(xy, axis=0), 0.01)
lo, hi = xy.min(axis=0) - span * .35, xy.max(axis=0) + span * .35
xx, yy = np.meshgrid(np.linspace(lo[0], hi[0], 80), np.linspace(lo[1], hi[1], 80))
grid = np.c_[xx.ravel(), yy.ravel()]
bandwidth = compute_bandwidth(xy)
def density(indices):
    kde = KernelDensity(bandwidth=bandwidth).fit(xy[indices])
    return np.exp(kde.score_samples(grid)).reshape(xx.shape)
def paths(z, levels):
    fig, ax = plt.subplots()
    cs = ax.contour(xx, yy, z, levels=levels)
    result = []
    for level, segments in zip(cs.levels, cs.allsegs):
        parts = []
        for segment in segments:
            if len(segment) < 3: continue
            norm = (segment - lo) / (hi - lo)
            parts.append("M" + "L".join(f"{x:.5f},{1-y:.5f}" for x,y in norm) + "Z")
        if parts: result.append({"level":float(level), "path":"".join(parts)})
    plt.close(fig)
    return result
group_key = data.get("groupBy", "person")
people = sorted({r["metadata"][group_key] for r in rows})
groups = []
for person in people:
    d = density([i for i,r in enumerate(rows) if r["metadata"][group_key] == person])
    groups.append({"person":person,"paths":paths(d / d.max(), [.1,.22,.38,.55,.72,.88])})
diffs = {}
if data.get("mode") != "recorded":
    base = density([i for i,r in enumerate(rows) if r["metadata"]["variant"] == "baseline"])
    for variant in ["gamer", "paraphrase", "upsell"]:
        delta = density([i for i,r in enumerate(rows) if r["metadata"]["variant"] == variant]) - base
        scale = max(float(base.max()), 1e-12)
        delta = delta / scale
        peak = float(np.abs(delta).max())
        diffs[variant] = {"peak":peak,"paths":paths(delta,[-.75,-.4,-.15,.15,.4,.75]) if peak > .15 else []}
points = [{"id":r["trajectory_id"],"position":((xy[i]-lo)/(hi-lo)).tolist(),"summary":r["summary"],**r["metadata"]} for i,r in enumerate(rows)]
source.with_name("projection.json").write_text(json.dumps({"points":points,"groups":groups,"diffs":diffs,"bandwidth":float(bandwidth),"projection":"Hodoscope 0.2.4 · PCA", "dimensions":384}))
viz((str(analysis),), group_by=data.get("nativeGroupBy", "variant"), proj=["pca"], output_file=str(output))
