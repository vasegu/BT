export type Row = { id: string; [key: string]: string | number | boolean | null };
export type FixtureEvent = {
  id: string; source: string; sourceEventId: string; type: string;
  occurredAt: string; knownAt: string; personId: string | null;
  serviceId: string | null; caseId: string | null;
  description: string; payload: Record<string, unknown>;
  supersedesId?: string; correlationId?: string;
};
export type HouseholdFixture = {
  datasetVersion: string; seed: number; scenarioStart: string;
  timeZone: 'Europe/London'; variant: string;
  tables: Record<string, Row[]>; events: FixtureEvent[];
};
export type ValidationIssue = { record: string; code: string; detail: string };
export const foreignKeys: Record<string, Record<string, string>> = {
  'customer.household_memberships':{person_id:'customer.people',household_id:'customer.households'},
  'customer.accounts':{household_id:'customer.households'},
  'customer.account_roles':{person_id:'customer.people',account_id:'customer.accounts'},
  'customer.services':{account_id:'customer.accounts',household_id:'customer.households',product_id:'operations.products'},
  'customer.contact_permissions':{person_id:'customer.people',account_id:'customer.accounts'},
  'operations.service_dependencies':{service_id:'customer.services',asset_id:'operations.assets'},
  'operations.orders':{service_id:'customer.services'},
  'operations.incident_services':{incident_id:'operations.incidents',service_id:'customer.services'},
  'operations.cases':{service_id:'customer.services'},
  'operations.diagnostics':{service_id:'customer.services',case_id:'operations.cases'},
  'operations.conversations':{person_id:'customer.people',service_id:'customer.services',case_id:'operations.cases'},
  'operations.messages':{conversation_id:'operations.conversations'},
  'operations.promises':{case_id:'operations.cases'},
  'operations.appointments':{case_id:'operations.cases',slot_id:'operations.capacity_slots'},
};
export function validateFixture(fixture: HouseholdFixture): ValidationIssue[] {
  const issues: ValidationIssue[]=[];
  const issue=(record:string,code:string,detail:string)=>issues.push({record,code,detail});
  const exists=(table:string,id:unknown)=>typeof id==='string' && fixture.tables[table]?.some(r=>r.id===id);
  const date=(value:unknown)=>typeof value==='string' && Number.isFinite(Date.parse(value));
  for(const [table,rows] of Object.entries(fixture.tables)) {
    const seen=new Set<string>();
    for(const row of rows) {
      if(seen.has(row.id))issue(row.id,'duplicate',`Duplicate ${table} identity`); seen.add(row.id);
      for(const [field,target] of Object.entries(foreignKeys[table]||{}))
        if(row[field]!=null&&!exists(target,row[field]))issue(row.id,'foreign_key',`${field} does not reference ${target}`);
      for(const [start,end] of [['ordered_at','activated_at'],['ordered_at','delivered_at'],['opened_at','closed_at'],['created_at','fulfilled_at'],['created_at','due_at'],['valid_from','valid_to'],['starts_at','ends_at']])
        if(row[start]!=null&&row[end]!=null&&(!date(row[start])||!date(row[end])||String(row[start])>String(row[end])))issue(row.id,'lifecycle',`${end} must follow ${start}`);
      if(table==='customer.contact_permissions'&&row.allowed===true) {
        const role=fixture.tables['customer.account_roles']?.find(r=>r.person_id===row.person_id&&r.account_id===row.account_id&&['account_holder','authorised_contact'].includes(String(r.role))&&String(r.valid_from)<=String(row.valid_from)&&(r.valid_to==null||String(r.valid_to)>String(row.valid_from)));
        if(!role)issue(row.id,'authority','Permission requires an effective account role, not household membership');
      }
      if(table==='customer.services') {
        const account=fixture.tables['customer.accounts']?.find(a=>a.id===row.account_id);
        if(account&&account.household_id!==row.household_id)issue(row.id,'scope','Service and account belong to different households');
      }
    }
  }
  const seen=new Map<string,string>(), events=new Map(fixture.events.map(e=>[e.id,e]));
  for(const e of fixture.events) {
    if(!date(e.occurredAt)||!date(e.knownAt)||e.knownAt<e.occurredAt)issue(e.id,'time','knownAt must follow occurredAt');
    for(const [id,table] of [[e.personId,'customer.people'],[e.serviceId,'customer.services'],[e.caseId,'operations.cases'],[e.source,'ingestion.sources']] as const)
      if(id&&!exists(table,id))issue(e.id,'foreign_key',`Unknown ${table} reference`);
    const key=`${e.source}/${e.sourceEventId}`, body=JSON.stringify(e);
    if(seen.has(key)&&seen.get(key)!==body)issue(e.id,'source_conflict','Source key has conflicting content'); seen.set(key,body);
    if(e.supersedesId&&(!events.has(e.supersedesId)||events.get(e.supersedesId)!.knownAt>e.knownAt))issue(e.id,'correction','Correction requires an already available event');
    if(e.type==='pattern.recorded'&&(!Array.isArray(e.payload.evidenceIds)||!e.payload.evidenceIds.length||e.payload.evidenceIds.some(id=>!events.has(String(id)))))issue(e.id,'unsupported_pattern','Pattern must reference its observations');
    if(e.type==='promise.fulfilled'&&!exists('operations.promises',e.payload.promiseId))issue(e.id,'foreign_key','Fulfilment requires the original promise');
  }
  return issues;
}
