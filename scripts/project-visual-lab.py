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
path.write_text(json.dumps(data,separators=(',',':')))
print('PCA variance:', data['manifest']['projection']['explainedVariance'])
