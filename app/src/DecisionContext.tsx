import type { Snapshot, PersonId, SourceEvent } from './types';
import { decisionContext } from './decision-context';

/** One source-backed explanation shared by the presenter and the memory inspector. */
export function DecisionContext({snapshot, person, inspect, compact=false}: {snapshot:Snapshot; person:PersonId; inspect:(e:SourceEvent)=>void; compact?:boolean}) {
 const context=decisionContext(snapshot,person);
 if(!context.action) return null;
 return <section className={`decision-context${compact?' is-compact':''}`} aria-label="Context that changed the action">
  <div className="context-inputs">{context.facts.map(f=><div key={f.domain}>
   <span className="eyebrow">{f.domain==='customer'?'Remembered':f.domain==='operations'?'Observed':'Authority evidence'}</span>
   <button onClick={()=>{const e=snapshot.households.find(h=>h.id===person)?.evidence.find(e=>e.id===f.evidenceIds[0]);if(e)inspect(e)}}>{f.text}<span aria-hidden="true"> ↗</span></button>
  </div>)}{!context.facts.some(f=>f.domain==='governance') && <div><span className="eyebrow">Permission evidence</span><p>No cited authority record in this decision. Inspect governance for the policy checks.</p></div>}</div>
  {!compact && <><p><strong>Decision consequence</strong> · {context.consequence}</p>{context.alternative && <p className="context-alternative"><strong>Recorded alternative</strong> · {context.alternative}</p>}{context.limitation && <small>{context.limitation}</small>}</>}
 </section>;
}
