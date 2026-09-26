begin;
alter table operations.cases add unique(session_id,id,service_id);
alter table operations.diagnostics add foreign key(session_id,case_id,service_id) references operations.cases(session_id,id,service_id) deferrable initially deferred;
alter table operations.conversations add foreign key(session_id,case_id,service_id) references operations.cases(session_id,id,service_id) deferrable initially deferred;
alter table ingestion.events add constraint case_requires_service check(case_id is null or service_id is not null);
alter table ingestion.events add foreign key(session_id,case_id,service_id) references operations.cases(session_id,id,service_id) deferrable initially deferred;
create function ingestion.check_correction() returns trigger language plpgsql set search_path='' as $$
declare prior ingestion.events; begin
 if new.supersedes_id is not null then
  select * into strict prior from ingestion.events where session_id=new.session_id and id=new.supersedes_id;
  if prior.known_at>new.known_at or (prior.person_id,prior.service_id,prior.case_id) is distinct from (new.person_id,new.service_id,new.case_id) then
   raise exception 'Correction changes subject or precedes its source';
  end if;
 end if;
 return new;
end $$;
create constraint trigger correction_scope after insert on ingestion.events deferrable initially deferred for each row execute function ingestion.check_correction();
create function memory.check_evidence() returns trigger language plpgsql set search_path='' as $$
declare m memory.items; e ingestion.events; begin
 select * into strict m from memory.items where session_id=new.session_id and id=new.memory_id;
 select * into strict e from ingestion.events where session_id=new.session_id and id=new.event_id;
 if (m.person_id,m.service_id) is distinct from (e.person_id,e.service_id) or e.known_at>m.available_from then
  raise exception 'Memory evidence must match person/service scope and availability';
 end if;
 return new;
end $$;
create constraint trigger memory_evidence_scope after insert on memory.evidence deferrable initially deferred for each row execute function memory.check_evidence();
revoke all on function ingestion.check_correction(), memory.check_evidence() from public,anon,authenticated;
commit;
