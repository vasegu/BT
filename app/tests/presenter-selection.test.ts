import { test } from 'node:test';
import assert from 'node:assert/strict';
import { competingProposal, importantChecks } from '../src/presenter-selection.ts';
import type { Decision, Proposal } from '../src/types.ts';
const proposal = (id: string, priority: number, status: Proposal['status'] = 'held') => ({ id, priority, status, checks: [{id:'gate', label:'gate', state:'pass', detail:'', evidenceIds:[]}] }) as Proposal;
test('competing plan follows previous action then meaningful priority, without mutating recorded trace', () => {
  const candidates = [proposal('noise', 1), proposal('selected', 100, 'selected'), proposal('strong', 90), proposal('before', 50), proposal('merged', 999, 'merged')];
  const d = {trace:{selectedId:'selected', candidates}} as Decision;
  assert.equal(competingProposal(d)?.id, 'strong');
  assert.equal(competingProposal(d, 'before')?.id, 'before');
  assert.equal(candidates[0].id, 'noise');
});
test('overview never buries failed or unknown gates beneath passing checks', () => {
  const checks = Array.from({length:5},(_,i)=>({id:String(i),label:String(i),state:i===4?'fail' as const:'pass' as const,detail:'',evidenceIds:[]}));
  assert.equal(importantChecks(checks)[0].state, 'fail');
  assert.equal(importantChecks(checks).length,3);
  assert.equal(checks[0].state,'pass');
});

test('blocked alternatives with relevant evidence outrank unrelated high-priority plans', () => {
  const relevant = {...proposal('relevant',40,'blocked'), evidenceIds:['signal']};
  const unrelated = {...proposal('unrelated',99,'blocked'), evidenceIds:[]};
  const d = {evidenceIds:['signal'],trace:{selectedId:'chosen',candidates:[unrelated,relevant]}} as unknown as Decision;
  assert.equal(competingProposal(d)?.id,'relevant');
});
