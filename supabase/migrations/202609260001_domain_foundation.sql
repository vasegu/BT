begin;
create schema if not exists runtime;
create schema if not exists customer;
create schema if not exists operations;
create schema if not exists ingestion;
create schema if not exists memory;

create table runtime.datasets (
  id text primary key, seed bigint not null, content_hash text not null,
  manifest jsonb not null check(jsonb_typeof(manifest)='object'), created_at timestamptz not null default now()
);
create table runtime.sessions (
  id uuid primary key default gen_random_uuid(), dataset_id text not null references runtime.datasets(id),
  variant text not null default 'canonical', step integer not null default 0 check(step between 0 and 5),
  revision integer not null default 0 check(revision>=0), created_at timestamptz not null default now(),
  presenter_id uuid references auth.users(id)
);
create table operations.products (
  id uuid primary key, name text not null, kind text not null check(kind in ('broadband','mobile','tv')),
  provenance text not null default 'synthetic_catalogue' check(provenance='synthetic_catalogue')
);
create table ingestion.sources (
  id uuid primary key, name text not null, system_kind text not null,
  provenance text not null default 'synthetic_source' check(provenance='synthetic_source')
);
create table customer.people (
  session_id uuid not null references runtime.sessions(id), id uuid not null, alias text not null, name text not null,
  primary key(session_id,id), unique(session_id,alias)
);
create table customer.households (
  session_id uuid not null references runtime.sessions(id), id uuid not null, label text not null,
  primary key(session_id,id)
);
create table customer.household_memberships (
  session_id uuid not null references runtime.sessions(id), id uuid not null, person_id uuid not null, household_id uuid not null,
  valid_from timestamptz not null, valid_to timestamptz, primary key(session_id,id), check(valid_to>valid_from),
  foreign key(session_id,person_id) references customer.people(session_id,id),
  foreign key(session_id,household_id) references customer.households(session_id,id)
);
create table customer.accounts (
  session_id uuid not null references runtime.sessions(id), id uuid not null, household_id uuid not null, reference text not null,
  primary key(session_id,id), unique(session_id,reference), unique(session_id,id,household_id),
  foreign key(session_id,household_id) references customer.households(session_id,id)
);
create table customer.account_roles (
  session_id uuid not null references runtime.sessions(id), id uuid not null, person_id uuid not null, account_id uuid not null,
  role text not null check(role in ('account_holder','authorised_contact')), valid_from timestamptz not null, valid_to timestamptz,
  primary key(session_id,id), check(valid_to>valid_from),
  foreign key(session_id,person_id) references customer.people(session_id,id),
  foreign key(session_id,account_id) references customer.accounts(session_id,id)
);
create table customer.services (
  session_id uuid not null references runtime.sessions(id), id uuid not null, account_id uuid not null, household_id uuid not null,
  product_id uuid not null references operations.products(id), reference text not null,
  lifecycle text not null check(lifecycle in ('ordered','delivered','provisioning','active','ceased','unknown')),
  ordered_at timestamptz not null, activated_at timestamptz,
  primary key(session_id,id), unique(session_id,reference), check(activated_at>=ordered_at),
  foreign key(session_id,account_id,household_id) references customer.accounts(session_id,id,household_id)
);
create table customer.contact_permissions (
  session_id uuid not null references runtime.sessions(id), id uuid not null, person_id uuid not null, account_id uuid not null,
  purpose text not null check(purpose in ('service','marketing')), channel text not null check(channel in ('in_app','sms','phone','email')),
  allowed boolean not null, valid_from timestamptz not null, valid_to timestamptz, source_event_id uuid not null,
  primary key(session_id,id), check(valid_to>valid_from),
  foreign key(session_id,person_id) references customer.people(session_id,id),
  foreign key(session_id,account_id) references customer.accounts(session_id,id)
);
create table operations.assets (
  session_id uuid not null references runtime.sessions(id), id uuid not null, reference text not null, kind text not null,
  primary key(session_id,id), unique(session_id,reference)
);
create table operations.service_dependencies (
  session_id uuid not null references runtime.sessions(id), id uuid not null, service_id uuid not null, asset_id uuid not null,
  valid_from timestamptz not null, valid_to timestamptz,
  primary key(session_id,id), check(valid_to>valid_from),
  foreign key(session_id,service_id) references customer.services(session_id,id),
  foreign key(session_id,asset_id) references operations.assets(session_id,id)
);
create table operations.orders (
  session_id uuid not null references runtime.sessions(id), id uuid not null, service_id uuid not null, reference text not null,
  status text not null check(status in ('accepted','dispatched','delivered','cancelled')), ordered_at timestamptz not null,
  dispatched_at timestamptz, delivered_at timestamptz, source_event_id uuid not null,
  primary key(session_id,id), unique(session_id,reference), check(dispatched_at>=ordered_at), check(delivered_at>=coalesce(dispatched_at,ordered_at)),
  foreign key(session_id,service_id) references customer.services(session_id,id)
);
create table operations.incidents (
  session_id uuid not null references runtime.sessions(id), id uuid not null, reference text not null, status text not null,
  description text not null, opened_at timestamptz not null, resolved_at timestamptz, source_event_id uuid not null,
  primary key(session_id,id), unique(session_id,reference), check(resolved_at>=opened_at)
);
create table operations.incident_services (
  session_id uuid not null references runtime.sessions(id), id uuid not null, incident_id uuid not null, service_id uuid not null,
  membership text not null check(membership in ('affected','excluded','unknown')), valid_from timestamptz not null, valid_to timestamptz,
  source_event_id uuid not null, primary key(session_id,id), check(valid_to>valid_from),
  foreign key(session_id,incident_id) references operations.incidents(session_id,id),
  foreign key(session_id,service_id) references customer.services(session_id,id)
);
create table operations.cases (
  session_id uuid not null references runtime.sessions(id), id uuid not null, service_id uuid not null, reference text not null,
  owner_ref text, status text not null check(status in ('open','closed')), description text not null,
  opened_at timestamptz not null, closed_at timestamptz, source_event_id uuid not null,
  primary key(session_id,id), unique(session_id,reference), check(closed_at>=opened_at),
  foreign key(session_id,service_id) references customer.services(session_id,id)
);
create table operations.diagnostics (
  session_id uuid not null references runtime.sessions(id), id uuid not null, service_id uuid not null, case_id uuid,
  test_name text not null, result text not null, measured_value numeric, unit text,
  started_at timestamptz not null, completed_at timestamptz not null, source_event_id uuid not null,
  primary key(session_id,id), check(completed_at>=started_at),
  foreign key(session_id,service_id) references customer.services(session_id,id),
  foreign key(session_id,case_id) references operations.cases(session_id,id)
);
create table operations.conversations (
  session_id uuid not null references runtime.sessions(id), id uuid not null, person_id uuid not null, service_id uuid not null, case_id uuid,
  channel text not null check(channel in ('in_app','phone','web_chat','email')), started_at timestamptz not null, ended_at timestamptz,
  retention_basis text not null, primary key(session_id,id), check(ended_at>=started_at),
  foreign key(session_id,person_id) references customer.people(session_id,id),
  foreign key(session_id,service_id) references customer.services(session_id,id),
  foreign key(session_id,case_id) references operations.cases(session_id,id)
);
create table operations.messages (
  session_id uuid not null references runtime.sessions(id), id uuid not null, conversation_id uuid not null,
  speaker_role text not null check(speaker_role in ('customer','adviser','assistant')), speaker_ref text not null,
  sent_at timestamptz not null, body text not null, source_event_id uuid not null,
  primary key(session_id,id), foreign key(session_id,conversation_id) references operations.conversations(session_id,id)
);
create table operations.promises (
  session_id uuid not null references runtime.sessions(id), id uuid not null, case_id uuid not null, owner_ref text not null,
  kind text not null, created_at timestamptz not null, due_at timestamptz not null, fulfilled_at timestamptz,
  source_event_id uuid not null, fulfilment_event_id uuid,
  primary key(session_id,id), check(due_at>=created_at), check(fulfilled_at>=created_at),
  check((fulfilled_at is null)=(fulfilment_event_id is null)),
  foreign key(session_id,case_id) references operations.cases(session_id,id)
);
create table operations.capacity_slots (
  session_id uuid not null references runtime.sessions(id), id uuid not null, owner_ref text, kind text not null,
  starts_at timestamptz not null, ends_at timestamptz not null, source_event_id uuid not null,
  primary key(session_id,id), check(ends_at>starts_at)
);
create table operations.appointments (
  session_id uuid not null references runtime.sessions(id), id uuid not null, case_id uuid not null, slot_id uuid not null,
  status text not null check(status in ('held','confirmed','completed','cancelled')), source_event_id uuid not null,
  primary key(session_id,id), foreign key(session_id,case_id) references operations.cases(session_id,id),
  foreign key(session_id,slot_id) references operations.capacity_slots(session_id,id)
);
create unique index one_slot_owner on operations.appointments(session_id,slot_id) where status<>'cancelled';
create table ingestion.events (
  session_id uuid not null references runtime.sessions(id), id uuid not null, source_id uuid not null references ingestion.sources(id),
  source_event_id text not null, event_type text not null, schema_version integer not null default 1 check(schema_version=1),
  occurred_at timestamptz not null, known_at timestamptz not null, ingested_at timestamptz not null default now(),
  person_id uuid, service_id uuid, case_id uuid, description text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'), supersedes_id uuid, correlation_id text,
  provenance text not null default 'synthetic_source' check(provenance='synthetic_source'),
  primary key(session_id,id), unique(session_id,source_id,source_event_id), check(known_at>=occurred_at),
  foreign key(session_id,person_id) references customer.people(session_id,id),
  foreign key(session_id,service_id) references customer.services(session_id,id),
  foreign key(session_id,case_id) references operations.cases(session_id,id) deferrable initially deferred,
  foreign key(session_id,supersedes_id) references ingestion.events(session_id,id) deferrable initially deferred
);
create index events_as_of on ingestion.events(session_id,known_at,occurred_at);
create index events_service on ingestion.events(session_id,service_id,event_type);
-- Canonical projections retain source evidence. Deferred FKs permit one atomic import.
do $$ declare r record; begin
  for r in select table_schema,table_name,column_name from information_schema.columns
    where table_schema in ('customer','operations') and column_name in ('source_event_id','fulfilment_event_id') loop
    execute format('alter table %I.%I add foreign key(session_id,%I) references ingestion.events(session_id,id) deferrable initially deferred',r.table_schema,r.table_name,r.column_name);
  end loop;
end $$;
create function ingestion.protect_event() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Source events are append-only; append a correction'; end $$;
create trigger events_append_only before update or delete on ingestion.events for each row execute function ingestion.protect_event();

-- Private domain schemas: no browser access. Backend RPCs are explicitly granted in later migrations.
do $$ declare s text; r record; begin
  foreach s in array array['customer','operations','ingestion','memory','runtime'] loop
    execute format('revoke all on schema %I from public, anon, authenticated',s);
    execute format('revoke all on all tables in schema %I from public, anon, authenticated',s);
    execute format('revoke all on all functions in schema %I from public, anon, authenticated',s);
    execute format('alter default privileges in schema %I revoke execute on functions from public',s);
  end loop;
  for r in select schemaname,tablename from pg_tables where schemaname in ('customer','operations','ingestion','memory','runtime') loop
    execute format('alter table %I.%I enable row level security',r.schemaname,r.tablename);
  end loop;
end $$;
comment on schema customer is 'Synthetic BT people, account authority, households and services; a household is not an authorisation boundary.';
comment on schema operations is 'Source-backed service, care, incident and capacity projections. Historical decisions use the event ledger.';
comment on schema ingestion is 'Immutable synthetic observations. known_at is simulated receipt; ingested_at is physical import.';
commit;
