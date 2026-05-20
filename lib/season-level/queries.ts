// 서버 전용 — 시즌 레벨 SSR 페치용.
// 현재 로그인 사용자의 시즌 레벨 + 타인 사용자 시즌 레벨 둘 다 지원.

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getSeasonLevel, getCurrentSeasonYear } from "./levels";
import type { SeasonLevelState } from "./types";

/**
 * 현재 로그인 사용자의 시즌 레벨 (SSR).
 * - 비로그인 시 null
 * - season 미지정 시 현재 연도(KST) 기준
 * - season_xp_events 합산으로 누적 XP 계산
 */
export async function getCurrentUserSeasonLevel(
  season: number = getCurrentSeasonYear()
): Promise<SeasonLevelState | null> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("season_xp_events")
    .select("xp")
    .eq("user_id", authData.user.id)
    .eq("season", season);

  if (error) {
    console.warn("[getCurrentUserSeasonLevel] failed:", error.message);
    return getSeasonLevel(0, season);
  }

  const totalXp = (data ?? []).reduce((sum, row) => sum + (row.xp ?? 0), 0);
  return getSeasonLevel(totalXp, season);
}

/**
 * 임의 사용자의 시즌 레벨 — 프로필 모달 등에서 친구/타인 정보 조회.
 * admin client 사용으로 RLS 우회 (서버 액션 안에서만 호출 가능한 보안 컨텍스트).
 */
export async function getUserSeasonLevel(
  userId: string,
  season: number = getCurrentSeasonYear()
): Promise<SeasonLevelState> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("season_xp_events")
    .select("xp")
    .eq("user_id", userId)
    .eq("season", season);

  if (error) {
    console.warn("[getUserSeasonLevel] failed:", error.message);
    return getSeasonLevel(0, season);
  }

  const totalXp = (data ?? []).reduce((sum, row) => sum + (row.xp ?? 0), 0);
  return getSeasonLevel(totalXp, season);
}
