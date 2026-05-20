-- Optional Phase 8 RLS repair for public read seed tables.
-- Run this if anon reads return zero rows for public reference data.

grant usage on schema public to anon, authenticated;
grant select on public.teams to anon, authenticated;
grant select on public.games to anon, authenticated;
grant select on public.team_standings to anon, authenticated;

drop policy if exists "teams are public readable" on public.teams;
drop policy if exists "games are public readable" on public.games;
drop policy if exists "standings are public readable" on public.team_standings;

create policy "teams are public readable"
on public.teams
for select
to anon, authenticated
using (true);

create policy "games are public readable"
on public.games
for select
to anon, authenticated
using (true);

create policy "standings are public readable"
on public.team_standings
for select
to anon, authenticated
using (true);

