import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { syncGamesForDate } from "./syncGames";

/**
 * 라이브 스코어 캐시 TTL (밀리초).
 * 야구는 1분 안에 점수가 거의 안 바뀌므로 2분이면 충분한 정확도.
 * 너무 짧으면 KBO API 호출이 잦아지고, 너무 길면 점수가 부정확해진다.
 *
 * 기획서: docs/planning/match-talk.md §9.3
 */
export const LIVE_SCORE_TTL_MS = 2 * 60 * 1000;

export type LiveScoreSnapshot = {
  gameId: string;
  gameDate: string;
  homeScore: number | null;
  awayScore: number | null;
  innings: number | null;
  status: "scheduled" | "in_progress" | "finished" | "canceled";
  /** 'cache' = TTL 내 캐시 사용 / 'kbo' = 실시간 갱신 성공 / 'stale' = 갱신 실패해 기존 캐시 사용 */
  source: "cache" | "kbo" | "stale";
  lastSyncedAt: string | null;
};

type GameRow = {
  id: string;
  game_date: string;
  home_score: number | null;
  away_score: number | null;
  innings: number | null;
  status: LiveScoreSnapshot["status"];
  last_live_synced_at: string | null;
};

function isFresh(lastSyncedAt: string | null, now: number = Date.now()) {
  if (!lastSyncedAt) return false;
  const last = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(last)) return false;
  return now - last < LIVE_SCORE_TTL_MS;
}

function toSnapshot(row: GameRow, source: LiveScoreSnapshot["source"]): LiveScoreSnapshot {
  return {
    gameId: row.id,
    gameDate: row.game_date,
    homeScore: row.home_score,
    awayScore: row.away_score,
    innings: row.innings,
    status: row.status,
    source,
    lastSyncedAt: row.last_live_synced_at
  };
}

/**
 * 글쓰기 진입 시점에 호출되는 라이브 스코어 lazy refresh.
 *
 * - TTL 내면 캐시 그대로 반환.
 * - 만료되면 KBO API를 통해 그 날짜의 모든 경기를 함께 갱신하고 last_live_synced_at 박제.
 * - KBO API 실패 시 throw하지 않고 기존 캐시값을 반환한다 (stale OK 정책).
 *   캐시도 없으면 score가 null인 채로 반환되며 호출 측은 `score_*_at_post = NULL`로 박제.
 */
export async function refreshGameLiveScore(gameId: string): Promise<LiveScoreSnapshot | null> {
  const admin = createSupabaseAdminClient();

  const { data: game, error } = await admin
    .from("games")
    .select("id, game_date, home_score, away_score, innings, status, last_live_synced_at")
    .eq("id", gameId)
    .maybeSingle<GameRow>();

  if (error) {
    console.error("[refreshGameLiveScore] game lookup failed:", error.message);
    return null;
  }
  if (!game) return null;

  if (isFresh(game.last_live_synced_at)) {
    return toSnapshot(game, "cache");
  }

  try {
    await syncGamesForDate(game.game_date);

    // 같은 날짜의 모든 경기에 동일한 timestamp를 박아 캐시 일관성 유지.
    // KBO API는 날짜 단위라 한 번 호출에 그 날 모든 경기가 함께 갱신되므로,
    // 같은 날짜의 다른 경기로 진입한 사용자도 캐시 hit을 받게 된다.
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await admin
      .from("games")
      .update({ last_live_synced_at: nowIso })
      .eq("game_date", game.game_date);
    if (updateErr) {
      console.error("[refreshGameLiveScore] last_live_synced_at update failed:", updateErr.message);
    }

    const { data: refreshed, error: refetchErr } = await admin
      .from("games")
      .select("id, game_date, home_score, away_score, innings, status, last_live_synced_at")
      .eq("id", gameId)
      .maybeSingle<GameRow>();

    if (refetchErr || !refreshed) {
      console.error("[refreshGameLiveScore] refetch failed:", refetchErr?.message);
      return toSnapshot(game, "stale");
    }

    return toSnapshot(refreshed, "kbo");
  } catch (err) {
    console.warn("[refreshGameLiveScore] KBO sync failed, using stale cache:", (err as Error).message);
    return toSnapshot(game, "stale");
  }
}

/**
 * 스냅샷을 match_posts의 박제 컬럼 형태로 변환.
 * scheduled 상태일 때는 스코어를 NULL로 강제 (경기 시작 전에는 점수가 의미 없음).
 */
export function toMatchPostSnapshotColumns(snapshot: LiveScoreSnapshot | null) {
  if (!snapshot) {
    // 캐시도 없고 API도 실패한 경우 — 박제 없이 글만 작성 (§9.7 정책)
    return {
      score_home_at_post: null,
      score_away_at_post: null,
      inning_at_post: null,
      // status_at_post는 NOT NULL이라 안전한 기본값으로 'scheduled' 사용
      status_at_post: "scheduled" as const
    };
  }

  // 'canceled'는 status_at_post enum에 없음 — 작성 단계에서는 취소된 경기를 선택할 수 없어야 함.
  // 만약 어떤 이유로 이 경로에 도달하면 finished로 매핑 (점수는 NULL일 가능성 높음).
  const status_at_post =
    snapshot.status === "canceled" ? "finished" : snapshot.status;

  // scheduled 상태에서는 점수가 의미 없으므로 NULL로 박제
  if (snapshot.status === "scheduled") {
    return {
      score_home_at_post: null,
      score_away_at_post: null,
      inning_at_post: null,
      status_at_post
    };
  }

  // finished는 9회 종료이므로 회차 박제는 in_progress에만 의미가 있음.
  return {
    score_home_at_post: snapshot.homeScore,
    score_away_at_post: snapshot.awayScore,
    inning_at_post: snapshot.status === "in_progress" ? snapshot.innings : null,
    status_at_post
  };
}
