// Small, explicit fixture policies. Retrieval is numerical; decisions are authored.
export function cosine(a,b){
  if(a.length!==b.length) throw new Error('Vector dimensions differ');
  let dot=0,aa=0,bb=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}
  return aa&&bb ? dot/Math.sqrt(aa*bb) : 0;
}
export function retrieve(records,query){
  return records.map(record=>({...record,similarity:cosine(record.vector,query.vector)}))
    .sort((a,b)=>b.similarity-a.similarity||a.id.localeCompare(b.id));
}
export function decision(person,incident){
  const affected=incident&&person!=='maya';
  const watch=person==='maya';
  const recovery=person==='daniel';
  return {
    affected,watch,
    scope:incident?(affected?'IN SCOPE · INC-017':'OUTSIDE · INC-017'):'No confirmed incident',
    owner:recovery?'Aisha · existing case':watch?'Ambient watch':'Activation team',
    domain:watch?'Observation':affected?'Network coordination':recovery?'Service recovery':'Provisioning',
    action:watch?'Watch until 21:10':affected?'Coordinate the incident':recovery?'Continue the recovery plan':'Check activation status',
    promise:recovery?'21:15 callback retained':watch?'No open promise':'21:15 case update proposed',
    reason:watch?'The missing heartbeat matches a stated habit. No unresolved case exists, and this service is outside any confirmed incident scope.':affected?'The affected-service register changes the domain mandate. Existing ownership and commitments survive the incident.':recovery?'Earlier diagnostics failed. Continue the same case with the same owner and keep the promised callback.':'Delivery is recorded. Activation and first use are not. Check provisioning before prescribing setup.',
    gates:[
      ['Service membership',incident?(affected?'Confirmed in INC-017':'Confirmed outside INC-017'):'Not established'],
      ['Customer context',watch?'Stated overnight router-off habit':recovery?'Repeated drops; restart already tried':'Equipment delivered; first use unconfirmed'],
      ['Outstanding obligation',recovery?'Aisha / 21:15 callback':watch?'None recorded':'Activation investigation'],
      ['Available capacity',watch?'No callback slot consumed':recovery?'21:15 already reserved':'21:30 callback slot available'],
      ['Contact authority','Recheck required before any send']
    ],
    candidates:[
      {id:'continue',title:watch?'Quiet observation':affected?'Incident coordination':recovery?'Owned recovery':'Activation check',status:'Selected',reason:watch?'Observe until 21:10 or fresh evidence.':affected?'Link the service to INC-017; keep the existing obligation.':recovery?'Use the existing case and failed-diagnostic history.':'Establish provisioning state and first-use evidence.'},
      {id:'restart',title:'Restart the hub',status:'Held',reason:watch?'No diagnostic evidence justifies interrupting the household.':affected?'A confirmed network incident makes another local restart inappropriate.':recovery?'This diagnostic has already failed.':'Activation must be established before local setup advice.'},
      {id:'offer',title:'Product recommendation',status:'Held',reason:watch?'No expressed product intent in this event.':'Resolve the outstanding service need before introducing a product conversation.'}
    ]
  };
}

// These are a proposed outcome sequence, not observations from a live system.
export const memoryEvents=[
  {id:'CRM-041',time:'20:20',lane:'customer',type:'diagnostic.completed',title:'Restart did not resolve the drops',detail:'Daniel reports another interruption after the restart. Store the attempted diagnostic and its result.',source:'CRM case note',patch:{service:'Unresolved drops',learning:'Restart tried · unsuccessful'}},
  {id:'CRM-046',time:'20:45',lane:'customer',type:'callback.promised',title:'Aisha commits to 21:15',detail:'The promise creates an outstanding obligation with a named owner. It does not depend on the router remaining offline.',source:'Adviser commitment',patch:{promise:'Aisha · 21:15 · outstanding',case:'Owned by Aisha'}},
  {id:'TEL-109',time:'21:00',lane:'operations',type:'router.heartbeat_overdue',title:'An ambient agent raises a flag',detail:'A missing heartbeat is one observation. It does not prove an outage, identify a cause or authorise a message.',source:'Router telemetry',patch:{service:'Heartbeat overdue',action:'Review the wider context'}},
  {id:'INC-017',time:'21:03',lane:'operations',type:'incident.membership_confirmed',title:'This service is inside the incident',detail:'Confirmed service membership changes the mandate to network coordination. Aisha and the callback stay attached.',source:'Affected-service register',patch:{service:'Confirmed incident · INC-017',action:'Coordinate with network recovery'}},
  {id:'TEL-118',time:'21:12',lane:'operations',type:'service.restoration_observed',title:'The line recovers. The promise remains.',detail:'Fresh service telemetry reports recovery. Technical restoration is separate from a kept callback and customer confirmation.',source:'Fresh service test',patch:{service:'Restoration observed',action:'Keep the promised callback'}},
  {id:'CRM-052',time:'21:15',lane:'customer',type:'callback.completed',title:'Aisha keeps the callback',detail:'The completed callback fulfils the promise. Wait for customer confirmation before describing the whole experience as resolved.',source:'Adviser activity record',patch:{promise:'Aisha · 21:15 · fulfilled',action:'Await customer confirmation'}},
  {id:'CRM-053',time:'21:18',lane:'customer',type:'customer.recovery_confirmed',title:'Daniel confirms it is working',detail:'Customer confirmation is recorded separately. The case can close while the attempted diagnostic and kept promise remain in memory.',source:'Customer statement',patch:{case:'Closed · customer confirmed',action:'Retain the recovery episode'}}
];
export function memoryAt(index){
  const state={service:'No current observation',promise:'None recorded',case:'Open recovery case',learning:'No diagnostic result yet',action:'Await evidence'};
  for(const event of memoryEvents.slice(0,index+1))Object.assign(state,event.patch);
  return state;
}
