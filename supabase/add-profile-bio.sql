-- profiles.bio 컬럼 추가
-- 프로필 모달의 자기소개 필드.
-- - 150자 이내 한 줄 (앱 레벨에서 강제, DB는 길이 제한 없음)
-- - NULL 허용 (선택 입력)
-- - 줄바꿈 X, 이모지 O (앱 레벨에서 처리)

alter table public.profiles
  add column if not exists bio text;
