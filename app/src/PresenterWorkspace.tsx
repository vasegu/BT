import { DecisionContext } from './DecisionContext';
import { useState, type ReactNode } from 'react';
import type { Snapshot, PersonId, SourceEvent } from './types';
import { changeSummary, type MomentLane } from './presentation';
import { competingProposal, importantChecks } from './presenter-selection';
import { EligibilityChecks } from './ArbiterWorkbench';
import { OutcomeProofs } from './ActionsView';
import { MessageExplanation } from './PhoneExperience';
import { GovernanceEvidence } from './GovernanceView';
import { SwayTile } from './SwayReview';
import { HouseholdCard } from './CustomerProfile';
import { RouterTelemetry } from './OperationsPanels';
import { memoryFacts, operationsFacts } from './DecisionFlow';

/** A stable architecture rail: time advances independently of the section being inspected. */
export function PresenterWorkspace({ snapshot, person, lane, deciding, phone, onOpen, onInspect }: {
  snapshot: Snapshot; person: PersonId; lane: MomentLane; deciding: boolean;
  phone?: ReactNode; onOpen?: (panel: string) => void; onInspect: (e: SourceEvent) => void;
}) {
  const rows = changeSummary(snapshot, person);
  const [selected, select] = useState(snapshot.cutoff === 0 ? 'customer' : 'arbiter');
  const row = rows.find(r => r.panel === selected)!;
  const h = snapshot.households.find(h => h.id === person)!;
  const d = deciding ? null : lane.decision;
  const chosen = d?.trace?.candidates.find(c => c.id === d.trace?.selectedId);
  const alternative = competingProposal(d, lane.previous?.trace?.selectedId);
  const alternatives = alternative ? [alternative] : [];
  const allAlternatives = d?.trace?.candidates.filter(c => c.id !== chosen?.id && c.status !== 'merged').length ?? 0;
  const previewChecks = chosen ? importantChecks(chosen.checks) : [];
  const changes = d?.trace?.changes.slice(0, 3) ?? [];
  const outcomes = snapshot.operations.outcomes.filter(o => o.person === person);
  const current = snapshot.events.filter(e => e.revision === snapshot.cutoff && snapshot.cutoff > 0 && (e.subject === person || e.subject === 'shared') && !e.type.startsWith('router.observation_'));
  const evidence = (selected === 'arbiter' || selected === 'governance') && d
    ? h.evidence.filter(e => d.evidenceIds.includes(e.id)).slice(-3)
    : selected === 'operations' ? current.slice(-3) : h.evidence.filter(e => !e.type.startsWith('router.observation_')).slice(-3);
  const facts = selected === 'customer' ? memoryFacts(h) : selected === 'operations' ? operationsFacts(h, snapshot) : [];
  const statuses: Record<string, string> = {
    customer: snapshot.cutoff === 0 ? 'History ready' : rows[0].changed ? 'Memory updated' : 'Context retained',
    operations: rows[1].changed ? 'New operational evidence' : 'Shared context retained',
    arbiter: deciding ? 'Assessing context…' : d?.title ?? 'Awaiting the signal',
    phone: lane.message ? 'New message' : 'No new message',
    actions: `${outcomes.filter(o => o.check.status === 'met').length} observed · ${outcomes.filter(o => o.check.status !== 'met').length} open`,
    governance: row.panel === 'governance' && deciding ? 'Awaiting decision' : rows[5].changed ? 'Authority changed' : 'Policy retained',
    review: 'Context → action evaluation',
  };
  const questions: Record<string, string> = {
    customer: `What matters about ${h.name.split(' ')[0]} now?`,
    operations: 'What has the operation learned?',
    arbiter: d?.title ?? (deciding ? 'Assessing the available evidence' : 'No decision before a signal'),
    phone: lane.message?.title ?? 'A quiet phone is also an outcome',
    actions: 'What did we expect—and what is proven?',
    governance: 'Is this action permitted?',
    review: 'Did the wrong context sway the action?',
  };
  return <div className="presenter-workspace">
    <nav className="system-rail" aria-label="System sections">
      <div className="rail-caption"><span>System</span><span>● changed</span></div>
      {rows.map((r, i) => <button key={r.panel} aria-current={selected === r.panel ? 'true' : undefined}
        className={r.changed && !deciding ? 'is-changed' : ''} onClick={() => select(r.panel)}>
        <span className="rail-number">{String(i + 1).padStart(2, '0')}</span>
        <span><strong>{r.name}</strong><small>{statuses[r.panel]}</small></span>
        <span className="rail-mark" aria-label={r.changed && !deciding ? 'Changed at this moment' : 'Unchanged'}>{r.changed && !deciding ? '●' : '—'}</span>
      </button>)}
    </nav>
    <section className="presenter-detail" aria-label={row.name}>
      <header><span className="eyebrow">{row.name} · {snapshot.cutoff === 0 ? 'before the signal' : row.changed ? 'changed at this moment' : 'retained context'}</span>
        <h2>{questions[selected]}</h2>
        {selected !== 'arbiter' && <p>{row.text}</p>}
      </header>
      {selected === 'arbiter' && <>
        <p className="presenter-reason">{d?.reason ?? 'The records are available. An action will only be proposed after a signal has been assessed.'}</p>
        {lane.previous && d && changes.length === 0 && lane.previous.title !== d.title && <div className="presenter-before"><span>Previously</span>{lane.previous.title}</div>}
        <DecisionContext compact snapshot={snapshot} person={person} inspect={onInspect} />
        <div className="presenter-decision-grid">
        {chosen && <EligibilityChecks checks={previewChecks} context={h.evidence} inspect={onInspect} />}
        {alternatives.length > 0 && <div className="presenter-alternatives"><span className="eyebrow">Why not another action?</span>{alternatives.map(c => <article key={c.id}><small>{c.status} · {c.agent}</small><strong>{c.title}</strong><p>{c.checks.find(check => check.state !== 'pass')?.detail ?? c.reason}</p></article>)}<small className="presenter-count">{allAlternatives} alternatives in the full trace</small></div>}
        </div>
        {chosen && <small className="presenter-count">Showing {previewChecks.length} of {chosen.checks.length} gates · {chosen.checks.filter(c => c.state === "pass").length} passed · full checks in the arbiter</small>}
      </>}
      {facts.length > 0 && <ul className="presenter-facts">{facts.slice(0, 4).map((f, i) => <li key={i}>{f.text}</li>)}</ul>}
      {selected === 'customer' && h.profile && <HouseholdCard compact p={h.profile} />}
      {selected === 'operations' && <RouterTelemetry snapshot={snapshot} focus={person} />}
      {selected === 'phone' && <div className="presenter-effect"><span className="eyebrow">{lane.message ? 'Recorded customer message' : 'No new delivery at this beat'}</span><p>{lane.message?.body ?? 'Earlier messages remain in the thread. No new message is being claimed here.'}</p></div>}
      {selected === 'phone' && !lane.message && d && <div className="presenter-quiet"><span className="eyebrow">Recorded decision · {d.disposition}</span><h3>{d.title}</h3><p>{d.reason}</p>{chosen?.wake && <div className="presenter-effect"><span className="eyebrow">Reconsider when</span><p>{chosen.wake}</p></div>}</div>}
      {selected === 'phone' && lane.message && <MessageExplanation compact action={lane.message} snapshot={snapshot} h={h} />}
      {selected === 'actions' && <><OutcomeProofs snapshot={snapshot} outcomes={outcomes.slice(-3)} inspect={onInspect} /><small className="presenter-count">Showing {Math.min(3, outcomes.length)} of {outcomes.length} outcome contracts · all evidence in the expanded view</small></>}
      {selected === 'governance' && <GovernanceEvidence snapshot={snapshot} />}
      {selected === 'review' && <><span className="eyebrow">Global study · all households and fixture moments</span><SwayTile /><p className="presenter-reason">Prebuilt rules sensitivity study. Inspect frozen-request model evaluations in the expanded review; this map is not a live safety score for this replay.</p></>}
      {['customer', 'operations'].includes(selected) && evidence.length > 0 && <div className="presenter-evidence"><span className="eyebrow">{selected === 'customer' ? 'Latest source · full history in customer memory' : 'Inspect the evidence'}</span>{evidence.slice(selected === 'customer' ? -1 : -2).map(e => <button key={e.id} onClick={() => onInspect(e)}><time>{new Date(e.occurredAt).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day:'numeric', month:'short' })}</time><span><strong>{e.description}</strong><small>{e.source} · {e.type}</small></span><span>↗</span></button>)}</div>}
      <button className="presenter-open" onClick={() => onOpen?.(selected)}>Open {row.name.toLowerCase()} <span>↗</span></button>
    </section>
    <div className="moment-phone">{phone}</div>
  </div>;
}
