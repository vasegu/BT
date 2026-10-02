import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../server/engine.ts';

const steps = ['heartbeat', 'incident', 'restore', 'callback', 'confirm'] as const;
import { impactOf, tradeOffs, valueSummary } from '../src/value-impact.ts';

test('value to BT: trade-offs cover every proposal and tracking splits expected from evidenced', async () => {
  const e = new Engine(':memory:');
  try {
    const s = e.createSession();
    for (let i = 0; i < steps.length; i++) { e.advance(s.id, steps[i], `v${i}`, i); await e.processJobs(); }
    const snap = e.snapshot(s.id);
    const h = snap.households.find((x) => x.id === 'daniel')!;
    const d = snap.decisions.filter((x) => x.person === 'daniel' && x.trace).at(-1)!;
    const rows = tradeOffs(d, h);
    assert.ok(rows.length > 1);
    assert.equal(rows[0].proposal.id, d.trace!.selectedId);
    // An engineer visit retains more but costs more to serve than a callback.
    assert.ok(impactOf('engineer', h).cost > impactOf('callback', h).cost);
    assert.ok(impactOf('offer', h).purchase > 0 && impactOf('offer', h).churn > 0);
    const v = valueSummary(snap, h);
    assert.ok(v.ledger.length > 0);
    assert.ok(v.expected.churn <= 0);
    assert.ok(Math.abs(v.evidenced.revenue) <= Math.abs(v.expected.revenue) + Math.abs(v.atRisk.revenue));
  } finally { e.close(); }
});
