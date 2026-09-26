begin;
do $$ declare r record; sid uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); person uuid:=gen_random_uuid(); house uuid:=gen_random_uuid(); begin
  assert (select count(*) from pg_tables where schemaname in ('customer','operations','ingestion'))=22, 'Expected 22 canonical domain tables';
  for r in select schemaname,tablename from pg_tables where schemaname in ('customer','operations','ingestion','memory','runtime') loop
    assert not has_table_privilege('anon',format('%I.%I',r.schemaname,r.tablename),'select'), 'Anonymous table grant';
    assert not has_table_privilege('authenticated',format('%I.%I',r.schemaname,r.tablename),'insert'), 'Unexpected client write grant';
    assert (select relrowsecurity from pg_class where oid=format('%I.%I',r.schemaname,r.tablename)::regclass), 'RLS missing';
  end loop;
  insert into runtime.datasets(id,seed,content_hash,manifest) values('__constraint_test__',1,'test','{}');
  insert into runtime.sessions(id,dataset_id) values(sid,'__constraint_test__'),(other,'__constraint_test__');
  insert into customer.people values(sid,person,'test','Synthetic test');
  insert into customer.households values(other,house,'Other session');
  begin
    insert into customer.household_memberships values(sid,gen_random_uuid(),person,house,now(),null);
    raise exception 'Cross-session relationship accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into customer.household_memberships values(sid,gen_random_uuid(),person,house,now(),now()-interval '1 day');
    raise exception 'Invalid validity period accepted';
  exception when check_violation then null; end;
end $$;
do $$ declare sid uuid:='b2260926-0000-4000-a000-000000000001'; begin
 if exists(select 1 from runtime.sessions where id=sid) then
  begin
   insert into ingestion.events select session_id,gen_random_uuid(),source_id,source_event_id,event_type,schema_version,occurred_at,known_at,ingested_at,person_id,service_id,case_id,description,payload,supersedes_id,correlation_id,provenance from ingestion.events where session_id=sid limit 1;
   raise exception 'Duplicate source accepted';
  exception when unique_violation then null; end;
  begin
   insert into operations.appointments select session_id,gen_random_uuid(),case_id,slot_id,status,source_event_id from operations.appointments where session_id=sid limit 1;
   raise exception 'Competing slot reservation accepted';
  exception when unique_violation then null; end;
  begin
   update ingestion.events set description='rewrite' where session_id=sid;
   raise exception 'Event rewrite accepted';
  exception when raise_exception then
   if sqlerrm not like 'Source events are append-only%' then raise; end if;
  end;
 end if;
end $$;
rollback;
select 'domain constraints and private access passed' as result;
