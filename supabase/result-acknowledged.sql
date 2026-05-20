-- 직관 결과 확인 추적 컬럼 추가
-- null = 사용자가 아직 결과 이펙트를 보지 않음 → 홈의 "현재/지난 직관"에 "경기 종료"/"결과 보기" 버튼 노출
-- timestamptz = 본 시각 → 홈의 "최근 직관"으로 이동
-- 추후 경험치/포인트 시스템에서도 "처음 결과를 직접 확인한 시점" 트리거로 재사용 가능.

alter table public.attendances
  add column if not exists result_acknowledged_at timestamptz;

-- 마이그레이션 시점에 이미 종료된 경기는 사용자가 이전 흐름에서 이미 결과를 봤다고 간주.
-- 이 backfill을 안 하면 기존 사용자가 다음 진입 시 모든 과거 직관이 갑자기 "결과 보기" 상태로 떠서 혼란스러워짐.
update public.attendances att
set result_acknowledged_at = now()
from public.games g
where att.game_id = g.id
  and g.status = 'finished'
  and att.result_acknowledged_at is null;
