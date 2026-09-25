import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {retrieve,decision,memoryAt} from '../docs/design/lab/logic.mjs';
const data=JSON.parse(readFileSync(new URL('../docs/design/lab/space.json',import.meta.url)));
assert.equal(data.records.length,126);assert.equal(data.queries.length,6);
for(const row of [...data.records,...data.queries]){
  assert.equal(row.vector.length,384);assert.ok(row.vector.every(Number.isFinite));
  assert.ok(Math.abs(row.vector.reduce((s,v)=>s+v*v,0)-1)<1e-6);
  assert.equal(row.position.length,3);assert.ok(row.position.every(Number.isFinite));
}
const nearest=id=>retrieve(data.records,data.queries.find(q=>q.id===id))[0].category;
assert.equal(nearest('daniel-base'),'recovery');assert.equal(nearest('daniel-incident'),'incident');
assert.equal(nearest('sam-base'),'activation');assert.equal(nearest('maya-incident'),'rhythm');
assert.equal(decision('maya',true).affected,false);assert.equal(decision('sam',true).affected,true);
assert.match(memoryAt(4).promise,/outstanding/);assert.match(memoryAt(5).promise,/fulfilled/);assert.match(memoryAt(5).case,/Aisha/);assert.match(memoryAt(6).case,/Closed/);
console.log('Verified 132 real 384D unit vectors, retrieval shifts, scope guards and time-bounded memory.');

// The integrated atlas clusters one vector per episode, not its three formulations.
assert.equal(data.episodes?.length,42);
assert.equal(data.clusters?.length,5);
assert.equal(new Set(data.episodes.flatMap(e=>e.recordIds)).size,126);
for(const episode of data.episodes){
  const rows=episode.recordIds.map(id=>data.records.find(r=>r.id===id));
  assert.equal(rows.length,3);assert.ok(rows.every(Boolean));
  const mean=rows[0].vector.map((_,i)=>rows.reduce((s,r)=>s+r.vector[i],0)/rows.length);
  const norm=Math.hypot(...mean);
  assert.ok(episode.vector.every((v,i)=>Math.abs(v-mean[i]/norm)<1e-7));
  assert.equal(episode.position.length,3);assert.ok(episode.position.every(Number.isFinite));
  const scores=data.clusters.map(c=>c.vector.reduce((s,v,i)=>s+v*episode.vector[i],0));
  assert.equal(episode.clusterId,data.clusters[scores.indexOf(Math.max(...scores))].id);
}
for(const group of data.clusters){
  assert.ok(data.episodes.some(e=>e.clusterId===group.id));
  assert.equal(group.size,data.episodes.filter(e=>e.clusterId===group.id).length);
}
assert.equal(retrieve(data.episodes,data.queries.find(q=>q.id==='sam-base'))[0].category,'activation');
assert.equal(retrieve(data.episodes,data.queries.find(q=>q.id==='maya-base'))[0].category,'rhythm');
console.log('Verified 42 deduplicated episode vectors and five cosine-space clusters; categories do not drive membership.');
