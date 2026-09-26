import type { Snapshot, PersonId } from './types.ts';
export type PresentationPanel = 'customer' | 'operations' | 'arbiter' | 'actions' | 'phone';
export type PresentationBeat = {
  id: string; kind: 'evidence' | 'decision' | 'experience' | 'comparison' | 'waiting';
  person: PersonId | null; panel: PresentationPanel | null; title: string; detail: string;
  evidenceIds: string[]; change?: {label:string;before:string;after:string};
};
export const householdNames:Record<PersonId,string> = {daniel:'Daniel Reed',sam:'Sam Morgan',maya:'Maya Patel'};
export const chapterNames = ['Three households. Three different contexts.','One signal. Three different next moves.','A shared incident. A precise boundary.','Recovery is more than a green light.','A promise becomes a recorded action.','Three outcomes. Separate proof.'];
const people:PersonId[]=['daniel','sam','maya'];
const time=(iso:string)=>new Date(iso).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});
export function householdOutcome(s:Snapshot, person:PersonId) {
  const h=s.households.find(h=>h.id===person)!;
  const outcomes=s.operations.outcomes.filter(o=>o.person===person);
  const met=(goal:string)=>outcomes.some(o=>o.goal===goal && o.check.status==='met');
  const contradiction=outcomes.find(o=>o.check.status==='contradicted');
  const messages=s.actions.filter(a=>a.person===person).length;
  if(contradiction) return {state:'contradicted',title:'Fresh evidence needs attention',detail:contradiction.check.finding,proof:outcomes};
  if(person==='daniel') return {
    state:met('service')&&met('callback')&&met('confirmation')?'met':'waiting',
    title:h.confirmed&&h.restored?'Recovery confirmed':h.restored?'Connection back. Follow-through matters.':'An existing case, an existing promise.',
    detail:`Line ${h.restored?'observed working':'not yet verified'} · callback ${h.promiseFulfilled?'kept':'outstanding'} · customer ${h.confirmed?'confirmed':'reply outstanding'}.`,proof:outcomes,
  };
  if(person==='sam') return {
    state:h.firstUseObserved && met('activation')?'met':'waiting',
    title:h.firstUseObserved?'First use has its own proof.':'Delivered is not connected.',
    detail:h.firstUseObserved?'Successful first use observed. The effect of outreach on activation is not measured.':'Delivery is recorded. Successful first use is still unconfirmed; the activation team retains ownership.',proof:outcomes,
  };
  return {
    state:met('watch')?'met':'waiting', title:met('watch')?'The watch ended. The evening stayed quiet.':'Watch the signal. Respect the routine.',
    detail:`${messages} customer messages · ${met('watch')?'a returning heartbeat fulfils the watch':h.incident?'incident evidence overrides the routine':h.caseStatus!=='none'?'current care evidence requires review':'waiting for fresh telemetry; the routine is context, not proof'}.`,proof:outcomes,
  };
}
export function presentationBeats(s:Snapshot):PresentationBeat[] {
  if(s.pendingJobs || s.failedJobs || (s.cutoff>0 && people.some(p=>!s.decisions.some(d=>d.person===p&&d.revision===s.cutoff)))) return [{
    id:`${s.cutoff}-waiting`,kind:'waiting',person:null,panel:'arbiter',title:s.failedJobs?'The decision needs attention.':'Recording the next decision.',
    detail:s.failedJobs?'The source event is retained. A failed worker is not a completed decision. Switch to Explore to inspect it.':'The source event has arrived. Wait for the recorded decisions before revealing their consequences.',evidenceIds:[],
  }];
  const beats:PresentationBeat[]=[];
  const add=(b:Omit<PresentationBeat,'id'>)=>beats.push({...b,id:`${s.cutoff}-${beats.length}-${b.person||'all'}-${b.panel||'compare'}`});
  const shared=s.events.filter(e=>e.subject==='shared'&&e.revision===s.cutoff&&e.type==='incident.confirmed');
  if(shared.length) add({kind:'evidence',person:null,panel:'operations',title:'Scope changes the response.',detail:s.households.map(h=>`${h.name.split(' ')[0]}: ${h.incident?'in scope':'outside scope'}`).join(' · ')+'. Read the affected-service register before applying the incident to a household.',evidenceIds:shared.map(e=>e.id)});
  for(const person of people) {
    const h=s.households.find(h=>h.id===person)!;
    const d=s.decisions.filter(d=>d.person===person && d.revision===s.cutoff).at(-1);
    const previous=s.decisions.filter(d=>d.person===person&&d.revision<s.cutoff).at(-1);
    const own=h.evidence.filter(e=>e.subject===person);
    const refs=(...types:string[])=>types.flatMap(t=>own.filter(e=>e.type===t).slice(-1).map(e=>e.id));
    const fresh=own.filter(e=>e.revision===s.cutoff);
    const firstBeat=beats.length;
    if(s.cutoff<=1) {
      const pattern=h.memory?.items.find(m=>m.kind==='pattern')?.measurement;
      add({kind:'evidence',person,panel:'customer',
        title:person==='daniel'?'This signal arrives inside an existing promise.':person==='sam'?'A delivered hub is still a first-use gap.':'Normal is personal.',
        detail:person==='daniel'?`${h.owner||'The care team'} owns the case. ${h.promise?`A ${time(h.promise)} callback is ${h.promiseFulfilled?'kept':'outstanding'}.`: 'No callback is recorded.'} ${h.restartTried?'The earlier restart failed.':'Diagnostics remain attached to the case.'}`:
          person==='sam'?h.firstUseObserved?'First use is already observed. Read the latest proof before repeating setup advice.':'Delivery is recorded; a successful connection needs its own observation. The activation team already owns the question.':`${h.habit||'No stated routine is recorded.'}${pattern?` ${pattern.returns} observed returns across ${pattern.sample} windows; ${pattern.incomplete} incomplete.`:''} Fresh contrary evidence can override the routine.`,
        evidenceIds:person==='daniel'?refs('diagnostic.completed','promise.created'):person==='sam'?refs('order.delivered','activation.pending'):refs('preference.stated')});
    } else if(fresh.some(e=>['service.restored_observed','promise.fulfilled','activation.first_use_observed','customer.confirmed_working','router.heartbeat_received'].includes(e.type))) {
      const o=householdOutcome(s,person);
      const restoration=person==='daniel'&&h.restored&&!h.promiseFulfilled;
      add({kind:'evidence',person,panel:restoration?'customer':'actions',title:restoration?'The line is back. The promise is still outstanding.':o.title,detail:o.detail,evidenceIds:fresh.map(e=>e.id)});
    }
    if(d && (s.cutoff===1 || previous?.title!==d.title || previous?.disposition!==d.disposition)) {
      add({kind:'decision',person,panel:'arbiter',title:d.title,detail:d.reason,evidenceIds:d.evidenceIds.filter(id=>s.events.some(e=>e.id===id)),
        ...(previous&&previous.title!==d.title?{change:{label:'Decision',before:previous.title,after:d.title}}:{})});
    }
    const action=s.actions.filter(a=>a.person===person && a.revision===s.cutoff).at(-1);
    if(action || (person==='maya' && (s.cutoff===1 || fresh.some(e=>e.type==='router.heartbeat_received')))) {
      add({kind:'experience',person,panel:'phone',title:action?action.title:'No notification is the customer experience.',
        detail:action?`${action.body} · Recorded demo delivery. No external message sent.`:householdOutcome(s,person).detail,
        evidenceIds:action?d?.evidenceIds.filter(id=>s.events.some(e=>e.id===id))||[]:refs('router.heartbeat_received','preference.stated')});
    }
    if(beats.length===firstBeat) {
      const o=householdOutcome(s,person);
      add({kind:'evidence',person,panel:s.cutoff?'actions':'customer',title:o.title,detail:o.detail,evidenceIds:o.proof.flatMap(o=>o.check.evidenceIds).filter(id=>s.events.some(e=>e.id===id))});
    }
  }
  add({kind:'comparison',person:null,panel:null,title:chapterNames[s.cutoff]||'Three households. The recorded outcome.',detail:s.cutoff===5?'What changed for each household—and what the evidence actually proves.':'The same clock, three household contexts. Compare the next move before advancing.',evidenceIds:[]});
  return beats;
}
export function presentationCursor(beats:PresentationBeat[],person:PersonId,index:unknown):number {
  if(typeof index==='string' && /^\d+$/.test(index)) return Math.min(Number(index),Math.max(0,beats.length-1));
  return Math.max(0,beats.findIndex(b=>b.person===person));
}
export function panelSnapshot(s:Snapshot,before:Snapshot|null,beats:PresentationBeat[],index:number,panel:PresentationPanel,person:PersonId):Snapshot|null {
  const revealed=s.cutoff===0 || beats.slice(0,index+1).some(b=>b.kind==='comparison'||(b.panel===panel&&(b.person===null||b.person===person)&&b.kind!=='waiting'));
  if(revealed) return s;
  return before?.session.id===s.session.id && before.cutoff===s.cutoff-1 ? before : null;
}
