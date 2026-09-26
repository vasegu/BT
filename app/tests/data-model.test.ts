import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFixture, type HouseholdFixture, type FixtureEvent } from '../server/data-model.ts';
export function fixture(): HouseholdFixture {
  return { datasetVersion:'test', seed:1, scenarioStart:'2026-09-25T19:45:00Z', timeZone:'Europe/London', variant:'canonical',
    tables: {
      'customer.people':[{id:'p',name:'Fictional customer'}], 'customer.households':[{id:'h',label:'Household'}],
      'customer.accounts':[{id:'a',household_id:'h',reference:'A'}],
      'customer.account_roles':[{id:'r',account_id:'a',person_id:'p',role:'account_holder',valid_from:'2026-09-01T00:00:00Z',valid_to:null}],
      'operations.products':[{id:'product',name:'Broadband'}],
      'customer.services':[{id:'s',account_id:'a',household_id:'h',product_id:'product',ordered_at:'2026-09-01T00:00:00Z',activated_at:null}],
      'operations.orders':[{id:'o',service_id:'s',ordered_at:'2026-09-01T00:00:00Z',delivered_at:'2026-09-04T00:00:00Z'}],
      'operations.cases':[{id:'c',service_id:'s',opened_at:'2026-09-24T00:00:00Z'}],
      'operations.promises':[{id:'promise',case_id:'c',created_at:'2026-09-24T00:00:00Z',due_at:'2026-09-25T20:15:00Z',fulfilled_at:null}],
      'ingestion.sources':[{id:'crm',name:'CRM simulator'}]
    }, events:[] };
}
const event=(extra: Partial<FixtureEvent>={}): FixtureEvent=>({id:'e',source:'crm',sourceEventId:'E',type:'service.observed',occurredAt:'2026-09-25T10:00:00Z',knownAt:'2026-09-25T10:00:01Z',personId:'p',serviceId:'s',caseId:'c',description:'Observation',payload:{},...extra});
test('fixture rejects impossible lifecycle order and unknown linked entities',()=>{
  const f=fixture(); f.tables['customer.services'][0].activated_at='2026-08-30T00:00:00Z';
  f.tables['operations.promises'][0].case_id='missing';
  const codes=validateFixture(f).map(x=>x.code);
  assert.ok(codes.includes('lifecycle')); assert.ok(codes.includes('foreign_key'));
});
test('statements and relationship membership do not grant account authority',()=>{
  const f=fixture(); f.tables['customer.account_roles'][0].role='household_member';
  f.tables['customer.contact_permissions']=[{id:'permission',person_id:'p',account_id:'a',purpose:'service',channel:'in_app',allowed:true,valid_from:'2026-09-02T00:00:00Z',valid_to:null}];
  assert.ok(validateFixture(f).some(x=>x.code==='authority'));
});
test('events validate source scope, delayed knowledge and evidence for claims',()=>{
  const f=fixture(); f.events=[event({serviceId:'other',knownAt:'2026-09-24T00:00:00Z'}),event({id:'e2',sourceEventId:'E2',type:'pattern.recorded',payload:{sampleSize:26}})];
  const codes=validateFixture(f).map(x=>x.code);
  assert.ok(codes.includes('foreign_key')); assert.ok(codes.includes('time')); assert.ok(codes.includes('unsupported_pattern'));
});
test('identical delivery is idempotent but conflicting source keys and orphan fulfilments fail',()=>{
  const f=fixture(); f.events=[event(),event()]; assert.deepEqual(validateFixture(f),[]);
  f.events[1]={...event(),description:'Different record under the same source key'};
  assert.ok(validateFixture(f).some(x=>x.code==='source_conflict'));
  f.events=[event({type:'promise.fulfilled',payload:{promiseId:'missing'}})];
  assert.ok(validateFixture(f).some(x=>x.code==='foreign_key'));
});
test('valid records retain a later known-at time without pretending timely receipt',()=>{
  const f=fixture(); f.events=[event({knownAt:'2026-09-26T00:00:00Z'})]; assert.deepEqual(validateFixture(f),[]);
});
