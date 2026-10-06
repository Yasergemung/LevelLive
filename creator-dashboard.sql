-- LevelLive: secure RLS policies for streams
-- Run this in Supabase SQL Editor.

alter table public.streams enable row level security;

drop policy if exists "Anyone can view live streams" on public.streams;
drop policy if exists "Creators can view own streams" on public.streams;
drop policy if exists "Creators can create own streams" on public.streams;
drop policy if exists "Creators can update own streams" on public.streams;

create policy "Anyone can view live streams"
on public.streams
for select
to anon, authenticated
using (is_live = true);

create policy "Creators can view own streams"
on public.streams
for select
to authenticated
using (
    auth.uid() = creator_id
);

create policy "Creators can create own streams"
on public.streams
for insert
to authenticated
with check (
    auth.uid() = creator_id
    and exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
        and profiles.role in ('creator', 'admin')
        and profiles.creator_approved = true
    )
);

create policy "Creators can update own streams"
on public.streams
for update
to authenticated
using (
    auth.uid() = creator_id
    and exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
        and profiles.role in ('creator', 'admin')
        and profiles.creator_approved = true
    )
)
with check (
    auth.uid() = creator_id
    and exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
        and profiles.role in ('creator', 'admin')
        and profiles.creator_approved = true
    )
);
