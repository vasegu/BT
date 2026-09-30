import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, steps } from '../server/engine.ts';
import { decisionContext } from '../src/decision-context.ts';

test('decision context cites scoped, dated evidence and a recorded alternative', async () => {
 const e = new Engine(':memory:');
 try {
  const s=e.createSession(); e.advance(s.id,steps[0],'context',0); await e.processJobs();
  const snap=e.snapshot(s.id), result=decisionContext(snap,'daniel');
  assert.ok(result.action); assert.ok(result.facts.length<=3);
  assert.ok(result.facts.some(f=>/promise|call|restart/i.test(f.text)));
  const h=snap.households.find(h=>h.id==='daniel')!;
  for(const f of result.facts) for(const id of f.evidenceIds) assert.ok(h.evidence.some(e=>e.id===id));
  const copy=structuredClone(snap);
  copy.households.find(h=>h.id==='daniel')!.evidence.forEach(e=>{e.receivedAt='2030-01-01T00:00:00Z'});
  assert.equal(decisionContext(copy,'daniel').facts.length,0);
  assert.ok(decisionContext(copy,'daniel').limitation);
  copy.decisions=[];
  assert.equal(decisionContext(copy,'daniel').alternative,null);
  assert.equal(decisionContext(copy,'daniel').action,null);
 } finally { e.close(); }
});

test('approval belongs to authority evidence and outside-scope incidents cannot displace personal telemetry', async()=>{
 const e=new Engine(':memory:');
 try {
 const s=e.createSession();for(const [i,step] of steps.entries()){e.advance(s.id,step,`scope-${i}`,i);await e.processJobs();}
 const snapshot=e.snapshot(s.id,3), h=snapshot.households.find(h=>h.id==='maya')!;
 const result=decisionContext(snapshot,'maya');
 assert.ok(!result.facts.some(f=>f.domain==='operations'&&/INC-017/.test(f.text)));
 const d=snapshot.decisions.filter(d=>d.person==='maya').at(-1)!;
 const record={id:'approved',sessionId:s.id,revision:3,occurredAt:d.time,receivedAt:d.time,source:'policy',subject:'maya' as const,type:'policy.offer_approved',description:'Offer approval recorded',payload:{}};
 h.evidence.push(record);d.evidenceIds.push(record.id);
 assert.ok(decisionContext(snapshot,'maya').facts.some(f=>f.domain==='governance'&&f.evidenceIds.includes('approved')));
 }finally{e.close();}
});
