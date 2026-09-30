import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateHistory} from '../../scripts/generate-bt-history.ts';
import {buildContext} from '../server/context.ts';
import {clocks} from '../server/engine.ts';
import {arbitrate} from '../server/arbiter.ts';
import {eveContext,voiceBrief} from '../server/eve.ts';
import type {Snapshot,PersonId} from '../src/types.ts';
const f=generateHistory();
const snapshots=clocks.map((clock,cutoff)=>{
 const contexts=(['daniel','sam','maya'] as PersonId[]).map(alias=>buildContext({fixture:f,sessionId:'eve-matrix',personId:f.tables['customer.people'].find(p=>p.alias===alias)!.id,serviceId:f.tables['customer.services'].find(s=>s.reference===`svc_${alias}_broadband`)!.id,cutoff:clock,purpose:'service'}));
 const s={session:{id:'eve-matrix',seedVersion:f.datasetVersion,revision:8,step:8,createdAt:clocks[0]},clock,cutoff,historical:cutoff<8,pendingJobs:0,failedJobs:0,households:contexts.map(c=>c.household),events:[...new Map(contexts.flatMap(c=>c.evidence).map(e=>[e.id,e])).values()],decisions:[],actions:[],operations:{...contexts[0].operations,outcomes:[]},nextStep:null} as Snapshot;
 if(cutoff)s.decisions=s.households.map(h=>arbitrate(h,h,s));
 return s;
});
test('all 27 Eve projections respect persona, occurrence/receipt time and voice append budget',()=>{
 for(const s of snapshots)for(const h of s.households){
  const c=eveContext(s,h.id),text=JSON.stringify(c);
  for(const other of s.households.filter(o=>o.id!==h.id)){assert.ok(!text.includes(other.name),`${h.id}/${s.cutoff}: ${other.name}`);assert.ok(!text.includes(other.serviceId));}
  for(const r of [...c.records,...c.sharedRecords]){assert.ok(Date.parse(r.time)<=Date.parse(s.clock));assert.ok(Date.parse(r.receivedAt)<=Date.parse(s.clock));}
  assert.ok(voiceBrief(c).length<=1000);
  for(const d of c.customer.profile?.devices??[])assert.ok(Date.parse(d.since)<=Date.parse(s.clock));
  if(s.cutoff<3)assert.equal(c.customer.restored,false);
  if(h.id==='daniel'){assert.equal(c.customer.promiseFulfilled,s.cutoff>=4);assert.equal(c.customer.confirmed,s.cutoff>=5);}
  if(h.id==='maya')assert.ok(!c.sharedRecords.some(r=>r.type==='incident.cleared'));
 }
});
test('future or late-received personal/shared records are excluded at the Eve boundary',()=>{
 const s=structuredClone(snapshots[1]),h=s.households[0],known=h.evidence[0];
 h.evidence.push({...known,id:'future',description:'FUTURE SECRET',occurredAt:clocks[8]},{...known,id:'late',description:'LATE SECRET',receivedAt:clocks[8]});
 assert.doesNotMatch(JSON.stringify(eveContext(s,h.id)),/FUTURE SECRET|LATE SECRET/);
});
