// Reuses Soho's installed local encoder. The delivered lab needs no runtime dependency.
// Run: node scripts/build-visual-lab.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runtime=process.env.BT_EMBED_RUNTIME || resolve(root,'../SohoHouse/app/node_modules/@xenova/transformers');
const {pipeline,env}=await import(pathToFileURL(resolve(runtime,'src/transformers.js')));
env.allowRemoteModels=false;
env.cacheDir=resolve(runtime,'.cache');
const model='Xenova/all-MiniLM-L6-v2';
const categories=[
{id:'recovery',label:'Service recovery',color:'#b491ff',snippets:[
'Broadband kept dropping after a router restart. The existing fault case stayed with the same adviser.',
'The customer had already rebooted twice. Repeating the same diagnostic would restart an unresolved conversation.',
'A promised callback was retained while the recovery team investigated recurring disconnections.',
'The adviser read earlier checks before calling. The customer did not have to describe the fault again.',
'An intermittent line issue remained unresolved after basic diagnostics. The recovery case retained its owner.',
'Technical restoration was observed, but the promised follow-up still needed to be completed.'
]},
{id:'activation',label:'First use',color:'#54cdbf',snippets:[
'The router was delivered three days ago, but activation and successful first use had not been confirmed.',
'A new broadband customer had the equipment. Provisioning still needed checking before setup advice.',
'An activation order remained pending. Device delivery did not prove the connection was usable.',
'No first-use observation was available during the first week. The service team investigated provisioning.',
'Setup instructions were held until a line activation check could establish the current service state.',
'The initial connection was tested successfully after the provisioning record changed to complete.'
]},
{id:'incident',label:'Shared incidents',color:'#f1a276',snippets:[
'A confirmed network incident included this broadband service. Further hub restarts were not useful.',
'The area fault affected several services. Existing cases and callback promises were coordinated with the incident.',
'The incident register named the affected service. The adviser retained ownership while network recovery progressed.',
'A nearby outage was reported, but service membership was not established. Impact could not be assumed.',
'The network incident closed. Each service still required a fresh restoration observation.',
'A new incident update changed the supported next step while preserving the customer callback deadline.'
]},
{id:'rhythm',label:'Personal normality',color:'#99bbdc',snippets:[
'The customer said the router is switched off at night. Previous overnight gaps were followed by recovery.',
'A missing heartbeat matched a stated overnight habit. A short watch was chosen instead of a notification.',
'The household had no unresolved case or callback promise. Overnight telemetry recovered without support contact.',
'An established overnight pattern supported observation until the next diagnostic or watch deadline.',
'The service fell outside the confirmed incident scope. Its usual overnight behaviour remained relevant.',
'A heartbeat returned during the observation window. The quiet watch closed with no customer interruption.'
]},
{id:'billing',label:'Billing & payments',color:'#d4b85a',snippets:[
'The customer asked why the bill changed after a promotion ended. The adviser explained the itemised charges.',
'A payment had arrived but the balance projection had not updated. A fresh billing check was required.',
'The customer disputed a charge and had already supplied evidence. The case retained that history.',
'A billing adjustment was proposed. The action required account authority and a recorded approval.',
'The next bill reflected an agreed correction. Delivery of an explanation was separate from resolving the dispute.',
'The customer wanted a monthly bill summary before deciding whether to change their plan.'
]},
{id:'intent',label:'Expressed intent',color:'#d691bd',snippets:[
'The customer asked about a faster broadband package after the service issue had been resolved.',
'A household expressed interest in whole-home Wi-Fi. Eligibility and coverage needed checking before an offer.',
'The customer declined upgrade contact. That refusal remained relevant to later recommendations.',
'The customer wanted to compare current cost with a new bundle, without changing anything yet.',
'A relevant product conversation was held while an unresolved support promise took priority.',
'A completed service recovery made room to revisit a previously expressed product interest with permission.'
]},
{id:'consent',label:'Contact & authority',color:'#a5b58c',snippets:[
'The account holder preferred an evening callback. That stated timing constrained the service plan.',
'Authority to disclose account details had not been verified for the person contacting support.',
'The customer asked not to receive proactive messages unless action was needed from them.',
'The authorised contact requested a case update through the app while keeping the named adviser.',
'Contact permission needed a fresh check before a proposed message could be sent.',
'A confirmed callback time was an outstanding commitment even when other service conditions changed.'
]}
];
const followups=[
'Historical episode retained with its source records and final observed state.',
'The case notes distinguish reported symptoms, performed checks and the next outstanding obligation.',
'The record preserves the customer statement separately from the operational observation.'
];
const records=categories.flatMap((c,ci)=>c.snippets.flatMap((text,i)=>followups.map((ending,j)=>({
 id:`EP-${String(ci+1)}${String(i+1).padStart(2,'0')}${j+1}`,category:c.id,
 title:text.split('. ')[0]+(text.includes('. ')?'.':''),text:`${text} ${ending}`,
 source:'synthetic episode',scope:'anonymised historical example',
 occurredAt:`2026-09-${String(2+(ci*3+i+j)%20).padStart(2,'0')}T${String(9+j*3).padStart(2,'0')}:00:00Z`
}))));
const people={
 daniel:{name:'Daniel Reed',summary:'Repeated connection drops. Restart already tried. Aisha owns the unresolved case and promised a callback at 21:15.',base:'Broadband repeatedly disconnects. A router restart has already been tried and did not resolve the issue. Aisha owns the unresolved service recovery case and has promised to call at 21:15. Preserve the history and the callback.',incident:'A confirmed network incident INC-017 affects this broadband service. Repeated connection drops and an unsuccessful router restart are recorded. Aisha still owns the unresolved case and must keep the 21:15 callback. Coordinate with the network incident and do not repeat hub restarts.'},
 sam:{name:'Sam Morgan',summary:'Equipment delivered. Activation and first use unconfirmed. Check provisioning before prescribing setup.',base:'New broadband service in the first week. Equipment was delivered three days ago but activation and successful first use are not confirmed. Investigate provisioning before giving setup instructions.',incident:'New broadband service with equipment delivered but activation unconfirmed. A confirmed area network incident INC-017 includes this service. Coordinate the activation investigation with the shared incident and avoid unsupported hub restart instructions.'},
 maya:{name:'Maya Patel',summary:'Stated overnight router-off habit. Repeated overnight recovery. No unresolved case or callback promise.',base:'The household switches its router off at night. Previous overnight heartbeat gaps were followed by recovery. There is no unresolved case or callback promise. Observe quietly until 21:10 or new evidence instead of sending an unnecessary notification.',incident:'The household switches its router off at night and its service is outside the confirmed network incident INC-017. Prior overnight heartbeat gaps recovered. No unresolved case or callback promise exists. Maintain a quiet observation window until 21:10 or new evidence.'}
};
const queries=Object.entries(people).flatMap(([person,p])=>['base','incident'].map(context=>({id:`${person}-${context}`,person,context,text:p[context]})));
const encoder=await pipeline('feature-extraction',model,{quantized:true});
for(const [i,row] of [...records,...queries].entries()){
 const result=await encoder(row.text,{pooling:'mean',normalize:true});
 row.vector=Array.from(result.data,v=>+v.toFixed(8));
 if((i+1)%24===0)console.log(`Embedded ${i+1}/${records.length+queries.length}`);
}
const files=['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx'];
const artifacts=files.map(file=>({file,sha256:createHash('sha256').update(readFileSync(resolve(env.cacheDir,model,file))).digest('hex')}));
const out={manifest:{model,dimensions:384,pooling:'mean',normalised:true,quantised:true,artifacts,records:records.length,queries:queries.length,source:'Synthetic BT service episodes authored for this design lab. Not BT production records.',retrieval:'Cosine similarity on original 384-dimensional vectors. No probability or business value is inferred from similarity.',categoryMeaning:'Authored source categories for colour, not discovered clusters.'},categories:categories.map(({id,label,color})=>({id,label,color})),people:Object.fromEntries(Object.entries(people).map(([id,{name,summary}])=>[id,{name,summary}])),records,queries};
writeFileSync(resolve(root,'docs/design/lab/space.json'),JSON.stringify(out));
execFileSync('python3',[resolve(root,'scripts/project-visual-lab.py')],{stdio:'inherit'});
console.log(`Saved ${records.length} real embeddings over synthetic episodes.`);
