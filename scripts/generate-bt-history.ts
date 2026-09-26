import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateFixture, type HouseholdFixture, type FixtureEvent, type Row } from '../app/server/data-model.ts';
const stories=JSON.parse(readFileSync(new URL('../fixtures/bt-households/v1/stories.json',import.meta.url),'utf8'));
export function stableId(key:string) { const h=createHash('sha256').update(key).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; }
const iso=(ms:number)=>new Date(ms).toISOString();
const add=(time:string,minutes:number)=>iso(Date.parse(time)+minutes*60000);
const day=(time:string)=>time.slice(0,10);
function london(date:string,hour:number) {
  const guess=Date.parse(`${date}T${String(hour).padStart(2,'0')}:00:00Z`);
  const localHour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(guess));
  return iso(guess-(localHour-hour)*3600000);
}
export function generateHistory(options: { seed?: number; datasetVersion?: string; variant?: string } = {}): HouseholdFixture {
  const seed=options.seed??stories.seed, version=options.datasetVersion??stories.datasetVersion, variant=options.variant??'canonical';
  if(!Object.hasOwn(stories.variants,variant))throw new Error('Unknown history variant');
  const f:HouseholdFixture={datasetVersion:version,seed,variant,scenarioStart:stories.scenarioStart,timeZone:'Europe/London',tables:{},events:[]};
  const id=(key:string)=>stableId(`${version}/${key}`);
  let rng=seed>>>0;
  const random=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/4294967296;};
  const put=(table:string,key:string,fields:Omit<Row,'id'>)=>{const row={id:id(key),...fields} as Row; (f.tables[table]??=[]).push(row);return row;};
  const byId=(table:string,key:string)=>f.tables[table].find(r=>r.id===id(key))!;
  for(const [key,kind] of Object.entries({crm:'care',router:'telemetry',orders:'order_management',network:'network_operations',diagnostics:'diagnostics',identity:'identity',workforce:'capacity'}))put('ingestion.sources',`source-${key}`,{name:`${key}_simulator`,system_kind:kind});
  put('operations.products','product-broadband',{name:'Fictional BT home broadband',kind:'broadband',provenance:'synthetic_catalogue'});
  const emit=(alias:string|null,key:string,type:string,time:string,description:string,payload:Record<string,unknown>={},caseKey:string|null=null,source='crm'):FixtureEvent=>{
    const e:FixtureEvent={id:id(key),source:id(`source-${source}`),sourceEventId:key,type,occurredAt:time,knownAt:add(time,0),personId:alias?id(`person-${alias}`):null,serviceId:alias?id(`service-${alias}`):null,caseId:caseKey?id(caseKey):null,description,payload,correlationId:alias?`relationship-${alias}`:'network-shared'};
    f.events.push(e);return e;
  };
  for(const p of stories.households) {
    const a=p.alias,orderRef=p.orderRef||`ORD-${a.toUpperCase()}-01`;
    put('customer.people',`person-${a}`,{alias:a,name:p.name});
    put('customer.households',`household-${a}`,{label:`${p.name.split(' ')[1]} household`});
    put('customer.household_memberships',`membership-${a}`,{person_id:id(`person-${a}`),household_id:id(`household-${a}`),valid_from:p.orderedAt,valid_to:null});
    put('customer.accounts',`account-${a}`,{household_id:id(`household-${a}`),reference:`ACC-${a.toUpperCase()}`});
    put('customer.account_roles',`role-${a}`,{person_id:id(`person-${a}`),account_id:id(`account-${a}`),role:'account_holder',valid_from:p.orderedAt,valid_to:null});
    put('customer.services',`service-${a}`,{account_id:id(`account-${a}`),household_id:id(`household-${a}`),product_id:id('product-broadband'),reference:`svc_${a}_broadband`,lifecycle:p.activatedAt?'active':'delivered',ordered_at:p.orderedAt,activated_at:p.activatedAt});
    const authority=emit(a,`${a}-authority`,'contact.authority_recorded',p.orderedAt,'Verified account holder; service updates permitted in the app.',{role:'account_holder',purpose:'service',channel:'in_app',allowed:true},null,'identity');
    put('customer.contact_permissions',`permission-${a}`,{person_id:id(`person-${a}`),account_id:id(`account-${a}`),purpose:'service',channel:'in_app',allowed:true,valid_from:p.orderedAt,valid_to:null,source_event_id:authority.id});
    const order=emit(a,`${a}-order`,'order.accepted',p.orderedAt,`Order ${orderRef} accepted. Delivery and activation are separate stages.`,{order:orderRef},null,'orders');
    const dispatched=a==='sam'?'2026-09-20T09:00:00Z':add(p.orderedAt,2*1440), delivered=a==='sam'?'2026-09-22T12:00:00Z':add(p.orderedAt,4*1440);
    emit(a,`${a}-dispatch`,'order.dispatched',dispatched,'Hub dispatched; not evidence of working service.',{order:orderRef},null,'orders');
    emit(a,`${a}-delivery`,'order.delivered',delivered,'Hub delivered. This record does not establish activation or first use.',{order:orderRef,activation:p.activatedAt?'later_confirmed':'unconfirmed'},null,'orders');
    put('operations.orders',`order-${a}`,{service_id:id(`service-${a}`),reference:orderRef,status:'delivered',ordered_at:p.orderedAt,dispatched_at:dispatched,delivered_at:delivered,source_event_id:order.id});
    if(p.activatedAt)emit(a,`${a}-activated`,'activation.confirmed',p.activatedAt,'Provisioning confirmed; a separate observation establishes successful use.',{order:orderRef},null,'orders');
    else emit(a,'sam-provisioning','activation.pending','2026-09-23T09:00:00Z','Provisioning team has not recorded activation. No successful first-use observation exists.',{status:'pending'},null,'orders');
    // Six interval summaries a day, rather than fabricated individual packet/heartbeat rows.
    const start=Math.max(Date.parse(stories.historyStart),Date.parse(p.orderedAt));
    for(let t=start;t<Date.parse('2026-09-25T16:00:00Z');t+=4*3600000) {
      const received=a==='maya'?null:p.activatedAt?240-Math.floor(random()*4):0;
      emit(a,`${a}-window-${t}`,'router.observation_window',iso(t+4*3600000),'Four-hour management observation window. Missing telemetry does not determine the physical cause.',{intervalStart:iso(t),intervalEnd:iso(t+4*3600000),expected:240,received,coverage:a==='maya'?'aggregate_unavailable':p.activatedAt?'observed':'no_telemetry',usage:null},null,'router');
    }
  }
  // Household membership alone does not authorise the account.
  put('customer.people','person-maya-guest',{alias:'maya_guest',name:'Alex Patel'});
  put('customer.household_memberships','membership-maya-guest',{person_id:id('person-maya-guest'),household_id:id('household-maya'),valid_from:'2026-03-27T00:00:00Z',valid_to:null});
  for(const key of ['shared-node','maya-node'])put('operations.assets',key,{reference:key==='shared-node'?'ACCESS-17':'ACCESS-42',kind:'fictional_access_node'});
  for(const a of ['daniel','sam','maya'])put('operations.service_dependencies',`dependency-${a}`,{service_id:id(`service-${a}`),asset_id:id(a==='maya'?'maya-node':'shared-node'),valid_from:byId('customer.services',`service-${a}`).ordered_at,valid_to:null});
  const caseRow=(alias:string,key:string,ref:string,opened:string,description:string,owner:string,closed:string|null=null)=>{
    const e=emit(alias,`${key}-opened`,'case.opened',opened,description,{caseId:ref,owner},key);
    return put('operations.cases',key,{service_id:id(`service-${alias}`),reference:ref,owner_ref:owner,status:closed?'closed':'open',description,opened_at:opened,closed_at:closed,source_event_id:e.id});
  };
  caseRow('daniel','daniel-old-case','DR-1804','2026-05-12T08:30:00Z','Earlier Wi-Fi placement issue, independently resolved in May.','Aisha','2026-05-13T12:00:00Z');
  emit('daniel','daniel-old-close','case.closed','2026-05-13T12:00:00Z','The customer confirmed the earlier Wi-Fi issue resolved after moving the hub.',{caseId:'DR-1804'},'daniel-old-case');
  caseRow('daniel','daniel-case','DR-2041','2026-09-24T17:10:00Z','Two connection drops reported. Aisha owns case DR-2041.','Aisha');
  caseRow('sam','sam-case','SM-3100','2026-09-23T09:10:00Z','Delivered hub; provisioning and successful first use still unconfirmed.','Activation team');
  const conversation=(alias:string,key:string,start:string,caseKey:string|null,messages:[string,string,string][])=>{
    put('operations.conversations',key,{person_id:id(`person-${alias}`),service_id:id(`service-${alias}`),case_id:caseKey?id(caseKey):null,channel:'web_chat',started_at:start,ended_at:add(start,messages.length),retention_basis:'Synthetic demonstration conversation'});
    messages.forEach(([role,speaker,body],i)=>{
      const e=emit(alias,`${key}-message-${i}`,'conversation.message',add(start,i),body,{speakerRole:role,speaker,conversationId:id(key)},caseKey);
      put('operations.messages',`${key}-message-row-${i}`,{conversation_id:id(key),speaker_role:role,speaker_ref:speaker,sent_at:e.occurredAt,body,source_event_id:e.id});
    });
  };
  conversation('daniel','daniel-support','2026-09-24T17:10:00Z','daniel-case',[
    ['customer','daniel','The broadband has dropped twice today. It comes back but I cannot rely on it.'],
    ['adviser','Aisha','I have opened DR-2041 and will keep the case with me.'],
    ['customer','daniel','Please keep the details so I do not have to start again with the next person.'],
    ['adviser','Aisha','I will record the checks and any agreed follow-up against this case.']]);
  conversation('daniel','daniel-followup','2026-09-25T19:40:00Z','daniel-case',[
    ['customer','daniel','The restart at 20:20 did not fix it. The connection dropped again.'],
    ['adviser','Aisha','I can see the failed check. I will call you at 21:15, even if the line returns first.'],
    ['customer','daniel','Thank you. I can take that call.']]);
  conversation('sam','sam-setup','2026-09-23T09:10:00Z','sam-case',[
    ['customer','sam','The hub arrived yesterday. Does that mean my broadband is ready?'],
    ['adviser','Activation team','Delivery is recorded, but activation is not confirmed. We will check provisioning before repeating setup instructions.'],
    ['customer','sam','I have plugged it in, but I have not had a working connection yet.']]);
  conversation('maya','maya-preference','2026-09-18T14:00:00Z',null,[
    ['customer','maya','We usually switch the hub off at night. Please do not send alerts just because it is quiet.'],
    ['adviser','Care team','We can retain that preference. We will still investigate if you report a problem or new fault evidence arrives.']]);
  emit('maya','maya-preference-stated','preference.stated','2026-09-18T14:00:00Z','“We switch the hub off at night.”',{statement:'Router switched off overnight'});
  for(let n=0;n<182;n++) {
    const date=day(iso(Date.parse(stories.historyStart)+n*86400000));
    const next=day(iso(Date.parse(date)+86400000));
    if(next>'2026-09-25')continue;
    const gap=emit('maya',`maya-gap-${date}`,'router.heartbeat_overdue',london(date,21),'Management heartbeat became overdue. No line failure was measured.',{lastReceivedAt:add(london(date,21),-5)},null,'router');
    const incomplete=['2026-09-04','2026-09-12'].includes(next);
    const returned=incomplete?null:emit('maya',`maya-return-${date}`,'router.heartbeat_received',add(london(next,7),Math.floor(random()*20)),'Heartbeat observed again after the overnight gap.',{},null,'router');
    emit('maya',`maya-night-${date}`,'router.overnight_window',london(next,8),'Closed observation window; an absent return is retained as unknown, not failure or recovery.',{windowStart:gap.occurredAt,windowEnd:london(next,8),returnObserved:!!returned,returnAt:returned?.occurredAt??null,evidenceIds:[gap.id,...returned?[returned.id]:[]]},null,'router');
  }
  const diag=(key:string,test:string,time:string,result:string,description:string)=>{
    const e=emit('daniel',key,'diagnostic.completed',time,description,{test,result},'daniel-case','diagnostics');
    put('operations.diagnostics',`${key}-row`,{service_id:id('service-daniel'),case_id:id('daniel-case'),test_name:test,result,measured_value:null,unit:null,started_at:add(time,-2),completed_at:time,source_event_id:e.id});
  };
  diag('daniel-line-baseline','line_check','2026-09-24T17:30:00Z','intermittent','Line check observed intermittent sync. Cause remains undetermined.');
  diag('daniel-restart','restart','2026-09-25T19:20:00Z','not_resolved','Restart attempted at 20:20. The issue persisted.');
  const promise=emit('daniel','daniel-promise','promise.created','2026-09-25T19:45:00Z','Aisha promised a callback at 21:15.',{owner:'Aisha',dueAt:'2026-09-25T20:15:00Z',promiseId:id('promise-daniel')},'daniel-case');
  const capacity=emit(null,'callback-rota','capacity.recorded','2026-09-25T19:45:00Z','21:15 reserved for Aisha / Daniel; 21:30 available.',{slots:[{time:'21:15',owner:'Aisha',person:'daniel'},{time:'21:30',owner:null,person:null}]},null,'workforce');
  for(const [key,start,owner] of [['callback-2115','2026-09-25T20:15:00Z','Aisha'],['callback-2130','2026-09-25T20:30:00Z',null]])put('operations.capacity_slots',key!,{owner_ref:owner,kind:'callback',starts_at:start!,ends_at:add(start!,15),source_event_id:capacity.id});
  put('operations.appointments','daniel-appointment',{case_id:id('daniel-case'),slot_id:id('callback-2115'),status:'held',source_event_id:capacity.id});
  for(const a of ['daniel','sam','maya'])emit(a,`${a}-signal`,'router.heartbeat_overdue','2026-09-25T20:00:00Z','No heartbeat received in the expected window. Line state and cause remain unknown.',{lastReceivedAt:'2026-09-25T19:55:00Z',overdueSeconds:240},a==='maya'?null:`${a}-case`,'router');
  const incident=emit(null,'incident-confirmed','incident.confirmed','2026-09-25T20:03:00Z','Network incident INC-017 explicitly affects Daniel and Sam. Maya is outside the recorded scope.',{incidentId:'INC-017',affected:['daniel','sam'],assetId:id('shared-node')},null,'network');
  put('operations.incidents','incident',{reference:'INC-017',status:'open',description:incident.description,opened_at:incident.occurredAt,resolved_at:null,source_event_id:incident.id});
  for(const a of ['daniel','sam','maya'])put('operations.incident_services',`incident-${a}`,{incident_id:id('incident'),service_id:id(`service-${a}`),membership:a==='maya'?'excluded':'affected',valid_from:incident.occurredAt,valid_to:null,source_event_id:incident.id});
  const early=emit('maya','maya-early-return','router.heartbeat_received','2026-09-25T20:10:00Z','Heartbeat returned early this evening. This was observed, not predicted from the overnight routine.',{},null,'router');early.knownAt='2026-09-25T20:12:00Z';
  const restored=emit('daniel','daniel-restored','service.restored_observed','2026-09-25T20:12:00Z','Fresh line test observes restoration. Callback and customer confirmation remain separate.',{lineTest:'passed'},'daniel-case','diagnostics');
  put('operations.diagnostics','daniel-restored-row',{service_id:id('service-daniel'),case_id:id('daniel-case'),test_name:'line_check',result:'passed',measured_value:null,unit:null,started_at:add(restored.occurredAt,-1),completed_at:restored.occurredAt,source_event_id:restored.id});
  const fulfilled=variant==='unmet-promise'?null:emit('daniel','daniel-callback','promise.fulfilled','2026-09-25T20:15:00Z','Aisha completed the promised 21:15 callback.',{promiseId:id('promise-daniel'),dueAt:'2026-09-25T20:15:00Z',owner:'Aisha'},'daniel-case');
  put('operations.promises','promise-daniel',{case_id:id('daniel-case'),owner_ref:'Aisha',kind:'callback',created_at:promise.occurredAt,due_at:'2026-09-25T20:15:00Z',fulfilled_at:fulfilled?.occurredAt??null,source_event_id:promise.id,fulfilment_event_id:fulfilled?.id??null});
  emit('daniel','daniel-confirmed','customer.confirmed_working','2026-09-25T20:18:00Z','Daniel confirms: “It’s working again, thank you.”',{statement:'It’s working again, thank you.'},'daniel-case');
  if(variant==='late-diagnostic')f.events.find(e=>e.sourceEventId==='daniel-restart')!.knownAt='2026-09-25T20:04:00Z';
  if(variant==='duplicate-delivery')f.events.push(structuredClone(f.events.find(e=>e.sourceEventId==='sam-delivery')!));
  if(variant==='corrected-scope') {
    const e=emit(null,'scope-corrected','incident.confirmed','2026-09-25T20:06:00Z','Updated scope explicitly adds Maya. Earlier snapshots retain the original membership.',{incidentId:'INC-017',affected:['daniel','sam','maya']},null,'network');e.supersedesId=incident.id;
    byId('operations.incident_services','incident-maya').valid_to=e.occurredAt;
    put('operations.incident_services','incident-maya-corrected',{incident_id:id('incident'),service_id:id('service-maya'),membership:'affected',valid_from:e.occurredAt,valid_to:null,source_event_id:e.id});
  }
  if(variant==='revoked-contact') {
    const e=emit('daniel','daniel-withdrawal','contact.authority_recorded','2026-09-25T19:50:00Z','In-app service contact permission withdrawn; existing human obligations remain.',{allowed:false,purpose:'service',channel:'in_app',role:'account_holder'},null,'identity');
    byId('customer.contact_permissions','permission-daniel').valid_to=e.occurredAt;
    put('customer.contact_permissions','permission-daniel-withdrawn',{person_id:id('person-daniel'),account_id:id('account-daniel'),purpose:'service',channel:'in_app',allowed:false,valid_from:e.occurredAt,valid_to:null,source_event_id:e.id});
  }
  if(variant==='slot-conflict')emit('sam','competing-reservation','appointment.requested','2026-09-25T19:50:00Z','Activation team requested the slot already held for Daniel. A request is not a reservation.',{slotId:id('callback-2115')},'sam-case','workforce');
  if(variant==='gamer-claim')emit('daniel','gamer-statement','interest.stated','2026-09-25T19:50:00Z','“I’m a gamer.” Self-description only; no change to support obligations or marketing permission.',{statement:"I'm a gamer",verified:false},'daniel-case');
  if(variant==='recurrent-failure')emit('daniel','fresh-failure','service.failure_observed','2026-09-25T20:16:00Z','A fresh line test failed after apparent restoration. Earlier success must be reconsidered.',{lineTest:'failed'},'daniel-case','diagnostics');
  f.events.sort((a,b)=>Date.parse(a.knownAt)-Date.parse(b.knownAt)||Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||a.sourceEventId.localeCompare(b.sourceEventId));
  const issues=validateFixture(f);if(issues.length)throw new Error(JSON.stringify(issues.slice(0,10)));
  return f;
}
export function fixtureHash(f:HouseholdFixture) { return createHash('sha256').update(JSON.stringify(f)).digest('hex'); }
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const f=generateHistory({variant:process.argv[2]||'canonical'});
  const path=resolve('app/.data/fixtures');mkdirSync(path,{recursive:true});writeFileSync(resolve(path,`${f.variant}.json`),JSON.stringify(f));
  const counts=Object.fromEntries([...new Set(f.events.map(e=>e.type))].sort().map(type=>[type,f.events.filter(e=>e.type===type).length]));
  const manifest={datasetVersion:f.datasetVersion,seed:f.seed,variant:f.variant,contentHash:fixtureHash(f),events:f.events.length,counts,tables:Object.fromEntries(Object.entries(f.tables).map(([k,v])=>[k,v.length]))};
  writeFileSync(resolve('fixtures/bt-households/v1',`${f.variant}-manifest.json`),JSON.stringify(manifest,null,2)+'\n'); console.log(JSON.stringify(manifest));
}
