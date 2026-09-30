-- JSON (not JSONB) preserves object order for the fixture's existing SHA-256 hash.
alter table runtime.datasets add column fixture_snapshot json;
alter table runtime.datasets add constraint dataset_snapshot_object
  check (fixture_snapshot is null or (json_typeof(fixture_snapshot) = 'object'
    and encode(sha256(convert_to(fixture_snapshot::text, 'UTF8')), 'hex') = content_hash));
create function runtime.preserve_dataset_snapshot() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.content_hash is distinct from new.content_hash
     or (old.fixture_snapshot is not null and old.fixture_snapshot::text is distinct from new.fixture_snapshot::text) then
    raise exception 'Dataset content and completed snapshots are immutable';
  end if;
  return new;
end $$;
create trigger preserve_dataset_snapshot before update on runtime.datasets
  for each row execute function runtime.preserve_dataset_snapshot();
grant update(fixture_snapshot) on runtime.datasets to bt_runtime;
revoke all on function runtime.preserve_dataset_snapshot() from public,anon,authenticated;
