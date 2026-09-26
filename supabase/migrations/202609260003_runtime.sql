begin;
create table runtime.jobs (
 session_id uuid not null references runtime.sessions(id), id uuid not null default gen_random_uuid(), revision integer not null,
 step text not null, idempotency_key text not null, state text not null default 'pending' check(state in ('pending','running','failed','complete')),
 attempts integer not null default 0, error text, lease_token uuid, lease_until timestamptz,
 primary key(session_id,id), unique(session_id,revision), unique(session_id,idempotency_key)
);
create table runtime.flags (
 session_id uuid not null, id uuid not null, person_id uuid not null, event_id uuid not null,
 revision integer not null, agent text not null, observation text not null,
 primary key(session_id,id), foreign key(session_id,person_id) references customer.people(session_id,id),
 foreign key(session_id,event_id) references ingestion.events(session_id,id)
);
create table runtime.assessments (
 session_id uuid not null, job_id uuid not null, person_id uuid not null, state text not null check(state in ('started','recorded')),
 context_hash text not null, context jsonb not null, request jsonb not null, data jsonb,
 primary key(session_id,job_id,person_id), foreign key(session_id,job_id) references runtime.jobs(session_id,id),
 foreign key(session_id,person_id) references customer.people(session_id,id)
);
create table runtime.decisions (
 session_id uuid not null, id uuid not null, person_id uuid not null, job_id uuid not null, revision integer not null,
 data jsonb not null, primary key(session_id,id), unique(session_id,person_id,revision),
 foreign key(session_id,job_id,person_id) references runtime.assessments(session_id,job_id,person_id)
);
create table runtime.actions (
 session_id uuid not null, id uuid not null, person_id uuid not null, decision_id uuid not null, revision integer not null,
 logical_key text not null, intended_expression jsonb not null, data jsonb not null,
 primary key(session_id,id), unique(session_id,person_id,logical_key),
 foreign key(session_id,person_id) references customer.people(session_id,id),
 foreign key(session_id,decision_id) references runtime.decisions(session_id,id)
);
create table runtime.receipts (
 session_id uuid not null, id uuid not null, action_id uuid not null,
 provenance text not null check(provenance='simulated_delivery'), created_at timestamptz not null default now(),
 primary key(session_id,id), unique(session_id,action_id), foreign key(session_id,action_id) references runtime.actions(session_id,id)
);
create table runtime.expectations (
 session_id uuid not null, id uuid not null, person_id uuid not null, decision_id uuid not null, scope_id uuid not null,
 goal text not null, revision integer not null, data jsonb not null, primary key(session_id,id),
 unique(session_id,person_id,goal,scope_id), foreign key(session_id,person_id) references customer.people(session_id,id),
 foreign key(session_id,decision_id) references runtime.decisions(session_id,id),
 foreign key(session_id,scope_id) references ingestion.events(session_id,id)
);
create table runtime.outcome_observations (
 session_id uuid not null, expectation_id uuid not null, revision integer not null, data jsonb not null,
 primary key(session_id,expectation_id,revision), foreign key(session_id,expectation_id) references runtime.expectations(session_id,id)
);
-- Model calls never run inside a database transaction. Started attempts survive lease recovery.
-- The local presenter server has a dedicated role; anon/authenticated retain no domain grants.
do $$ begin if not exists(select 1 from pg_roles where rolname='bt_runtime') then create role bt_runtime login; end if; end $$;
grant connect on database postgres to bt_runtime;
grant usage on schema customer,operations,ingestion,memory,runtime,extensions to bt_runtime;
grant select,insert on all tables in schema customer,operations,ingestion,memory,runtime to bt_runtime;
grant update on runtime.sessions,runtime.jobs,runtime.assessments to bt_runtime;
do $$ declare r record; begin
 for r in select schemaname,tablename from pg_tables where schemaname in ('customer','operations','ingestion','memory','runtime') loop
  execute format('alter table %I.%I enable row level security',r.schemaname,r.tablename);
  execute format('revoke all on %I.%I from public,anon,authenticated',r.schemaname,r.tablename);
  execute format('create policy private_presenter on %I.%I to bt_runtime using (true) with check (true)',r.schemaname,r.tablename);
 end loop;
end $$;
commit;
