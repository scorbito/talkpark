-- Re-create missing views and reload PostgREST schema cache.
-- Run this in Supabase SQL Editor if profile_stats / verified_attendance_results are missing.

create or replace function public.game_result_for_support_team(
  home_team_id text,
  away_team_id text,
  home_score integer,
  away_score integer,
  support_team_id text
) returns public.attendance_result
language sql immutable as $$
  select case
    when home_score is null or away_score is null then null
    when home_score = away_score then 'draw'::public.attendance_result
    when support_team_id = home_team_id and home_score > away_score then 'win'::public.attendance_result
    when support_team_id = away_team_id and away_score > home_score then 'win'::public.attendance_result
    when support_team_id in (home_team_id, away_team_id) then 'lose'::public.attendance_result
    else null
  end;
$$;

create or replace view public.verified_attendance_results
with (security_invoker = on) as
select
  a.id,
  a.user_id,
  a.game_id,
  a.support_team_id,
  public.game_result_for_support_team(
    g.home_team_id,
    g.away_team_id,
    g.home_score,
    g.away_score,
    a.support_team_id
  ) as result
from public.attendances a
join public.games g on g.id = a.game_id
where a.verified = true
  and g.status = 'finished';

create or replace view public.profile_stats
with (security_invoker = on) as
select
  p.id as user_id,
  count(r.id)::integer as attendance_count,
  count(r.id) filter (where r.result = 'win')::integer as wins,
  count(r.id) filter (where r.result = 'lose')::integer as losses,
  count(r.id) filter (where r.result = 'draw')::integer as draws,
  case
    when count(r.id) filter (where r.result in ('win', 'lose')) = 0 then 0
    else round(
      (count(r.id) filter (where r.result = 'win'))::numeric
      / nullif(count(r.id) filter (where r.result in ('win', 'lose')), 0),
      3
    )
  end as win_rate
from public.profiles p
left join public.verified_attendance_results r on r.user_id = p.id
group by p.id;

notify pgrst, 'reload schema';
