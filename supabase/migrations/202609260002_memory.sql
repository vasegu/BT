begin;
create extension if not exists vector with schema extensions;
create table memory.items (
 session_id uuid not null references runtime.sessions(id), id uuid not null,
 person_id uuid not null, service_id uuid not null, kind text not null check(kind in ('episode','preference','pattern')),
 epistemic text not null check(epistemic in ('observed','stated','derived','hypothesis')),
 text text not null, available_from timestamptz not null, content_hash text not null, derivation_version text not null,
 measurement jsonb, primary key(session_id,id),
 foreign key(session_id,person_id) references customer.people(session_id,id),
 foreign key(session_id,service_id) references customer.services(session_id,id)
);
create table memory.evidence (
 session_id uuid not null, memory_id uuid not null, event_id uuid not null,
 primary key(session_id,memory_id,event_id),
 foreign key(session_id,memory_id) references memory.items(session_id,id),
 foreign key(session_id,event_id) references ingestion.events(session_id,id)
);
create table memory.embeddings (
 session_id uuid not null, memory_id uuid not null, model text not null,
 artifact_hash text not null, content_hash text not null, vector extensions.vector(384) not null,
 created_at timestamptz not null default now(), primary key(session_id,memory_id,model,artifact_hash),
 foreign key(session_id,memory_id) references memory.items(session_id,id)
);
alter table memory.items enable row level security;
alter table memory.evidence enable row level security;
alter table memory.embeddings enable row level security;
revoke all on all tables in schema memory from public,anon,authenticated;
commit;
