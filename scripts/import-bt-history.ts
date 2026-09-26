import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { Sql } from '../app/node_modules/postgres/types/index.d.ts';
import { database } from '../app/server/database.ts';
import { validateFixture, type HouseholdFixture } from '../app/server/data-model.ts';
import { fixtureHash, generateHistory } from './generate-bt-history.ts';

// Explicit order/allowlist: imports never accept arbitrary database table names.
export const domainTables = ['operations.products','ingestion.sources','customer.people','customer.households','customer.household_memberships','customer.accounts','customer.account_roles','customer.services','customer.contact_permissions','operations.assets','operations.service_dependencies','operations.orders','operations.incidents','operations.incident_services','operations.cases','operations.diagnostics','operations.conversations','operations.messages','operations.promises','operations.capacity_slots','operations.appointments'];
export async function importHistory(fixture: HouseholdFixture, sessionId: string, db: Sql) {
  const issues = validateFixture(fixture);
  if (issues.length) {
    const dir = resolve('app/.data/quarantine'); mkdirSync(dir,{recursive:true});
    writeFileSync(resolve(dir,`${randomUUID()}.json`),JSON.stringify({issues,fixture},null,2));
    throw new Error(`Fixture quarantined: ${issues.length} validation issues`);
  }
  const contentHash = fixtureHash(fixture), datasetId = `${fixture.datasetVersion}/${fixture.variant}/${fixture.seed}`;
  return db.begin(async sql => {
    await sql`select pg_advisory_xact_lock(hashtext(${sessionId}))`;
    const manifest = { datasetVersion:fixture.datasetVersion, seed:fixture.seed, timeZone:fixture.timeZone, scenarioStart:fixture.scenarioStart, variant:fixture.variant, events:fixture.events.length, contentHash };
    await sql`insert into runtime.datasets(id,seed,content_hash,manifest) values(${datasetId},${fixture.seed},${contentHash},${sql.json(manifest)}) on conflict do nothing`;
    const [dataset] = await sql`select content_hash from runtime.datasets where id=${datasetId}`;
    if(dataset.content_hash!==contentHash)throw new Error('Dataset version already exists with different content. Increment its version.');
    const [prior] = await sql`select dataset_id from runtime.sessions where id=${sessionId}`;
    if(prior) {
      if(prior.dataset_id!==datasetId)throw new Error('Session belongs to another fixture');
      return { sessionId, contentHash, inserted:0, duplicates:fixture.events.length, rejected:0 };
    }
    await sql`insert into runtime.sessions(id,dataset_id,variant) values(${sessionId},${datasetId},${fixture.variant})`;
    await Promise.all(domainTables.map(async table=> {
      const rows=(fixture.tables[table]||[]).map(r=>table==='operations.products'||table==='ingestion.sources'?r:{session_id:sessionId,...r});
      if(rows.length)await sql`insert into ${sql(table)} ${sql(rows)} on conflict do nothing`;
    }));
    const events=[...new Map(fixture.events.map(e=>[`${e.source}/${e.sourceEventId}`,e])).values()];
    await Promise.all(Array.from({length:Math.ceil(events.length/200)},async (_,batch)=>{
      const i=batch*200;
      const rows=events.slice(i,i+200).map(e=>({session_id:sessionId,id:e.id,source_id:e.source,source_event_id:e.sourceEventId,event_type:e.type,occurred_at:e.occurredAt,known_at:e.knownAt,person_id:e.personId,service_id:e.serviceId,case_id:e.caseId,description:e.description,payload:sql.json(e.payload as any),supersedes_id:e.supersedesId??null,correlation_id:e.correlationId??null}));
      await sql`insert into ingestion.events ${sql(rows)}`;
    }));
    return {sessionId,contentHash,inserted:events.length,duplicates:fixture.events.length-events.length,rejected:0};
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const db=database(true);
  try { console.log(await importHistory(generateHistory({variant:process.argv[2]||'canonical'}),process.argv[3]||randomUUID(),db)); }
  finally { await db.end(); }
}
