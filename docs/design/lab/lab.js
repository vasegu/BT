import {retrieve,decision,memoryAt,memoryEvents} from './logic.mjs';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=n=>(n*100).toFixed(1)+'%';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const studies={
  atlas:{kicker:'01 / Retrieval geometry',title:'A memory has a neighbourhood.',description:'Find the episodes that relate to this household’s situation. Add new context and watch the retrieval change.'},
  flow:{kicker:'02 / Contextual arbitration',title:'One signal. Different next moves.',description:'The ambient agent notices an event. The arbiter reads the wider context, sets a mandate and holds the wrong actions.'},
  memory:{kicker:'03 / Evidence over time',title:'A system that keeps its promises.',description:'Scrub through one recovery. See what changes, what stays in memory, and why a working line does not erase a callback.'}
};
let data,ranked=[],query,selected,angle=-28,flowNode='arbiter',flowStage=4,timer=null;
function readURL(){const p=new URLSearchParams(location.search);return {study:Object.hasOwn(studies,p.get('study')||'')?p.get('study'):'atlas',person:['daniel','sam','maya'].includes(p.get('person'))?p.get('person'):'daniel',incident:p.get('incident')==='1',time:Math.max(0,Math.min(6,Math.trunc(Number(p.get('time')??4)||0)))};}
let state=readURL();
function urlFor(patch={}){const s={...state,...patch},session=new URLSearchParams(location.search).get('session');return '?'+new URLSearchParams({study:s.study,person:s.person,incident:s.incident?'1':'0',...(session?{session}:{}),...(s.study==='memory'?{time:s.time}:{})});}
function stop(){clearInterval(timer);timer=null;}
function change(patch){stop();Object.assign(state,patch);flowStage=4;flowNode='arbiter';selected=null;history.pushState(null,'',urlFor());render();}
function headings(){
  const s=studies[state.study];
  $('#study-kicker').textContent=s.kicker;$('#study-title').textContent=s.title;$('#study-description').textContent=s.description;
  document.title=`BT · ${state.study==='atlas'?'Semantic field':state.study==='flow'?'Decision flow':'Memory over time'}`;
  document.querySelectorAll('[data-study]').forEach(el=>{el.setAttribute('aria-current',el.dataset.study===state.study?'page':'false');el.href=urlFor({study:el.dataset.study});});
  document.querySelectorAll('.people [data-person]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.person===state.person));
  $('#incident').checked=state.incident;$('#context-bar').hidden=state.study==='memory';$('#memory-context').hidden=state.study!=='memory';
  $('#provenance').textContent=state.study==='atlas'?'Synthetic episodes · real MiniLM vectors · cosine retrieval':'Synthetic scenario · authored policy / outcomes · no external actions';
  const session=new URLSearchParams(location.search).get('session');
  if(session&&location.pathname.startsWith('/reference/'))document.querySelectorAll('.topbar a').forEach(a=>a.href='/?'+new URLSearchParams({session,person:state.person}));
}
function render(){if(!data)return;headings();if(state.study==='atlas')renderAtlas();else if(state.study==='flow')renderFlow();else renderMemory();}
const cat=id=>data.categories.find(c=>c.id===id);
function prepareRetrieval(){query=data.queries.find(q=>q.id===`${state.person}-${state.incident?'incident':'base'}`);ranked=retrieve(data.records,query);if(!selected)selected=ranked[0].id;}
function renderAtlas(){
  prepareRetrieval();
  $('#study').innerHTML=`<div class="workspace">
    <section class="plot-shell" aria-label="Three dimensional projection of semantic memory">
      <div class="plot-head"><div><h2>Semantic field <span class="muted">/ 126 records</span></h2><p>MINILM · 384D → PCA · 3D</p></div><span class="tag">COMPUTED VECTORS</span></div>
      <svg class="plot atlas-plot" id="atlas-svg" viewBox="0 0 940 525" aria-label="PCA projection. Rotate using the control below; select any point to inspect its source."></svg>
      <div class="plot-bottom"><div class="legend">${data.categories.map(c=>`<span><i style="background:${c.color}"></i>${c.label}</span>`).join('')}</div>
        <div class="plot-controls"><label>ORBIT <input id="orbit" aria-label="Rotate semantic field" type="range" min="-180" max="180" value="${angle}"></label><button id="reset-orbit">Reset view ↺</button><span>${pct(data.manifest.projection.explainedVariance.reduce((a,b)=>a+b,0))} VARIANCE SHOWN · LOSSY PROJECTION</span></div>
      </div>
    </section>
    <aside class="inspector" aria-label="Retrieval results">
      <p class="eyebrow">Query / ${state.incident?'21:03 + incident':'21:00 baseline'}</p><h2>${data.people[state.person].name}</h2>
      <p class="explain">${state.person==='maya'&&state.incident?'Same household habit. Outside the incident.':state.incident?'New operational context changes what is relevant.':'This household’s current situation is the query.'}</p>
      <div class="query-card"><span>◇ ${esc(query.id)}</span><p>${esc(query.text)}</p></div>
      <div class="list-head"><span>Nearest episodes</span><span>Cosine ↓</span></div>
      <div class="neighbours">${ranked.slice(0,6).map((r,i)=>`<button class="neighbour" data-record="${r.id}" aria-pressed="${selected===r.id}"><span>0${i+1}</span><span><strong>${esc(r.title)}</strong><small>${r.id} / ${cat(r.category).label}</small></span><span class="score">${r.similarity.toFixed(3)}</span></button>`).join('')}</div>
      <p class="inspector-note">Ranking uses all 384 dimensions. Position on this chart is an approximation. A close match supplies context; it does not authorise an action.</p>
    </aside>
  </div><div class="below"><section class="record-card" id="record-inspector" aria-live="polite"></section>
    <section class="method-card"><p class="eyebrow">Under the surface</p><h3>Every point resolves to a record.</h3><p>The seven colours are authored topics. The layout is computed from the text. Change the household or incident context to move the query through the same fixed memory space.</p>
      <div class="method-strip"><div><strong>384</strong><span>dimensions per record</span></div><div><strong>126</strong><span>synthetic record variants</span></div><div><strong>6</strong><span>embedded scenario queries</span></div></div>
      <details><summary>Inspect the method & provenance</summary><p>42 authored episode motifs, each with three record formulations. Local quantised <code>all-MiniLM-L6-v2</code>, mean pooling and unit normalisation. No BT production data.</p><p>PCA is fitted only on historical examples; queries are projected through the same basis. PC1 ${pct(data.manifest.projection.explainedVariance[0])}, PC2 ${pct(data.manifest.projection.explainedVariance[1])}, PC3 ${pct(data.manifest.projection.explainedVariance[2])}. These axes have no assigned behavioural meaning.</p><p><a href="space.json" download>Download vectors, source text & model hashes ↗</a> · <a href="notes.md">Read the lab notes ↗</a></p></details>
    </section></div>`;
  drawAtlas();renderRecord();
}
function drawAtlas(){
  const svg=$('#atlas-svg');if(!svg)return;
  const a=angle*Math.PI/180,t=.29,max=Math.max(...data.records.flatMap(r=>r.position.map(Math.abs)),...query.position.map(Math.abs));
  const project=(v)=>{const [x,y,z]=v.map(n=>n/max*185);const xx=x*Math.cos(a)+z*Math.sin(a),zz=-x*Math.sin(a)+z*Math.cos(a),yy=y*Math.cos(t)-zz*Math.sin(t),depth=y*Math.sin(t)+zz*Math.cos(t),scale=1/(1-depth/1500);return{x:510+xx*scale,y:250-yy*scale,z:depth,scale};};
  const line=(v,w,extra='')=>{const p=project(v),q=project(w);return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" ${extra}/>`;};
  const bound=max*.96,coords=[-bound,bound];
  let grid='';
  for(const y of coords)for(const z of coords)grid+=line([-bound,y,z],[bound,y,z]);
  for(const x of coords)for(const z of coords)grid+=line([x,-bound,z],[x,bound,z]);
  for(const x of coords)for(const y of coords)grid+=line([x,y,-bound],[x,y,bound]);
  for(let v=-.75;v<1;v+=.25){grid+=line([v*bound,-bound,-bound],[v*bound,-bound,bound]);grid+=line([-bound,-bound,v*bound],[bound,-bound,v*bound]);}
  const q=project(query.position),top=ranked.slice(0,6),hot=new Set(top.map(r=>r.id));
  const axis=[{v:[bound,-bound,-bound],label:'PC1 / '+pct(data.manifest.projection.explainedVariance[0])},{v:[-bound,bound,-bound],label:'PC2 / '+pct(data.manifest.projection.explainedVariance[1])},{v:[-bound,-bound,bound],label:'PC3 / '+pct(data.manifest.projection.explainedVariance[2])}];
  const labels=data.categories.map((c,i)=>{const rows=data.records.filter(r=>r.category===c.id),center=[0,1,2].map(i=>rows.reduce((s,r)=>s+r.position[i],0)/rows.length),p=project(center),labelY=116+i*39;return `<g pointer-events="none"><path d="M232 ${labelY-3} H260 L${p.x} ${p.y}" fill="none" stroke="${c.color}" stroke-opacity=".13"/><circle cx="45" cy="${labelY-3}" r="2" fill="${c.color}"/><text class="cat-label" x="56" y="${labelY}" style="fill:${c.color}">${c.label.toUpperCase()}</text></g>`;}).join('');
  const points=data.records.map(r=>({...r,p:project(r.position)})).sort((a,b)=>a.p.z-b.p.z).map(r=>{const p=r.p,is=selected===r.id,c=cat(r.category),active=hot.has(r.id);return `<g role="button" tabindex="0" data-point="${r.id}" aria-label="Inspect ${r.id}: ${esc(r.title)}" transform="translate(${p.x},${p.y})"><title>${r.id} · ${esc(r.title)}</title><circle class="focus-ring" r="10" fill="transparent"/><circle class="point" r="${(is?5:active?3.7:2.5)*p.scale}" fill="${is?'#ffffff':c.color}" fill-opacity="${is||active?1:.58+(p.z/max)*.0002}"/>${is?`<circle class="halo" r="10" fill="none" stroke="${c.color}" stroke-width=".8"/><text x="14" y="4" class="hot-label">${r.id}</text>`:''}</g>`;}).join('');
  svg.innerHTML=`<defs><radialGradient id="field-light"><stop stop-color="#493050" stop-opacity=".28"/><stop offset="1" stop-color="#171322" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="470" cy="275" rx="365" ry="245" fill="url(#field-light)"/>
    <g stroke="#52435c" stroke-opacity=".4" stroke-width=".65">${grid}</g>
    <g stroke="#b99cdd" stroke-opacity=".1" stroke-width=".7">${data.records.filter(r=>r.id.endsWith('1')).map(r=>{const p=project(r.position),base=project([r.position[0],-bound,r.position[2]]);return `<line x1="${p.x}" y1="${p.y}" x2="${base.x}" y2="${base.y}"/>`;}).join('')}</g>
    ${axis.map(({v,label})=>{const p=project(v);return `<text class="axis-label" x="${p.x+8}" y="${p.y+18}">${label}</text>`;}).join('')}
    <g>${top.map((r,i)=>{const p=project(r.position);return `<line x1="${q.x}" y1="${q.y}" x2="${p.x}" y2="${p.y}" stroke="#cfb1ff" stroke-width="${i===0?1.2:.7}" stroke-opacity="${.58-i*.06}"/>`;}).join('')}</g>
    ${points}${labels}
    <g pointer-events="none" transform="translate(${q.x},${q.y})"><circle r="19" fill="#d3b2ff" fill-opacity=".04" stroke="#c2a3ed" stroke-opacity=".3" stroke-dasharray="2 4"/><path d="M0 -7 L7 0 L0 7 L-7 0Z" fill="#eee3ff" stroke="#171322" stroke-width="2"/><text x="-10" y="33" text-anchor="end" class="hot-label">${state.person.toUpperCase()} / QUERY</text></g>
    <g stroke="#6c567d" stroke-width=".7" opacity=".6"><path d="M24 35h12m-6 -6v12 M916 35h-12m6 -6v12 M24 488h12m-6 -6v12 M916 488h-12m6 -6v12"/></g><text x="31" y="67" style="font-size:8px;fill:#786488">SPACE / 001</text><text x="31" y="470" style="font-size:8px;fill:#786488">SELECT A POINT TO INSPECT</text>`;
}
function renderRecord(){
  const r=ranked.find(r=>r.id===selected)||ranked[0],color=cat(r.category).color,max=Math.max(...r.vector.map(Math.abs));
  $('#record-inspector').innerHTML=`<div class="record-top"><p class="eyebrow">Source record / <span style="color:var(--brand)">${r.id}</span></p><span class="mono">COSINE ${r.similarity.toFixed(4)}</span></div><p class="record-text">${esc(r.text)}</p><div class="record-meta"><span>${r.occurredAt.slice(0,10)} · ${r.occurredAt.slice(11,16)} UTC</span><span>${esc(cat(r.category).label)}</span><span>Synthetic episode variant</span></div><div class="fingerprint" role="img" aria-label="384-dimensional embedding fingerprint, purple negative components and teal positive components">${r.vector.map((v,i)=>`<i title="Dimension ${i+1}: ${v.toFixed(5)}" style="background:${v<0?'#986bcc':'#2eab99'};opacity:${.13+.87*Math.abs(v)/max}"></i>`).join('')}</div><div class="fingerprint-key"><span>384D / VECTOR FINGERPRINT</span><span>− purple <b style="font-weight:400;margin:0 5px;color:${color}">·</b> + teal</span></div>`;
}
function selectRecord(id,origin){selected=id;document.querySelectorAll('[data-record]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.record===id));drawAtlas();renderRecord();if(origin==='point')$(`[data-point="${id}"]`)?.focus({preventScroll:true});}

function renderFlow(){
  const d=decision(state.person,state.incident);
  $('#study').innerHTML=`<div class="workspace"><section class="plot-shell flow-shell" aria-label="Decision flow">
    <div class="plot-head"><div><h2>Signal → mandate → proposed action</h2><p>TRACE BT-${state.person.toUpperCase().slice(0,3)}-021 · ${state.incident?'21:03 RE-EVALUATION':'21:00 EVALUATION'}</p></div><span class="tag">AUTHORED POLICY</span></div>
    <p class="mobile-flow-key">Swipe the diagram sideways to inspect each stage →</p><div class="flow-scroll"><svg id="flow-svg" class="plot flow-plot" viewBox="0 0 940 505" aria-label="Inspectable stages from single signal through wider context to candidate actions"></svg></div>
    <div class="flow-outcome"><span class="outcome-symbol">${d.watch?'◷':'↗'}</span><div><strong>${d.action}</strong><p>${d.promise}. ${d.watch?'No customer message.':'Execution remains subject to a fresh authority and state check.'}</p><div class="mono">${d.scope.toUpperCase()} · ${d.owner.toUpperCase()}</div></div></div>
    <div class="plot-bottom"><div class="plot-controls"><div class="flow-toolbar"><button id="flow-replay">Replay trace ▷</button><span class="stage-count" id="flow-progress">04 / 04 · PROPOSAL READY</span></div><span>SELECT ANY NODE TO READ ITS CONTRACT</span></div></div>
    </section><aside class="inspector" id="flow-inspector" aria-live="polite"></aside></div>
    <div class="compare-grid" aria-label="Same signal compared across households">${Object.entries(data.people).map(([id,p])=>{const result=decision(id,state.incident);return `<button data-compare="${id}" aria-pressed="${id===state.person}"><strong>${p.name}</strong><span class="mono">router.heartbeat_overdue</span><p>${result.action} ↗</p><small>${result.promise}</small></button>`;}).join('')}</div>`;
  drawFlow();flowInspector();
}
function drawFlow(){
  const d=decision(state.person,state.incident),stage=flowStage;
  const nodes=[
    {id:'signal',x:28,y:214,w:160,h:78,k:'01 / AMBIENT AGENT',title:'Heartbeat overdue',sub:'One observation · one flag',s:0},
    {id:'customer',x:250,y:93,w:182,h:85,k:'02 / CUSTOMER MEMORY',title:state.person==='daniel'?'History + a promise':state.person==='sam'?'Delivery ≠ first use':'An overnight habit',sub:state.person==='daniel'?'Case / owner / 21:15':state.person==='sam'?'Order / activation / first use':'Stated preference / past gaps',s:1},
    {id:'operations',x:250,y:335,w:182,h:85,k:'02 / OPERATIONAL MEMORY',title:state.incident?d.affected?'Incident confirmed':'Outside incident scope':'Service + capacity',sub:state.incident?'INC-017 / membership check':'State / affected scope / slots',s:1},
    {id:'arbiter',x:490,y:202,w:174,h:102,k:'03 / ARBITER',title:'Resolve the context',sub:d.domain,s:2},
    {id:'continue',x:735,y:93,w:177,h:85,k:'04 / SELECTED MANDATE',title:d.candidates[0].title,sub:d.watch?'Recheck 21:10 / no contact':'Fresh checks before execution',s:3},
    {id:'restart',x:735,y:248,w:177,h:72,k:'HELD / DIAGNOSTICS',title:'Restart the hub',sub:'Context blocks this action',held:true,s:3},
    {id:'offer',x:735,y:374,w:177,h:72,k:'HELD / COMMERCIAL',title:'Product recommendation',sub:'No mandate from this signal',held:true,s:3}
  ];
  const paths=[{d:'M188 253 C216 253 220 136 250 136',s:1},{d:'M188 253 C216 253 220 378 250 378',s:1},{d:'M432 136 C470 136 452 237 490 237',s:2},{d:'M432 378 C470 378 452 270 490 270',s:2},{d:'M664 253 C702 253 697 136 735 136',s:3},{d:'M664 253 C702 253 701 284 735 284',s:3,held:true},{d:'M664 253 C702 253 701 410 735 410',s:3,held:true}];
  $('#flow-svg').innerHTML=`<defs><pattern id="flow-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#52425e" opacity=".45"/></pattern></defs><rect width="940" height="505" fill="url(#flow-dots)"/><g>${paths.map(p=>`<path class="wire" d="${p.d}"/>${stage>=p.s?`<path class="${p.held?'wire':'wire-on'}" d="${p.d}" ${p.held?'stroke-dasharray="3 5"':''}/>${!p.held&&timer?`<path class="pulse" d="${p.d}"/>`:''}`:''}`).join('')}</g>
    <text x="28" y="49" class="stage-label">NOTICE</text><text x="250" y="49" class="stage-label">READ BOTH MEMORIES</text><text x="490" y="49" class="stage-label">SET THE MANDATE</text><text x="735" y="49" class="stage-label">DOMAIN CANDIDATES</text>
    ${nodes.map(n=>`<g role="button" tabindex="0" data-node="${n.id}" aria-label="Inspect ${n.id}: ${esc(n.title)}" class="${n.held?'held':'active'} ${flowNode===n.id?'selected':''} ${stage<n.s?'dim':''}" transform="translate(${n.x},${n.y})"><rect class="node-body" width="${n.w}" height="${n.h}" rx="6"/><text class="node-kicker" x="13" y="21">${n.k}</text><text class="node-title" x="13" y="43">${n.title}</text><text class="node-sub" x="13" y="${n.h-16}">${n.sub}</text>${n.id==='signal'?'':`<circle class="port" cx="0" cy="${n.h/2}" r="3"/>`}${['signal','customer','operations','arbiter'].includes(n.id)?`<circle class="port" cx="${n.w}" cy="${n.h/2}" r="3"/>`:''}</g>`).join('')}
    <text x="492" y="337" style="font-size:8px;fill:#c2a3e8">CONTEXT → CONSTRAINTS → MANDATE</text><text x="492" y="352" style="font-size:8px;fill:#8f7d9f">Similarity is evidence, not permission.</text>`;
  const labels=['SIGNAL OBSERVED','BOTH MEMORIES READ','MANDATE RESOLVED','CANDIDATES CHECKED','PROPOSAL READY'];
  $('#flow-progress').textContent=`0${stage} / 04 · ${labels[stage]}`;
  $('#flow-replay').textContent=timer?'Pause trace Ⅱ':'Replay trace ▷';
}
function flowInspector(){
  const d=decision(state.person,state.incident),p=data.people[state.person];
  const text={
    signal:{k:'Ambient agent / single signal',h:'Notice. Flag. Stop there.',body:'The agent notices an overdue heartbeat and raises a typed flag. It cannot establish the cause or decide whether this person should be contacted.',contract:`event: router.heartbeat_overdue\nservice: BT-${state.person.toUpperCase()}\nobservation: no heartbeat\ncertainty: cause_unknown\nauthority: raise_flag_only`},
    customer:{k:'Customer memory / scoped retrieval',h:'The conversation carries forward.',body:p.summary,contract:`scope: this_customer\nrecords: statements + observations\ncommitments: ${state.person==='daniel'?'Aisha / 21:15':'none recorded'}\nretrieval: evidence, not instruction`,link:true},
    operations:{k:'Operational memory / current state',h:'What is true around the customer?',body:state.incident?(d.affected?'The affected-service register includes this service in INC-017. Capacity and existing commitments still constrain the plan.':'INC-017 exists, but Maya’s service is outside its confirmed scope. Geographic proximity is insufficient to claim impact.'):'There is no confirmed incident membership in this fixture. Service state, activation, open cases and callback capacity must be read together.',contract:`incident: ${state.incident?'INC-017':'unconfirmed'}\nservice_membership: ${state.incident?(d.affected?'included':'excluded'):'unknown'}\ncallback_21_15: reserved / Aisha\ncallback_21_30: available`},
    arbiter:{k:'Arbiter / larger context',h:d.action,body:d.reason},
    continue:{k:'Domain proposal / selected',h:d.candidates[0].title,body:d.candidates[0].reason,contract:`domain: ${d.domain.toLowerCase().replaceAll(' ','_')}\nstate: proposed\nexisting_owner: ${d.owner}\n${d.watch?'recheck: 21:10 or new evidence':'preflight: authority + fresh state'}\nexternal_execution: none`},
    restart:{k:'Domain proposal / held',h:'Hold the restart.',body:d.candidates[1].reason,contract:'candidate: router.restart_advice\nstate: held\nreason: conflicts_with_context\nexternal_execution: none'},
    offer:{k:'Domain proposal / held',h:'Hold the product conversation.',body:d.candidates[2].reason,contract:'candidate: product.recommendation\nstate: held\nreason: no_current_mandate\nexternal_execution: none'}
  }[flowNode];
  $('#flow-inspector').innerHTML=`<p class="eyebrow">${text.k}</p><h2>${text.h}</h2><p class="explain">${esc(text.body)}</p>${flowNode==='arbiter'?`<dl class="gates">${d.gates.map(([key,value])=>`<div class="gate"><dt>${key}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><div class="list-head"><span>Candidate disposition</span><span>3 actions</span></div>${d.candidates.map(c=>`<div class="candidate"><div class="candidate-top"><span>${c.title}</span><span class="pill ${c.status==='Held'?'held':''}">${c.status}</span></div><p>${c.reason}</p></div>`).join('')}`:`<pre class="contract">${esc(text.contract)}</pre>${text.link?`<a class="back" style="padding:0;border:0;color:var(--brand)" href="${urlFor({study:'atlas'})}" data-study="atlas">Explore related memory in vector space ↗</a>`:''}`}
    <p class="inspector-note">This is a deterministic policy trace over synthetic records. Selected means proposed. No model deliberation, customer contact or service action is executed.</p>`;
}
function replayFlow(){if(timer){stop();drawFlow();return;}flowStage=0;flowNode='signal';if(reduced){flowStage=4;flowNode='arbiter';drawFlow();flowInspector();return;}timer=setInterval(()=>{flowStage++;flowNode=['signal','customer','arbiter','continue','continue'][flowStage];if(flowStage>=4)stop();drawFlow();flowInspector();},1100);drawFlow();flowInspector();}

function renderMemory(){
  $('#study').innerHTML=`<div class="workspace"><section class="plot-shell memory-shell" aria-label="Memory timeline">
    <div class="plot-head"><div><h2>Evidence accumulates. Obligations persist.</h2><p>CASE DR-2041 · CUSTOMER + OPERATIONAL MEMORY</p></div><span class="tag">AUTHORED OUTCOME REPLAY</span></div>
    <p class="mobile-flow-key">Swipe the timeline sideways to inspect each record →</p><div class="memory-scroll"><svg class="plot memory-plot" id="memory-svg" viewBox="0 0 940 475" aria-label="Seven source events and their effects on service state and the callback promise"></svg></div>
    <div class="memory-readout" id="memory-readout"></div><div class="plot-bottom"><div class="timeline-controls"><button id="memory-replay">Replay ▷</button><input id="time" type="range" min="0" max="6" value="${state.time}" aria-label="Memory timeline position"><output id="time-output"></output></div><p class="replay-mark">Each step uses only records available at that time.</p></div>
    </section><aside class="inspector" id="memory-inspector" aria-live="polite"></aside></div>
    <section class="event-table-wrap"><div class="event-table-head"><h2>Source ledger</h2><span>7 EVENTS · ORDERED BY OBSERVED TIME</span></div><table class="event-table"><thead><tr><th>Time</th><th>Evidence</th><th>Source</th><th>As of cursor</th></tr></thead><tbody>${memoryEvents.map((e,i)=>`<tr data-event-row="${i}"><td>${e.time}</td><td><button data-event="${i}">${e.title}</button><div class="event-type">${e.id} / ${e.type}</div></td><td>${e.source}</td><td class="event-status"></td></tr>`).join('')}</tbody></table></section>`;
  updateMemory();
}
function updateMemory(){
  const step=state.time,event=memoryEvents[step],s=memoryAt(step),before=memoryAt(step-1);
  const x=i=>123+i*119,y=e=>e.lane==='customer'?132:230;
  const stateY=[334,334,347,360,316,316,306],promiseY=[418,395,395,395,395,418,418];
  const stepPath=values=>values.map((v,i)=>i===0?`M${x(0)} ${v}`:`H${x(i)} V${v}`).join('');
  const activeState=stateY.slice(0,step+1),activePromise=promiseY.slice(0,step+1);
  $('#memory-svg').innerHTML=`<defs><pattern id="memory-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#392b46" stroke-width=".5"/></pattern></defs><rect x="99" y="72" width="750" height="355" fill="url(#memory-grid)" opacity=".6"/>
    <text class="rail-label" x="22" y="127">CUSTOMER</text><text class="rail-label" x="22" y="139">MEMORY</text><text class="rail-label" x="22" y="225">OPERATIONS</text><text class="rail-label" x="22" y="237">MEMORY</text><text class="rail-label" x="22" y="335">SERVICE</text><text class="rail-label" x="22" y="347">STATE</text><text class="rail-label" x="22" y="399">CALLBACK</text><text class="rail-label" x="22" y="411">OBLIGATION</text>
    <line x1="99" y1="132" x2="870" y2="132" stroke="#392b46"/><line x1="99" y1="230" x2="870" y2="230" stroke="#392b46"/>
    <path d="${stepPath(stateY)}" fill="none" stroke="#655071" stroke-dasharray="3 5" opacity=".35"/><path d="${stepPath(promiseY)}" fill="none" stroke="#826449" stroke-dasharray="3 5" opacity=".35"/>
    <path d="${stepPath(activeState)}" class="state-line"/><path d="${stepPath(activePromise)}" class="promise-line"/>
    ${step>=1?`<path d="M${x(1)} 132 C${x(1)+20} 170 ${x(1)-20} 363 ${x(1)} 395" fill="none" stroke="#efb88d" stroke-opacity=".35"/>`:''}
    ${[2,3,4].filter(i=>i<=step).map(i=>`<path d="M${x(i)} 237 C${x(i)+10} 270 ${x(i)-10} 280 ${x(i)} ${stateY[i]}" fill="none" stroke="#a98ad0" stroke-opacity=".3"/>`).join('')}
    ${step>=5?`<path d="M${x(5)} 132 C${x(5)+20} 170 ${x(5)-20} 363 ${x(5)} 418" fill="none" stroke="#efb88d" stroke-opacity=".35"/>`:''}
    <line class="cursor-line" x1="${x(step)}" y1="75" x2="${x(step)}" y2="436"/>
    ${memoryEvents.map((e,i)=>`<g role="button" tabindex="0" data-moment="${i}" aria-label="${e.time}: ${esc(e.title)}" class="${i>step?'future':''}"><rect class="event-hit" x="${x(i)-37}" y="67" width="74" height="204" rx="4"/><text class="time-label" x="${x(i)}" y="61" text-anchor="middle">${e.time}</text><circle class="event-mark" cx="${x(i)}" cy="${y(e)}" r="${i===step?7:4}" fill="${e.lane==='customer'?'#c4a0f4':'#70cdbb'}"/>${i===step?`<circle cx="${x(i)}" cy="${y(e)}" r="14" fill="none" stroke="#b491dd" stroke-opacity=".5"/>`:''}<text class="event-title" x="${x(i)}" y="${y(e)-23}" text-anchor="middle">${['Restart tried','Promise made','Signal raised','In scope','Restored','Promise kept','Confirmed'][i]}</text><text x="${x(i)}" y="${y(e)+26}" text-anchor="middle" style="font-size:8px;fill:#847291">${e.id}</text></g>`).join('')}
    <circle cx="${x(step)}" cy="${stateY[step]}" r="4" fill="#c4a0f4"/><circle cx="${x(step)}" cy="${promiseY[step]}" r="4" fill="#efb88d"/>
    ${step>=1&&step<5?`<text x="${x(1)+12}" y="386" style="fill:#d6a37c;font-size:8px">OUTSTANDING UNTIL KEPT</text>`:''}
    <text x="123" y="457" style="font-size:8px;fill:#8e7b9f">CATEGORICAL STATE TRACKS · HEIGHT IS NOT A SCORE</text>`;
  $('#memory-readout').innerHTML=`<div><span>Service</span><strong>${s.service}</strong></div><div><span>Promise</span><strong>${s.promise}</strong></div><div><span>Case</span><strong>${s.case}</strong></div>`;
  $('#memory-inspector').innerHTML=`<div class="record-top"><p class="eyebrow">Record ${step+1} / 7</p><span class="time-badge">${event.time}</span></div><h2>${event.title}</h2><p class="explain">${event.detail}</p><p class="node-id" style="margin-top:13px">${event.id} / ${event.type}</p><div class="diff"><div class="list-head" style="grid-column:1/-1"><span>Materialised state changes</span><span>Before → now</span></div>${Object.keys(event.patch).map(key=>`<div class="diff-row"><span>${key.toUpperCase()}</span><del>${esc(before[key])}</del><ins>${esc(s[key])}</ins></div>`).join('')}</div><div class="story-callout">${step===4?'The connection is back. Aisha still owes Daniel the 21:15 call.':step===5?'A kept callback is now evidence. Customer confirmation is still a separate observation.':step===6?'The case closes. The episode, failed diagnostic and fulfilled promise remain retrievable.':step===3?'The incident changes the plan. It does not reset the relationship.':'New evidence updates the current state. The source record remains inspectable.'}</div><p class="inspector-note">Source: ${event.source}. Synthetic sequence, including proposed future outcomes. Replay position prevents later records from leaking into an earlier state.</p>`;
  $('#time').value=step;$('#time').setAttribute('aria-valuetext',`${event.time}, ${event.title}`);$('#time-output').textContent=event.time;$('#memory-replay').textContent=timer?'Pause Ⅱ':'Replay ▷';
  document.querySelectorAll('[data-event-row]').forEach(row=>{const i=Number(row.dataset.eventRow);row.className=i===step?'current':i>step?'future':'';row.querySelector('.event-status').textContent=i>step?'Future':i===step?'Current record':'Applied';});
}
function moveTime(step,push=false){stop();state.time=step;history[push?'pushState':'replaceState'](null,'',urlFor());updateMemory();}
function replayMemory(){if(timer){stop();updateMemory();return;}state.time=0;if(reduced){updateMemory();history.replaceState(null,'',urlFor());return;}timer=setInterval(()=>{state.time++;if(state.time===6)stop();history.replaceState(null,'',urlFor());updateMemory();},1800);history.replaceState(null,'',urlFor());updateMemory();}

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-study],[data-person],[data-record],[data-point],[data-node],[data-compare],[data-event],[data-moment],#reset-orbit,#flow-replay,#memory-replay');if(!el)return;
  if(el.dataset.study){e.preventDefault();change({study:el.dataset.study});}
  else if(el.dataset.person)change({person:el.dataset.person});
  else if(el.dataset.compare)change({person:el.dataset.compare});
  else if(el.dataset.record)selectRecord(el.dataset.record,'list');
  else if(el.dataset.point)selectRecord(el.dataset.point,'point');
  else if(el.dataset.node){flowNode=el.dataset.node;drawFlow();flowInspector();$(`[data-node="${flowNode}"]`)?.focus({preventScroll:true});}
  else if(el.dataset.event!==undefined)moveTime(Number(el.dataset.event),true);
  else if(el.dataset.moment!==undefined){const i=Number(el.dataset.moment);moveTime(i,true);$(`[data-moment="${i}"]`)?.focus({preventScroll:true});}
  else if(el.id==='reset-orbit'){angle=-28;$('#orbit').value=angle;drawAtlas();}
  else if(el.id==='flow-replay')replayFlow();
  else if(el.id==='memory-replay')replayMemory();
});
document.addEventListener('keydown',e=>{const target=e.target.closest('svg [role=button]');if(target&&['Enter',' '].includes(e.key)){e.preventDefault();target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
document.addEventListener('input',e=>{if(e.target.id==='orbit'){angle=Number(e.target.value);drawAtlas();}if(e.target.id==='time')moveTime(Number(e.target.value));});
$('#incident').addEventListener('change',e=>change({incident:e.target.checked}));
window.addEventListener('popstate',()=>{stop();state=readURL();selected=null;flowStage=4;flowNode='arbiter';render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer){stop();if(state.study==='memory')updateMemory();if(state.study==='flow')drawFlow();}});
try{
  const response=await fetch('space.json');if(!response.ok)throw new Error(`Dataset response ${response.status}`);
  data=await response.json();
  if(data.records.length!==126||data.queries.length!==6||!data.records.every(r=>r.vector.length===384&&r.position.length===3))throw new Error('Embedding data is incomplete');
  render();
}catch(error){
  console.error(error);$('#study').innerHTML='<div class="error"><h2>The local memory space could not load.</h2><p>Serve this folder over HTTP so the browser can read space.json. The lab never substitutes invented vector data.</p><button onclick="location.reload()">Try again</button></div>';
}
