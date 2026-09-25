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
