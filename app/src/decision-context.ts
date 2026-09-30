import type { Snapshot, PersonId } from './types.ts';
import { competingProposal } from './presenter-selection.ts';

type Domain = 'customer' | 'operations' | 'governance';
export function decisionContext(snapshot: Snapshot, person: PersonId): {
 facts: { domain: Domain; text: string; evidenceIds: string[] }[];
 action: string | null; consequence: string; alternative: string | null; limitation: string | null;
} {
 const decision = snapshot.decisions.filter(d => d.person === person && d.revision <= snapshot.cutoff && Date.parse(d.time) <= Date.parse(snapshot.clock)).at(-1);
 const chosen = decision?.trace?.candidates.find(c => c.id === decision.trace?.selectedId);
 if (!decision) return { facts: [], action:null, consequence:'History is ready. No action has been selected at this moment.', alternative:null, limitation:null };
 const cutoff = Math.min(Date.parse(snapshot.clock), Date.parse(decision.time));
 const h = snapshot.households.find(h => h.id === person);
 const cited = new Set([...decision.evidenceIds, ...(chosen?.checks.flatMap(c=>c.evidenceIds) ?? [])]);
 const available = (h?.evidence ?? []).filter(e => cited.has(e.id) && !(e.subject === "shared" && e.type.startsWith("incident.") && !h?.incident && !h?.incidentCleared) && (e.subject===person || e.subject==='shared') && e.revision<=decision.revision && Date.parse(e.occurredAt)<=cutoff && Date.parse(e.receivedAt)<=cutoff);
 const domain = (type:string):Domain => /authority|consent|approv|permission|offers_opt_in/.test(type) ? 'governance' : /^(incident|capacity|router|service|line|monitoring)\./.test(type) ? 'operations' : 'customer';
 const facts = (['customer','operations','governance'] as Domain[]).flatMap(d => {
  const checked = new Set(chosen?.checks.flatMap(c=>c.evidenceIds) ?? []);
  const records = available.filter(e=>domain(e.type)===d).sort((a,b)=>
   (d === "operations" ? Number(checked.has(b.id))-Number(checked.has(a.id)) : 0) || Number(b.subject === person)-Number(a.subject === person) ||
   Number(/promise|diagnostic|usage.pattern/.test(b.type))-Number(/promise|diagnostic|usage.pattern/.test(a.type)) || Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
  return records.length ? [{domain:d,text:records[0].description,evidenceIds:[records[0].id]}] : [];
 });
 const alternative = competingProposal(decision);
 return { facts,action:decision.title,consequence:chosen?.effect ?? decision.reason,
  alternative:alternative ? `${alternative.title}: ${alternative.checks.find(c=>c.state!=='pass')?.detail ?? alternative.reason}` : null,
  limitation:facts.length<3 ? 'Only recorded, cited evidence is shown. A missing input is not an inferred fact.' : null };
}
