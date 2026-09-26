import { hosted } from './hosting.ts';
import { hostedReviewMap } from './hosted-review-map.ts';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Snapshot } from '../src/types.ts';
import type { AgentReviewData, ReviewPair, ReviewRecord } from '../src/agent-review-types.ts';
import { behaviourRuns, embed, projectVectors } from './behaviour.ts';
import { renderHodoscope } from './hodoscope-export.ts';

export function reviewRecords(snapshot: Snapshot, at: (revision: number) => Snapshot): ReviewRecord[] {
  return behaviourRuns(snapshot, at).map(run => {
    const assessment = snapshot.decisions.find(d => d.id === run.id)?.trace?.assessment;
    return {
      ...run,
      inputText: JSON.stringify(assessment ? { state: assessment.state, questions: assessment.questions } : { facts: run.facts, provenance: 'Source-time projection; no frozen model request' }, null, 2),
      inputSummary: `${run.input}${assessment?.state.profileContext ? ` Self-reported context: ${JSON.stringify(assessment.state.profileContext)}` : ''}`,
      responseText: run.expression.summary,
      inputProvenance: assessment ? 'Frozen model request' : 'Source-time facts · rules run',
    };
  });
}
export function reviewPairs(runs: { id: string; selectedAction: string }[], inputs: number[][], responses: number[][]): ReviewPair[] {
  const cosine = (a: number[], b: number[]) => Math.max(-1, Math.min(1, a.reduce((s,v,i) => s+v*b[i],0) / Math.sqrt(a.reduce((s,v)=>s+v*v,0)*b.reduce((s,v)=>s+v*v,0))));
  const pairs: ReviewPair[] = [];
  // ponytail: pairwise comparison is bounded by the 15-run replay; use a neighbour index for a larger corpus.
  for (let i=0;i<runs.length;i++) for (let j=i+1;j<runs.length;j++) {
    const inputSimilarity = cosine(inputs[i],inputs[j]), responseSimilarity = cosine(responses[i],responses[j]);
    pairs.push({ a:runs[i].id, b:runs[j].id, inputSimilarity, responseSimilarity,
      rank: Math.max(0,inputSimilarity)*(1-responseSimilarity), sameAction:runs[i].selectedAction === runs[j].selectedAction });
  }
  return pairs.sort((a,b)=>b.rank-a.rank);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map<string, Promise<AgentReviewData>>();
export const reviewExplorerPath = (fingerprint: string) => resolve(root,'.data/agent-review',fingerprint,'explorer.html');
export function agentReview(snapshot: Snapshot, at: (revision: number) => Snapshot): Promise<AgentReviewData> {
  const runs = reviewRecords(snapshot, at);
  const fingerprint = createHash('sha256').update(JSON.stringify(['recorded-behaviour-v1',runs.map(r=>[r.id,r.inputText,r.responseText])])).digest('hex');
  if (cache.has(fingerprint)) return cache.get(fingerprint)!;
  const task = (async () => {
    const inputs: number[][] = [], responses: number[][] = [];
    for (const run of runs) { inputs.push(await embed(run.inputSummary)); responses.push(await embed(run.responseText)); }
    const pairs = reviewPairs(runs,inputs,responses);
    const method = 'Recorded response summaries + actual wording → local MiniLM 384D → Hodoscope PCA. Cosine clusters use response vectors, not action IDs. Input-neighbour ranking uses frozen facts + self-reported context; full input is retained for inspection. Tone is an authored brief, not an LLM measurement. No outcome labels enter geometry.';
    if (runs.length < 3) return { runs, pairs, map:null, fingerprint, method };
    if(hosted) return {runs,pairs,map:await hostedReviewMap(runs,responses),fingerprint,method:method.replace("Hodoscope PCA", "PCA/SVD with Node density contours"),nativeExplorer:false};
    const path = reviewExplorerPath(fingerprint), dir = dirname(path);
    if (!existsSync(path) || !existsSync(resolve(dir,'projection.json'))) {
      const groups = await projectVectors(responses);
      const summaries = runs.map((r,i)=>({ trajectory_id:r.id,turn_id:0,summary:r.responseText,action_text:JSON.stringify({ selectedAction:r.selectedAction, modelChoice:r.modelChoice, expression:r.expression },null,2),task_context:r.inputText,embedding:responses[i],metadata:{person:r.person,variant:r.selectedAction,repeat:r.revision,cluster:`cluster_${groups.points[i].cluster}`,model:r.model || 'rules',governed_choice:r.selectedAction,model_choice:r.modelChoice || 'rules'} }));
      mkdirSync(dir,{recursive:true});
      const input = resolve(dir,'input.json');
      writeFileSync(input,JSON.stringify({ summaries,suiteId:fingerprint,mode:'recorded',groupBy:'cluster',nativeGroupBy:'variant' }));
      await renderHodoscope(input,path);
    }
    return { runs,pairs,map:JSON.parse(readFileSync(resolve(dir,'projection.json'),'utf8')),fingerprint,method,nativeExplorer:true };
  })().catch(error=>{cache.delete(fingerprint);throw error;});
  if(cache.size>=8) cache.delete(cache.keys().next().value!);
  cache.set(fingerprint,task);
  return task;
}
