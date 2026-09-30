-- The story continues past tonight: the morning after, the working week, six weeks on.
-- Steps 6 to 8 are appended; earlier sessions and code never pass step 5, so this is compatible.
alter table runtime.sessions drop constraint if exists sessions_step_check;
alter table runtime.sessions add constraint sessions_step_check check (step between 0 and 8);
