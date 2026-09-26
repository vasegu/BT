import { useEffect, useState } from 'react';
import type { Snapshot } from './types';
import type { AgentReviewData } from './agent-review-types';
import { EvalActionMap } from './EvalActionMap';
import { ContextEvaluation } from './ContextEvaluation';
import { actionNames } from './BehaviourSpace';
import './context-evaluation.css';
import './agent-review.css';
const time = (v: string) => new Date(v).toLocaleTimeString('en-GB', {timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});
const name = (v: string) => actionNames[v] || v;
type Label = { verdict: string; note: string };
export function AgentReview({ snapshot, controlled }: { snapshot: Snapshot; controlled: boolean }) {
  const [data,setData] = useState<AgentReviewData>(), [error,setError] = useState(''), [selected,setSelected] = useState(''), [reference,setReference] = useState(''), [within,setWithin] = useState(true), [labels,setLabels] = useState<Record<string,Label>>({});
  const base = `?session=${snapshot.session.id}&person=daniel&view=agent-review&at=${snapshot.cutoff}`;
  useEffect(()=>{
    const abort = new AbortController(); setData(undefined); setError('');
    fetch(`/api/agent-review?session=${snapshot.session.id}&at=${snapshot.cutoff}`,{signal:abort.signal})
      .then(async r=>{const value=await r.json();if(!r.ok)throw new Error(value.error || 'Review unavailable');return value as AgentReviewData;})
      .then(value=>{setData(value);try{setLabels(JSON.parse(localStorage.getItem(`bt-agent-review:${value.fingerprint}`)||'{}'));}catch{setLabels({});}})
      .catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    return ()=>abort.abort();
  },[snapshot.session.id,snapshot.cutoff,snapshot.decisions.length]);
  const candidates = data?.pairs.filter(p=>p.rank>0.00001 && (!within || p.sameAction)) || [];
  const initial = candidates[0];
  const b = data?.runs.find(r=>r.id===(selected || initial?.b)) || data?.runs[0];
  const neighbour = data?.pairs.find(p=>(p.a===b?.id||p.b===b?.id) && (!within || p.sameAction));
  const a = data?.runs.find(r=>r.id===reference && r.id!==b?.id) || data?.runs.find(r=>r.id===(neighbour && neighbour.a===b?.id?neighbour.b:neighbour?.a));
  const pair = data?.pairs.find(p=>(p.a===a?.id&&p.b===b?.id)||(p.b===a?.id&&p.a===b?.id));
  const mark = (change: Partial<Label>) => {
    if(!data||!b)return;
    const next={...labels,[b.id]:{verdict:labels[b.id]?.verdict||'unreviewed',note:labels[b.id]?.note||'',...change}};
    setLabels(next); try{localStorage.setItem(`bt-agent-review:${data.fingerprint}`,JSON.stringify(next));}catch{setError('Review labels could not be saved in this browser.');}
  };
  if(controlled) return <ContextEvaluation snapshot={snapshot} back={()=>location.assign(base)}/>;
  return <div className="operational-memory agent-review">
    <div className="om-summary"><div><span className="eyebrow">POST-RUN / INPUT → ACTION + EXPRESSION</span><h2>Did context bend the response unexpectedly?</h2><p>Inspect completed runs. The same plan can differ in tone, commitments and wording.</p></div><div className="ar-links"><a href={`${base}&study=controls`}>Controlled regression checks ↗</a>{data?.map&&data.nativeExplorer!==false&&<a href={`/api/agent-review/explorer?session=${snapshot.session.id}&at=${snapshot.cutoff}`} target="_blank" rel="noreferrer">Native Hodoscope ↗</a>}</div></div>
    <div className="ar-stats"><span><b>{data?.runs.length ?? '—'}</b> recorded runs</span><span><b>{data ? new Set(data.runs.map(r=>r.selectedAction)).size : '—'}</b> action families</span><span><b>{data?.map?.groups.length ?? '—'}</b> behaviour clusters</span><span><b>{Object.values(labels).filter(l=>l.verdict==='investigate').length}</b> marked for investigation</span><small>Read-only analysis · no model calls or dispatch · synthetic replay</small></div>
    {error&&<p className="ce-error" role="alert">{error}</p>}
    {!data ? <div className="om-empty">{error ? 'Recorded actions remain available on the main screen.' : 'Embedding recorded responses and building the local Hodoscope view…'}</div> : !data.runs.length ? <div className="om-empty">No completed runs at this cutoff. Advance the account replay first.</div> : <div className="ar-layout">
      <section className="om-panel ar-triage"><header className="om-panel-heading"><h2><span>02 · TRIAGE</span>Contrasts worth reading</h2></header><div className="om-scroll"><div className="om-context-block"><label><input type="checkbox" checked={within} onChange={e=>setWithin(e.target.checked)}/> Within the same action</label><p>Similar input, different response. Ranked for inspection; no automatic failure verdict.</p></div>{candidates.slice(0,10).map(p=>{const x=data.runs.find(r=>r.id===p.a)!,y=data.runs.find(r=>r.id===p.b)!;return <button key={`${p.a}/${p.b}`} className="ar-candidate" aria-pressed={pair===p} onClick={()=>{setReference(p.a);setSelected(p.b);}}><span>{x.person} / {y.person}<code>{p.rank.toFixed(3)}</code></span><strong>{p.sameAction?name(x.selectedAction):`${name(x.selectedAction)} → ${name(y.selectedAction)}`}</strong><small>{time(x.time)} → {time(y.time)} · {p.sameAction?'Same plan, varied expression':'Different plans'}</small></button>;})}{!candidates.length&&<p className="om-empty">No non-identical response pairs in this filter.</p>}<div className="om-context-block"><span className="eyebrow">Ranking method</span><p>Input cosine × (1 − response cosine), using original 384D vectors. The input embedding covers frozen facts and self-reported context. Read the full request before attributing a difference.</p></div></div></section>
      <section className="om-panel ar-map"><header className="om-panel-heading"><h2><span>01 · OBSERVE</span>Recorded behaviour</h2><code>{data.runs.length} INPUT–RESPONSE PAIRS</code></header>{data.map ? <EvalActionMap recorded map={data.map} selected={b?.id} variant={b?.selectedAction||''} select={id=>{setSelected(id);setReference('');}}/>:<p className="om-empty">At least three recorded runs are needed for the map.</p>}<div className="ar-map-note"><strong>One action name can contain several behaviours.</strong><p>Clusters include the recorded wording, contact decision and delivery status. Each point retains its source input. Colouring by action family lets you inspect variation inside one plan.</p><details><summary>Embedding method & provenance</summary><p>{data.method}</p><code>{data.fingerprint.slice(0,16)}</code></details></div></section>
      <section className="om-panel ar-inspector"><header className="om-panel-heading"><h2><span>03 · DECIDE</span>Read the actual pair</h2><code>{b?.id.slice(0,8)}</code></header><div className="om-scroll">
        <div className="ar-pair-pickers">{[['A',a?.id],['B',b?.id]].map(([side,id])=><label key={side}>{side}<select aria-label={`Review trace ${side}`} value={id||''} onChange={e=>side==='A'?setReference(e.target.value):setSelected(e.target.value)}>{data.runs.filter(r=>side==='B'||r.id!==b?.id).map(r=><option key={r.id} value={r.id}>{r.person} · {time(r.time)} · {name(r.selectedAction)}</option>)}</select></label>)}</div>
        {pair&&<div className="ar-similarities"><span><b>{pair.inputSimilarity.toFixed(3)}</b> input cosine</span><span><b>{pair.responseSimilarity.toFixed(3)}</b> response cosine</span></div>}
        {[a,b].filter(Boolean).map((r,i)=><article className="ar-trace" key={r!.id}><span className="eyebrow">{i===0&&a?'A':'B'} / {r!.person} · {time(r!.time)}</span><h3>{name(r!.selectedAction)}</h3><p className="ar-tone">{r!.expression.channel} · {r!.expression.modifiers[0].value}</p>{r!.expression.messages.length?r!.expression.messages.map(m=><blockquote key={m.id}><strong>{m.title}</strong><p>{m.body}</p></blockquote>):<blockquote>No new customer message.<p>{r!.reason}</p></blockquote>}<details><summary>Input the agent saw</summary><small>{r!.inputProvenance}</small><pre>{r!.inputText}</pre></details><details><summary>Recorded action + expression</summary><pre>{JSON.stringify({plan:r!.selectedAction,modelChoice:r!.modelChoice,expression:r!.expression},null,2)}</pre></details><details><summary>Summary used for behaviour embedding</summary><p>{r!.responseText}</p></details></article>)}
        {b&&<div className="om-context-block ar-review-mark"><span className="eyebrow">04 · IMPROVE / HUMAN REVIEW · B</span><div><button aria-pressed={labels[b.id]?.verdict==='expected'} onClick={()=>mark({verdict:'expected'})}>Expected variation</button><button aria-pressed={labels[b.id]?.verdict==='investigate'} onClick={()=>mark({verdict:'investigate'})}>Investigate</button></div><textarea aria-label="Review note" value={labels[b.id]?.note||''} onChange={e=>mark({note:e.target.value})} placeholder="Which context or wording needs investigation?"/><p>Saved in this browser for this corpus. No prompt or policy is changed automatically.</p></div>}
      </div></section>
    </div>}
    <div className="ce-provenance"><span>Hodoscope is a post-run inspection tool. Clusters do not prove that behaviour is correct.</span><span>Service outcomes stay in Actions & outcomes.</span></div>
  </div>;
}
