import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewExamples} from '../src/review-examples.ts';
const data=JSON.parse(readFileSync(new URL('../public/context-sway.json',import.meta.url),'utf8'));
test('guided comparisons use actual paired contexts with exactly one change',()=>{
 const examples=reviewExamples(data);assert.equal(examples.length,2);
 for(const e of examples){const a=data.points.find((p:any)=>p.id===e.baselineId),b=data.points.find((p:any)=>p.id===e.variantId);assert.equal(a.person,b.person);assert.equal(a.revision,b.revision);assert.equal(b.flips.length,1);if(e.expected==='invariant')assert.equal(a.action,b.action);else assert.notEqual(a.action,b.action);}
 assert.deepEqual(reviewExamples({...data,points:[]}),[]);
});
