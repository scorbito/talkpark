-- 같은 user_id가 같은 game_date에 여러 직관을 가진 케이스 점검.
-- check_one_attendance_per_day() trigger 적용 전 반드시 실행해서 중복이 없는지 확인.
-- 중복이 있으면 trigger 추가가 막힐 수 있고, 정책상 정리(가장 오래된 것 유지 등)가 필요하다.

select g.game_date,
       a.user_id,
       count(*)            as attendance_count,
       array_agg(a.id order by a.created_at) as attendance_ids
from public.attendances a
join public.games g on g.id = a.game_id
group by g.game_date, a.user_id
having count(*) > 1
order by g.game_date desc, a.user_id;

-- 결과가 없으면 안전하게 trigger 적용 가능.
-- 결과가 있으면 attendance_ids[2:] 행들을 어떻게 처리할지 결정한 뒤 진행.
