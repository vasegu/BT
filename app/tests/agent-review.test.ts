import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewPairs, reviewRecords } from '../server/agent-review.ts';
import { Engine } from '../server/engine.ts';

test('post-run review finds response differences even when action IDs and inputs match', () => {
  const pairs = reviewPairs([{ id:'a', selectedAction:'incident' },{ id:'b', selectedAction:'incident' },{ id:'c', selectedAction:'watch' }], [[1,0],[1,0],[0,1]], [[1,0],[0,1],[1,0]]);
  assert.equal(pairs[0].a, 'a'); assert.equal(pairs[0].b, 'b');
  assert.equal(pairs[0].sameAction, true);
  assert.equal(pairs[0].inputSimilarity, 1); assert.equal(pairs[0].responseSimilarity, 0);
  assert.equal(pairs[0].rank, 1);
});

test('review uses recorded requests and responses, never later outcome labels in its embeddings', async () => {
  const e = new Engine(':memory:');
  try {
    const {id} = e.createSession(); e.advance(id, 'heartbeat', 'one', 0); await e.processJobs();
    const before = reviewRecords(e.snapshot(id), at => e.snapshot(id, at));
    for (const [i, step] of ['incident','restore','callback','confirm'].entries()) { e.advance(id, step as 'incident', `n${i}`, i+1); await e.processJobs(); }
    const after = reviewRecords(e.snapshot(id), at => e.snapshot(id, at));
    for (const row of before) {
      const saved = after.find(r => r.id === row.id)!;
      assert.equal(saved.inputText, row.inputText);
      assert.equal(saved.responseText, row.responseText);
    }
    assert.equal(reviewRecords(e.snapshot(id, 1), at => e.snapshot(id, at)).length, 3);
  } finally { e.close(); }
});
