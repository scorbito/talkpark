-- Fix Supabase Database Linter "Security Definer View" Critical 경고
--
-- 문제: public.profile_stats, public.verified_attendance_results 두 view가
--   기본 설정(security_invoker=off)으로 만들어져 있어 view 생성자(postgres)의
--   권한으로 baseline 테이블을 읽음 → RLS 우회 가능.
--
-- 해결: security_invoker=on으로 변경. view를 query하는 사용자의 권한 + RLS로 동작.
--   - service role(admin client)은 RLS bypass이므로 서버 액션 영향 없음.
--   - anon/authenticated가 직접 view를 query하면 baseline 테이블의 RLS가 평가됨
--     (현재 profiles는 public read, attendances/reviews는 자기 데이터만 read 가능).
--
-- Supabase SQL Editor에서 한 번 실행.

alter view public.verified_attendance_results set (security_invoker = on);
alter view public.profile_stats set (security_invoker = on);
