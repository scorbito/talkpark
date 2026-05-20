// 서버 전용 모듈 — admin client(service role)를 사용하므로 클라이언트에서 import 금지.
// Server action 또는 다른 server-only 모듈에서만 호출.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSeasonLevel } from "./levels";
import type { SeasonLevelState } from "./types";

/**
 * 시즌 XP 이벤트 type 카탈로그.
 * 지급(positive xp) / 회수(negative xp) 쌍으로 관리.
 *
 * 멱등성: unique(user_id, season, type, source_id) — 같은 (user, season, type, source)
 * 조합은 1개만 존재. 두 번째 grant 시 ON CONFLICT DO NOTHING으로 무시.
 *
 * 회수 이벤트는 별도 type(예: 'attendance_result_acknowledged_revoked')으로
 * 만들어 원본 row와 unique 충돌하지 않게 함.
 */
export type SeasonXpEventType =
  | "attendance_result_acknowledged"        // +30
  | "attendance_result_acknowledged_revoked"
  | "ticket_verified"                       // +100
  | "ticket_verified_revoked"
  | "review_created"                        // +70
  | "review_created_revoked"
  | "review_photo_bonus"                    // +20
  | "review_photo_bonus_revoked";

/** XP 표준값 — 한 곳에서 관리해 변경 시 일관성 보장. */
export const XP_VALUES = {
  attendance_result_acknowledged: 30,
  ticket_verified: 100,
  review_created: 70,
  review_photo_bonus: 20
} as const;

/**
 * 멱등 XP 지급.
 * 같은 (user, season, type, source) 조합이 이미 있으면 아무 일 안 함.
 * 새 row 생성 시 created_at은 DB default(now()) 사용.
 *
 * @returns granted: true면 새로 row 생성됨, false면 이미 존재 (스킵)
 */
export async function grantXpEvent(input: {
  userId: string;
  season: number;
  type: SeasonXpEventType;
  sourceId: string;
  xp: number;
  metadata?: Record<string, unknown>;
}): Promise<{ granted: boolean }> {
  if (input.xp <= 0) {
    throw new Error(`grantXpEvent: xp must be positive, got ${input.xp}`);
  }
  const admin = createSupabaseAdminClient();

  // ON CONFLICT DO NOTHING 패턴 — Supabase는 upsert(onConflict)로 동등 처리.
  // ignoreDuplicates: true 면 충돌 시 row 반환 없이 무시.
  const { data, error } = await admin
    .from("season_xp_events")
    .upsert(
      {
        user_id: input.userId,
        season: input.season,
        type: input.type,
        source_id: input.sourceId,
        xp: input.xp,
        metadata: input.metadata ?? null
      },
      { onConflict: "user_id,season,type,source_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    throw new Error(`XP 지급 실패: ${error.message}`);
  }

  // ignoreDuplicates: true 이고 충돌 시 data는 []. 새 INSERT면 1개 반환.
  return { granted: (data?.length ?? 0) > 0 };
}

/**
 * 멱등 XP 회수.
 * 원본 지급 이벤트(positive xp)가 존재할 때만 회수 이벤트(negative xp)를 생성.
 * 이미 회수된 경우(같은 _revoked type 행 존재) 아무 일 안 함.
 *
 * @param sourceType — 회수 대상 원본 이벤트의 type. _revoked 접미사는 자동 추가.
 * @returns revoked: true면 회수 row 생성됨
 */
export async function revokeXpEvent(input: {
  userId: string;
  season: number;
  sourceType: Exclude<SeasonXpEventType, `${string}_revoked`>;
  sourceId: string;
}): Promise<{ revoked: boolean }> {
  const admin = createSupabaseAdminClient();
  const revokedType = `${input.sourceType}_revoked` as SeasonXpEventType;

  // 1) 원본 지급 row 존재 확인 — 없으면 회수할 게 없음
  const { data: original } = await admin
    .from("season_xp_events")
    .select("xp")
    .eq("user_id", input.userId)
    .eq("season", input.season)
    .eq("type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();

  if (!original) {
    return { revoked: false };
  }

  // 2) 회수 row 생성 (xp는 원본의 음수). 멱등 — 이미 회수돼 있으면 무시.
  const { data, error } = await admin
    .from("season_xp_events")
    .upsert(
      {
        user_id: input.userId,
        season: input.season,
        type: revokedType,
        source_id: input.sourceId,
        xp: -original.xp,
        metadata: null
      },
      { onConflict: "user_id,season,type,source_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    throw new Error(`XP 회수 실패: ${error.message}`);
  }

  return { revoked: (data?.length ?? 0) > 0 };
}

/**
 * 사용자의 특정 시즌 누적 XP (지급 + 회수 합).
 * RLS는 본인 row만 SELECT 허용하지만, 서버 액션에서 admin client로 호출하므로
 * 다른 사용자(친구 등) 시즌 XP 조회도 가능.
 */
export async function getUserSeasonXp(userId: string, season: number): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("season_xp_events")
    .select("xp")
    .eq("user_id", userId)
    .eq("season", season);

  if (error) {
    throw new Error(`시즌 XP 조회 실패: ${error.message}`);
  }

  return (data ?? []).reduce((sum, row) => sum + (row.xp ?? 0), 0);
}

/**
 * 사용자의 현재 시즌 레벨 상태 — getUserSeasonXp + getSeasonLevel 조합.
 * 프로필 모달/마이 페이지/홈 카드 등에서 사용.
 */
export async function getUserSeasonLevel(
  userId: string,
  season: number
): Promise<SeasonLevelState> {
  const totalXp = await getUserSeasonXp(userId, season);
  return getSeasonLevel(totalXp, season);
}
