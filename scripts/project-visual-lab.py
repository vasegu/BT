"""Deterministic PCA fitted only to historical documents, then transform queries."""
from pathlib import Path
import json
import numpy as np
path=Path(__file__).resolve().parents[1]/'docs/design/lab/space.json'
data=json.loads(path.read_text())
x=np.array([r['vector'] for r in data['records']],dtype=np.float64)
mean=x.mean(axis=0)
_,singular,axes=np.linalg.svd(x-mean,full_matrices=False)
basis=axes[:3].copy()
# Resolve arbitrary PCA signs deterministically.
for axis in basis:
 if axis[np.abs(axis).argmax()]<0:axis*=-1
for row in data['records']+data['queries']:
 row['position']=np.round((np.array(row['vector'])-mean)@basis.T,8).tolist()
data['manifest']['projection']={'method':'PCA / SVD','fit':'Historical documents only; query vectors transformed using the same fitted basis.','dimensions':3,'explainedVariance':np.round(singular[:3]**2/(singular**2).sum(),8).tolist(),'meaning':'Lossy projection coordinates, not behavioural axes. Neighbours are ranked in the original 384 dimensions.','numpy':np.__version__}
# Collapse the three authored formulations before clustering; labels never enter the fit.
groups={}
for row in data['records']:
 groups.setdefault(row['id'][:-1],[]).append(row)
episodes=[]
for ident,rows in groups.items():
 assert len(rows)==3, f'Expected three formulations for {ident}'
 vector=np.array([r['vector'] for r in rows]).mean(axis=0)
 vector/=np.linalg.norm(vector)
 episodes.append({**{k:rows[0][k] for k in ['title','text','category']},'id':ident,
   'recordIds':[r['id'] for r in rows], 'vector':np.round(vector,8).tolist(),
   'position':np.round((vector-mean)@basis.T,8).tolist()})
vectors=np.array([r['vector'] for r in episodes])
best=None
for seed in range(24):
 centers=vectors[np.random.default_rng(seed).choice(len(vectors),5,replace=False)].copy()
 for iteration in range(80):
  labels=(vectors@centers.T).argmax(axis=1)
  updated=np.array([vectors[labels==j].mean(axis=0) if np.any(labels==j)
    else vectors[np.argmin((vectors@centers.T).max(axis=1))] for j in range(5)])
  updated/=np.linalg.norm(updated,axis=1,keepdims=True)
  if np.allclose(updated,centers,atol=1e-10,rtol=0):break
  centers=updated
 labels=(vectors@centers.T).argmax(axis=1)
 objective=np.sum(vectors*centers[labels])
 if best is None or objective>best[0]:best=(objective,labels,centers,seed)
_,labels,centers,seed=best
# Editorial names assigned after inspecting membership. Anchors name groups, not their members.
anchors=[('EP-402','Routines & watch','#527f7b'),('EP-301','Service context','#8568af'),
 ('EP-201','Getting connected','#597da1'),('EP-701','Promises & permission','#9a7494'),
 ('EP-501','Money & plans','#9a875c')]
clusters=[]
for anchor,label,color in anchors:
 group=int(labels[next(i for i,r in enumerate(episodes) if r['id']==anchor)])
 ident=f'cluster-{group}'
 assert ident not in [c['id'] for c in clusters], 'Editorial anchors need review after corpus changes'
 clusters.append({'id':ident,'label':label,'color':color,'size':int(sum(labels==group)),
   'vector':np.round(centers[group],8).tolist()})
for row,group in zip(episodes,labels):row['clusterId']=f'cluster-{group}'
dist=np.maximum(0,1-vectors@vectors.T)
silhouette=[]
for i in range(len(vectors)):
 own=np.flatnonzero(labels==labels[i]);own=own[own!=i]
 if not len(own):silhouette.append(0);continue
 a=dist[i,own].mean();b=min(dist[i,labels==j].mean() for j in range(5) if j!=labels[i])
 silhouette.append((b-a)/max(a,b))
data['episodes']=episodes;data['clusters']=clusters
data['manifest']['clustering']={'method':'Spherical k-means / cosine similarity / 384D',
 'groups':5,'seed':seed,'starts':24,'cosineSilhouette':round(float(np.mean(silhouette)),6),
 'aggregation':'Unit-normalised mean of three formulations for each of 42 authored episode motifs.',
 'labels':'Editorial names assigned after clustering. Categories and query vectors do not influence membership.',
 'limits':'Overlapping groups in a small synthetic corpus; not customer segments or calibrated confidence.'}
path.write_text(json.dumps(data,separators=(',',':')))
print('PCA variance:', data['manifest']['projection']['explainedVariance'])
