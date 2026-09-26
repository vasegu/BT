"""Small replay atlas: real PCA and cosine clusters; no synthetic point expansion."""
import sys
import json
import numpy as np
dimensions = 3 if "--3d" in sys.argv else 2
vectors = np.asarray(json.load(sys.stdin), dtype=np.float64)
if not len(vectors):
    print(json.dumps(dict(points=[], variance=[0, 0], clusters=0, uniqueInputs=0)))
    sys.exit()
if vectors.ndim != 2 or not np.isfinite(vectors).all():
    raise ValueError('Invalid vectors')
norms = np.linalg.norm(vectors, axis=1, keepdims=True)
if np.any(norms == 0):
    raise ValueError('Zero vector')
vectors = vectors / norms
unique, inverse = np.unique(np.round(vectors, 8), axis=0, return_inverse=True)
centered = unique - unique.mean(axis=0)
_, singular, basis = np.linalg.svd(centered, full_matrices=False)
axes = basis[:dimensions].copy()
for axis in axes:
    if axis[np.abs(axis).argmax()] < 0:
        axis *= -1
positions = centered @ axes.T
if positions.shape[1] < dimensions:
    positions = np.pad(positions, ((0, 0), (0, dimensions - positions.shape[1])))
variance = np.zeros(dimensions)
if (singular**2).sum() > 1e-14:
    variance[:len(axes)] = singular[:dimensions]**2 / (singular**2).sum()
# Deterministic farthest-first cosine centres; up to three groups in this small replay.
k = min(3, len(unique))
centers = [unique[0]]
for _ in range(1, k):
    centers.append(unique[np.argmin((unique @ np.array(centers).T).max(axis=1))])
centers = np.array(centers)
for _ in range(60):
    labels = (unique @ centers.T).argmax(axis=1)
    updated = np.array([unique[labels == j].mean(axis=0) if np.any(labels == j) else centers[j] for j in range(k)])
    updated /= np.maximum(np.linalg.norm(updated, axis=1, keepdims=True), 1e-12)
    if np.allclose(updated, centers, atol=1e-8):
        centers = updated
        break
    centers = updated
labels = (unique @ centers.T).argmax(axis=1)
cosines = np.clip(vectors @ vectors.T, -1, 1)
points = []
for i, group in enumerate(inverse):
    neighbours = sorted((j for j in range(len(vectors)) if j != i), key=lambda j: (-cosines[i,j],j))[:3]
    points.append(dict(position=np.round(positions[group],8).tolist(), cluster=int(labels[group]),
        neighbours=[dict(index=int(j), similarity=round(float(cosines[i,j]),6)) for j in neighbours]))
print(json.dumps(dict(points=points, variance=np.round(variance,8).tolist(), clusters=len(set(labels.tolist())), uniqueInputs=len(unique))))
