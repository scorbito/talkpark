-- v0.10.0 notice seed: Match Talk release
--
-- Run this in Supabase SQL Editor with an admin/service role.
-- The fixed id keeps this notice idempotent across repeated runs.

insert into public.notices (id, title, body, is_pinned, published_at)
values (
  '9e596d13-54b4-4bc8-a91f-43c234ba3d2b',
  '경기톡이 새로 추가되었어요',
  E'이제 커뮤니티에서 경기별로 모여 짧게 이야기할 수 있는 경기톡을 사용할 수 있어요.\n\n새로 추가된 기능:\n- 커뮤니티 안에 [경기톡] 탭이 추가되었어요.\n- 특정 KBO 경기를 골라 응원, 환호, 분노, 불안 같은 감정 태그와 함께 글을 남길 수 있어요.\n- 사진은 선택으로 1장까지 첨부할 수 있고, 본문은 300자까지 작성할 수 있어요.\n- 경기톡에서도 좋아요와 댓글로 반응할 수 있어요.\n- 홈의 이번 주 경기 카드와 일정 화면에서 해당 경기의 경기톡으로 바로 이동할 수 있어요.\n- 글에는 작성 시점의 경기 점수와 상태가 함께 남아, 그 순간의 분위기를 더 잘 기록할 수 있어요.\n\n직관 후기는 깊게 남기고, 경기톡은 경기 중 떠오르는 한마디를 가볍게 남겨보세요.',
  false,
  '2026-05-14 09:00:00+09'
)
on conflict (id) do update set
  title = excluded.title,
  body = excluded.body,
  is_pinned = excluded.is_pinned,
  published_at = excluded.published_at,
  updated_at = now();
