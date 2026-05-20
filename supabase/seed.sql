-- Phase 8 seed data. Run after supabase/schema.sql.

insert into public.teams (id, name, short_name, initial, color, accent) values
  ('doosan', '두산 베어스', '두산', 'D', '#131230', '#ED1C24'),
  ('lg', 'LG 트윈스', 'LG', 'L', '#C30452', '#000000'),
  ('kt', 'KT 위즈', 'KT', 'K', '#000000', '#EB1C24'),
  ('ssg', 'SSG 랜더스', 'SSG', 'S', '#CE0E2D', '#FFB81C'),
  ('nc', 'NC 다이노스', 'NC', 'N', '#315288', '#A77C40'),
  ('kiwoom', '키움 히어로즈', '키움', 'K', '#570514', null),
  ('samsung', '삼성 라이온즈', '삼성', 'S', '#074CA1', null),
  ('lotte', '롯데 자이언츠', '롯데', 'L', '#041E42', '#ED1C24'),
  ('kia', 'KIA 타이거즈', 'KIA', 'K', '#EA0029', '#06141F'),
  ('hanwha', '한화 이글스', '한화', 'H', '#FF6600', '#07274C')
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  initial = excluded.initial,
  color = excluded.color,
  accent = excluded.accent;

insert into public.games (
  external_id,
  game_date,
  game_time,
  stadium,
  home_team_id,
  away_team_id,
  home_score,
  away_score,
  status,
  innings
) values
  ('mock-20250510-doosan-lg', '2025-05-10', '14:00', '잠실', 'doosan', 'lg', 3, 5, 'finished', 9),
  ('mock-20250510-kia-lotte', '2025-05-10', '17:00', '사직', 'kia', 'lotte', null, null, 'scheduled', null),
  ('mock-20250510-ssg-samsung', '2025-05-10', '17:00', '대구', 'ssg', 'samsung', null, null, 'scheduled', null),
  ('mock-20250510-kt-hanwha', '2025-05-10', '17:00', '수원', 'kt', 'hanwha', null, null, 'scheduled', null),
  ('mock-20250517-lg-hanwha', '2025-05-17', '14:00', '잠실', 'lg', 'hanwha', null, null, 'scheduled', null),
  ('mock-20250524-hanwha-kia', '2025-05-24', '18:00', '대전', 'hanwha', 'kia', null, null, 'scheduled', null),
  ('mock-20250508-kt-lg', '2025-05-08', '18:30', '수원', 'kt', 'lg', 2, 6, 'finished', 9),
  ('mock-20250506-lotte-lg', '2025-05-06', '18:30', '사직', 'lotte', 'lg', 1, 4, 'finished', 9),
  ('mock-20250502-ssg-nc', '2025-05-02', '18:30', '문학', 'ssg', 'nc', 3, 2, 'finished', 9),
  ('mock-20250430-hanwha-kia', '2025-04-30', '18:30', '대전', 'hanwha', 'kia', 7, 12, 'finished', 9)
on conflict (external_id) do update set
  game_date = excluded.game_date,
  game_time = excluded.game_time,
  stadium = excluded.stadium,
  home_team_id = excluded.home_team_id,
  away_team_id = excluded.away_team_id,
  home_score = excluded.home_score,
  away_score = excluded.away_score,
  status = excluded.status,
  innings = excluded.innings;

insert into public.team_standings (
  team_id,
  season,
  rank,
  wins,
  draws,
  losses,
  games_behind,
  form
) values
  ('samsung', 2025, 1, 45, 2, 30, '-', array['win','win','lose','win','win']::attendance_result[]),
  ('kia', 2025, 2, 44, 1, 31, '1.0', array['win','lose','win','win','lose']::attendance_result[]),
  ('hanwha', 2025, 3, 42, 2, 32, '2.5', array['win','win','win','lose','draw']::attendance_result[]),
  ('lg', 2025, 4, 42, 4, 31, '3.0', array['lose','win','win','lose','draw']::attendance_result[]),
  ('ssg', 2025, 5, 37, 3, 30, '3.5', array['win','lose','win','draw','win']::attendance_result[]),
  ('kt', 2025, 6, 34, 2, 32, '6.0', array['lose','win','lose','win','draw']::attendance_result[]),
  ('nc', 2025, 7, 32, 3, 31, '8.5', array['win','draw','lose','lose','win']::attendance_result[]),
  ('doosan', 2025, 8, 29, 6, 32, '12.0', array['lose','lose','win','draw','lose']::attendance_result[]),
  ('lotte', 2025, 9, 28, 7, 31, '13.0', array['win','lose','draw','lose','lose']::attendance_result[]),
  ('kiwoom', 2025, 10, 24, 1, 41, '20.5', array['lose','lose','lose','win','lose']::attendance_result[])
on conflict (team_id, season) do update set
  rank = excluded.rank,
  wins = excluded.wins,
  draws = excluded.draws,
  losses = excluded.losses,
  games_behind = excluded.games_behind,
  form = excluded.form,
  synced_at = now();

