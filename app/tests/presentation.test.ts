import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, steps } from '../server/engine.ts';
import { presentationBeats, presentationCursor, panelSnapshot, householdOutcome } from '../src/presentation.ts';
import type { Snapshot } from '../src/types.ts';
async function replay() {
  const engine = new Engine(':memory:');
  try {
    const session = engine.createSession(); const result=[engine.snapshot(session.id)];
    for (const [i,step] of steps.entries()) { engine.advance(session.id,step,`present-${i}`,i); await engine.processJobs(); result.push(engine.snapshot(session.id)); }
    return result;
  } finally { engine.close(); }
}
test('every recorded chapter gives each household a turn and a comparison without future proof', async()=>{
  for(const s of await replay()) {
    const beats=presentationBeats(s);
    assert.deepEqual([...new Set(beats.map(b=>b.person).filter(Boolean))].sort(),['daniel','maya','sam']);
    assert.equal(beats.at(-1)?.kind,'comparison');
    for(const b of beats) for(const id of b.evidenceIds) assert.ok(s.events.some(e=>e.id===id && e.revision<=s.cutoff),id);
  }
});
test('a pending or failed revision cannot borrow the previous decision for its presentation',async()=>{
  const s=(await replay())[2];
  for(const status of [{pendingJobs:1,failedJobs:0},{pendingJobs:0,failedJobs:1}]) {
    const beats=presentationBeats({...s,...status});
    assert.equal(beats.length,1); assert.equal(beats[0].kind,'waiting');
  }
});
test('the phone keeps the prior state until its beat; navigation is read-only and scoped to session',async()=>{
  const run=await replay(); const s=run[1], before=run[0], copy=JSON.stringify(s), beats=presentationBeats(s);
  const phone=beats.findIndex(b=>b.person==='daniel'&&b.panel==='phone');
  assert.ok(phone>0);
  assert.equal(panelSnapshot(s,before,beats,phone-1,'phone','daniel'),before);
  assert.equal(panelSnapshot(s,before,beats,phone,'phone','daniel'),s);
  assert.equal(panelSnapshot(s,{...before,session:{...before.session,id:'other'}},beats,0,'phone','daniel'),null);
  assert.equal(JSON.stringify(s),copy);
  assert.equal(presentationCursor(beats,'maya','invalid'),beats.findIndex(b=>b.person==='maya'));
  assert.equal(presentationCursor(beats,'sam','999'),beats.length-1);
});
test('the final comparison keeps three proof types separate and preserves unresolved legacy activation',async()=>{
  const run=await replay();
  assert.match(householdOutcome(run[3],'daniel').detail,/outstanding/);
  assert.match(householdOutcome(run[3],'maya').detail,/0 .*messages/);
  assert.equal(householdOutcome(run[5],'sam').state,'met');
  const legacy=structuredClone(run[5]);
  legacy.households[1].firstUseObserved=false;
  legacy.operations.outcomes=legacy.operations.outcomes.filter(o=>o.person!=='sam');
  assert.equal(householdOutcome(legacy,'sam').state,'waiting');
});
