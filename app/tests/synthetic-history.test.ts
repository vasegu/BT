import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateHistory } from '../../scripts/generate-bt-history.ts';
import { validateFixture } from '../server/data-model.ts';
test('three connected histories are deterministic and contain sourced observations',()=>{
 const a=generateHistory(),b=generateHistory(); assert.deepEqual(a,b); assert.deepEqual(validateFixture(a),[]);
 assert.equal(a.tables['customer.households'].length,3); assert.ok(a.events.length>=2000&&a.events.length<=6000);
 assert.ok(a.tables['operations.messages'].length>=10); assert.ok(a.tables['operations.diagnostics'].length>=3);
 const sam=a.tables['customer.people'].find(p=>p.alias==='sam')!;
 assert.ok(a.events.filter(e=>e.personId===sam.id&&e.type.startsWith('router.')).every(e=>e.occurredAt>='2026-09-18T10:00:00Z'));
 const maya=a.tables['customer.people'].find(p=>p.alias==='maya')!;
 const nights=a.events.filter(e=>e.personId===maya.id&&e.type==='router.overnight_window'&&e.occurredAt>='2026-08-29T00:00:00Z');
 assert.equal(nights.length,28); assert.equal(nights.filter(e=>e.payload.returnObserved===true).length,26);
 assert.ok(nights.every(e=>Array.isArray(e.payload.evidenceIds)&&e.payload.evidenceIds.length));
});
test('variants change observations without rewriting canonical history or granting identity claims authority',()=>{
 const base=generateHistory();
 for(const variant of ['late-diagnostic','duplicate-delivery','corrected-scope','revoked-contact','slot-conflict','unmet-promise','gamer-claim','recurrent-failure']) {
   const f=generateHistory({variant}); assert.deepEqual(validateFixture(f),[],variant);
   assert.notDeepEqual(f.events,base.events,variant);
 }
 const late=generateHistory({variant:'late-diagnostic'}).events.find(e=>e.sourceEventId==='daniel-restart')!;
 assert.equal(late.occurredAt,'2026-09-25T19:20:00Z'); assert.equal(late.knownAt,'2026-09-25T20:04:00Z');
 assert.equal(generateHistory({variant:'unmet-promise'}).events.filter(e=>e.type==='promise.fulfilled').length,0);
 const gamer=generateHistory({variant:'gamer-claim'}); assert.deepEqual(gamer.tables['customer.contact_permissions'],base.tables['customer.contact_permissions']);
});
