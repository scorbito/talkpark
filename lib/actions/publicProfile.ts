"use server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserSeasonLevel } from "@/lib/season-level/queries";

export type PublicProfileRelationship = "self" | "none" | "friend" | "requested" | "incoming";

export type PublicProfileSeasonStats = {
  /** 현재 시즌(=올해) 직관 횟수 */
  attended: number;
  /** 현재 시즌 직관 승률 (".667" 형태, 미정이면 ".000") */
  winRate: string;
  /** 현재 시즌 후기 작성 수 */
  reviewCount: number;
};

export type PublicProfilePayload = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  mainTeamId: string;
  bio: string | null;
  /** 시즌 레벨 — Step 0에서는 placeholder. Step 10에서 실데이터 연결 */
  seasonLevel: {
    level: number;
    title: string;
    totalXp: number;
  } | null;
  seasonStats: PublicProfileSeasonStats;
  relationship: PublicProfileRelationship;
  /** relationship === "incoming"일 때 respondFriendRequestAction 호출에 사용 */
  incomingRequestId: string | null;
};

function pairKey(a: string, b: string) {
  return a < b ? { user_a_id: a, user_b_id: b } : { user_a_id: b, user_b_id: a };
}

function computeWinRate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return ".000";
  return `.${Math.round((wins / total) * 1000).toString().padStart(3, "0")}`;
}

/**
 * 작성자 영역(닉네임/사진) 탭 시 열리는 프로필 모달의 데이터 조회.
 * 현재 시즌 = 올해(`game_date` 연도) 기준으로 활동 지표를 집계.
 * 시즌 레벨은 Step 0에서는 placeholder. 본 기능(Step 10)이 붙으면 실데이터로 교체.
 */
export async function getPublicProfileAction(targetUserId: string): Promise<PublicProfilePayload | null> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }
  const me = authData.user.id;

  const admin = createSupabaseAdminClient();

  // 1) 프로필 기본 정보
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,nickname,main_team_id,avatar_image_url,bio")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`프로필을 불러오지 못했습니다: ${profileError.message}`);
  }
  if (!profile) return null;

  // 2) 현재 시즌 활동 지표 — games.game_date 연도 = 현재 연도(KST 기준)
  const seasonYear = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  ).getFullYear();
  const seasonStart = `${seasonYear}-01-01`;
  const seasonEnd = `${seasonYear}-12-31`;

  // 직관 + 결과 합산 (games inner join으로 시즌 필터)
  const { data: attendanceRows } = await admin
    .from("attendances")
    .select("id, support_team_id, games!inner(game_date, home_team_id, away_team_id, home_score, away_score, status)")
    .eq("user_id", targetUserId)
    .gte("games.game_date", seasonStart)
    .lte("games.game_date", seasonEnd);

  let attended = 0;
  let wins = 0;
  let losses = 0;
  for (const row of attendanceRows ?? []) {
    attended += 1;
    const g = row.games as unknown as {
      game_date: string;
      home_team_id: string;
      away_team_id: string;
      home_score: number | null;
      away_score: number | null;
      status: string;
    };
    if (g.status !== "finished" || g.home_score === null || g.away_score === null) continue;
    if (g.home_score === g.away_score) continue;
    const supportedHome = row.support_team_id === g.home_team_id;
    const supportWon = supportedHome ? g.home_score > g.away_score : g.away_score > g.home_score;
    if (supportWon) wins += 1;
    else losses += 1;
  }

  const { count: reviewCount } = await admin
    .from("reviews")
    .select("id, attendances!inner(games!inner(game_date))", { count: "exact", head: true })
    .eq("user_id", targetUserId)
    .gte("attendances.games.game_date", seasonStart)
    .lte("attendances.games.game_date", seasonEnd);

  const seasonStats: PublicProfileSeasonStats = {
    attended,
    winRate: computeWinRate(wins, losses),
    reviewCount: reviewCount ?? 0
  };

  // 3) relationship 계산
  let relationship: PublicProfileRelationship = "none";
  let incomingRequestId: string | null = null;

  if (targetUserId === me) {
    relationship = "self";
  } else {
    const pair = pairKey(me, targetUserId);
    const [friendRow, outgoingReq, incomingReq] = await Promise.all([
      admin.from("friends").select("user_a_id").eq("user_a_id", pair.user_a_id).eq("user_b_id", pair.user_b_id).maybeSingle(),
      admin.from("friend_requests").select("id").eq("from_user_id", me).eq("to_user_id", targetUserId).eq("status", "pending").maybeSingle(),
      admin.from("friend_requests").select("id").eq("from_user_id", targetUserId).eq("to_user_id", me).eq("status", "pending").maybeSingle()
    ]);

    if (friendRow.data) {
      relationship = "friend";
    } else if (outgoingReq.data) {
      relationship = "requested";
    } else if (incomingReq.data) {
      relationship = "incoming";
      incomingRequestId = incomingReq.data.id;
    }
  }

  return {
    userId: profile.id,
    nickname: profile.nickname,
    avatarUrl: profile.avatar_image_url ?? null,
    mainTeamId: profile.main_team_id,
    bio: profile.bio ?? null,
    seasonLevel: await getUserSeasonLevel(profile.id, seasonYear).then((s) => ({
      level: s.level,
      title: s.title,
      totalXp: s.totalXp
    })).catch(() => null),
    seasonStats,
    relationship,
    incomingRequestId
  };
}
