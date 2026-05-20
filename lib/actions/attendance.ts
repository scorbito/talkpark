"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { syncGamesForDate } from "@/lib/server/kbo/syncGames";
import { grantXpEvent, revokeXpEvent, XP_VALUES } from "@/lib/season-level/events";

export type CreateAttendanceActionInput = {
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  supportTeamId: string;
  memo?: string;
  ticketImageUrl?: string;
};

function toIsoDate(date: string) {
  return date.includes(".") ? date.replaceAll(".", "-") : date;
}

export async function createAttendanceAction(input: CreateAttendanceActionInput): Promise<{ attendanceId: string }> {
  // Auth check via SSR client (auth.getUser is reliable through cookies).
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  // Use admin client for DB ops to avoid the @supabase/ssr cookie-to-PostgREST JWT
  // propagation quirk that intermittently breaks RLS-protected writes.
  const admin = createSupabaseAdminClient();

  const gameDate = toIsoDate(input.date);
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("id")
    .eq("game_date", gameDate)
    .or(
      `and(home_team_id.eq.${input.homeTeamId},away_team_id.eq.${input.awayTeamId}),and(home_team_id.eq.${input.awayTeamId},away_team_id.eq.${input.homeTeamId})`
    )
    .limit(1)
    .maybeSingle();

  if (gameError) {
    throw new Error(`경기 조회에 실패했습니다: ${gameError.message}`);
  }

  if (!game) {
    throw new Error("선택한 경기 정보를 DB에서 찾지 못했습니다.");
  }

  // 1일 1직관 사전 체크 — DB trigger가 막아주지만, 사용자에겐 친절한 안내를 먼저.
  // 같은 user_id + 같은 game_date 직관이 이미 있는지 검사.
  const { data: sameDay } = await admin
    .from("attendances")
    .select("id, games!inner(game_date)")
    .eq("user_id", authData.user.id)
    .eq("games.game_date", gameDate)
    .limit(1)
    .maybeSingle();

  if (sameDay) {
    throw new Error("이미 이 날짜에 등록한 직관이 있어요. 기존 기록을 수정해 주세요.");
  }

  const verified = Boolean(input.ticketImageUrl);
  const { data: created, error } = await admin
    .from("attendances")
    .insert({
      user_id: authData.user.id,
      game_id: game.id,
      support_team_id: input.supportTeamId,
      ticket_image_url: input.ticketImageUrl || null,
      verified,
      verified_at: verified ? new Date().toISOString() : null,
      verified_method: verified ? "mock" : null,
      memo: input.memo || null
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // trigger 메시지 키워드로 1일 1직관과 기존 unique(user_id, game_id)를 구분
      if (error.message?.includes("하루에 하나")) {
        throw new Error("하루에 하나의 직관만 기록할 수 있어요. 기존 기록을 수정해 주세요.");
      }
      throw new Error("이미 등록한 직관 경기입니다.");
    }
    throw new Error(`직관 저장에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/my/attendances");

  return { attendanceId: created.id };
}

/** 인증 사진 공개 URL 또는 storage path에서 storage 경로만 추출 */
function extractTicketImagePath(value: string): string | null {
  const marker = "/storage/v1/object/public/ticket-images/";
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length);
  // attendance.ticket_image_url에 path만 저장된 케이스 (uploadUserFile이 ticket-images면 path 그대로 반환)
  if (!value.startsWith("http")) return value;
  return null;
}

export async function deleteAttendanceAction(attendanceId: string) {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const admin = createSupabaseAdminClient();

  const { data: deleteGuard, error: guardErr } = await admin
    .from("attendances")
    .select("games!inner(status, home_score, away_score)")
    .eq("id", attendanceId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (guardErr) {
    throw new Error(`직관 조회에 실패했습니다: ${guardErr.message}`);
  }
  if (!deleteGuard) {
    throw new Error("직관 기록을 찾을 수 없습니다.");
  }

  const guardGame = deleteGuard.games as unknown as {
    status: string | null;
    home_score: number | null;
    away_score: number | null;
  } | null;
  if (guardGame?.status === "finished" || guardGame?.home_score != null || guardGame?.away_score != null) {
    throw new Error("경기가 종료된 직관 기록은 삭제할 수 없습니다.");
  }

  // 1) 연결된 후기를 먼저 정리 (사진 storage 포함). reviews FK는 cascade라 DB는 자동이지만 storage 정리는 수동.
  const { data: review } = await admin
    .from("reviews")
    .select("photos")
    .eq("attendance_id", attendanceId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (review?.photos && review.photos.length > 0) {
    const reviewMarker = "/storage/v1/object/public/review-photos/";
    const reviewPaths = (review.photos as string[])
      .map((url) => {
        const idx = url.indexOf(reviewMarker);
        return idx >= 0 ? url.slice(idx + reviewMarker.length) : null;
      })
      .filter((p): p is string => Boolean(p));
    if (reviewPaths.length > 0) {
      const { error: revStErr } = await admin.storage.from("review-photos").remove(reviewPaths);
      if (revStErr) console.warn(`[deleteAttendanceAction] review storage cleanup failed:`, revStErr.message);
    }
  }

  // 2) 티켓 이미지 path + 게임 날짜 미리 저장 (XP 회수 시즌 계산)
  const { data: attendance, error: fetchErr } = await admin
    .from("attendances")
    .select("ticket_image_url, games!inner(game_date)")
    .eq("id", attendanceId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (fetchErr) {
    throw new Error(`직관 조회에 실패했습니다: ${fetchErr.message}`);
  }
  if (!attendance) {
    throw new Error("직관 기록을 찾을 수 없습니다.");
  }

  // 3) DB 행 삭제 (reviews는 attendances cascade로 같이 사라짐)
  const { error: deleteErr } = await admin
    .from("attendances")
    .delete()
    .eq("id", attendanceId)
    .eq("user_id", authData.user.id);
  if (deleteErr) {
    throw new Error(`직관 삭제에 실패했습니다: ${deleteErr.message}`);
  }

  // 4) 티켓 이미지 storage 정리
  if (attendance.ticket_image_url) {
    const ticketPath = extractTicketImagePath(attendance.ticket_image_url);
    if (ticketPath) {
      const { error: tStErr } = await admin.storage.from("ticket-images").remove([ticketPath]);
      if (tStErr) console.warn(`[deleteAttendanceAction] ticket storage cleanup failed:`, tStErr.message);
    }
  }

  // 5) 시즌 XP 회수 — 이 attendance에서 발생한 모든 XP (직관/티켓/후기/사진 보너스).
  // 멱등이라 원본 지급이 없는 종류는 자동 스킵.
  const games = attendance.games as unknown as { game_date: string } | null;
  if (games?.game_date) {
    const season = new Date(games.game_date).getFullYear();
    const xpTypes = ["attendance_result_acknowledged", "ticket_verified", "review_created", "review_photo_bonus"] as const;
    for (const sourceType of xpTypes) {
      try {
        await revokeXpEvent({
          userId: authData.user.id,
          season,
          sourceType,
          sourceId: attendanceId
        });
      } catch (xpErr) {
        console.warn(`[deleteAttendanceAction] XP revoke ${sourceType} failed:`, xpErr);
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/my/attendances");
  revalidatePath("/my/reviews");
  revalidatePath("/community");
}

export async function findCurrentUserAttendanceId(input: {
  date: string;
  homeTeamId: string;
  awayTeamId: string;
}) {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();

  if (authError || !authData.user) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const gameDate = toIsoDate(input.date);
  const { data: game, error: gameError } = await admin
    .from("games")
    .select("id")
    .eq("game_date", gameDate)
    .or(
      `and(home_team_id.eq.${input.homeTeamId},away_team_id.eq.${input.awayTeamId}),and(home_team_id.eq.${input.awayTeamId},away_team_id.eq.${input.homeTeamId})`
    )
    .limit(1)
    .maybeSingle();

  if (gameError || !game) {
    return null;
  }

  const { data: attendance, error } = await admin
    .from("attendances")
    .select("id")
    .eq("user_id", authData.user.id)
    .eq("game_id", game.id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return attendance?.id ?? null;
}

// ============================================================
// finalizeAttendance — 사용자가 "경기 종료" 누르면 결과 확정
// 1) 이미 game.status='finished'면 DB만으로 즉시 결과 반환 (API 호출 X)
// 2) 아직 진행중이면 KBO 단일 일자 동기화 후 다시 검사
// 3) 그래도 안 끝났으면 거부
// ============================================================

export type FinalizeAttendanceResult =
  | {
      ok: true;
      result: "win" | "lose" | "draw";
      myScore: number;
      opponentScore: number;
      myTeamId: string;
      opponentTeamId: string;
      gameDate: string;
      stadium: string;
    }
  | { ok: false; reason: string; status?: "not-started" | "in-progress" | "no-data" };

export async function finalizeAttendanceAction(attendanceId: string): Promise<FinalizeAttendanceResult> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, reason: "로그인이 필요합니다." };
  }
  const admin = createSupabaseAdminClient();
  const userId = authData.user.id;

  // attendance + game 조회
  const { data: attendance, error: attErr } = await admin
    .from("attendances")
    .select("id, user_id, game_id, support_team_id")
    .eq("id", attendanceId)
    .maybeSingle();
  if (attErr) {
    return { ok: false, reason: `직관 조회 실패: ${attErr.message}` };
  }
  if (!attendance) {
    return { ok: false, reason: "해당 직관 기록을 찾을 수 없어요." };
  }
  if (attendance.user_id !== userId) {
    return { ok: false, reason: "본인 직관만 종료 처리할 수 있어요." };
  }

  async function loadGame() {
    const { data, error } = await admin
      .from("games")
      .select("id, game_date, game_time, stadium, home_team_id, away_team_id, home_score, away_score, status, last_synced_at")
      .eq("id", attendance!.game_id)
      .maybeSingle();
    if (error) throw new Error(`경기 조회 실패: ${error.message}`);
    return data;
  }

  let game = await loadGame();
  if (!game) {
    return { ok: false, reason: "경기 정보를 찾을 수 없어요." };
  }

  // 경기 시작 시간 검증 (KST)
  const nowKst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const gameStartIso = `${game.game_date}T${game.game_time ?? "18:30:00"}+09:00`;
  const gameStart = new Date(gameStartIso);
  if (nowKst < gameStart) {
    return { ok: false, reason: "경기 시작 시간이 아직 안 됐어요.", status: "not-started" };
  }

  // 1차: DB만으로 판정 가능?
  const isFinishedInDb =
    game.status === "finished" && game.home_score != null && game.away_score != null;

  // 2차: 아니면 KBO 즉시 동기화 후 재조회 — 단 60초 throttle
  if (!isFinishedInDb) {
    const THROTTLE_MS = 60_000;
    const lastSyncedAt = game.last_synced_at ? new Date(game.last_synced_at).getTime() : 0;
    const sinceSync = Date.now() - lastSyncedAt;

    if (sinceSync < THROTTLE_MS) {
      // 60초 이내 누군가 이미 동기화했음 → API 호출 생략, 현재 DB 상태 그대로 응답
      return {
        ok: false,
        reason: "아직 경기가 끝나지 않았어요. 잠시 후 다시 시도해주세요.",
        status: "in-progress"
      };
    }

    // 동기화 시점 먼저 기록 (다른 동시 요청을 차단) — race condition은 1~2초 짧은 윈도우만 존재
    await admin
      .from("games")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", game.id);

    try {
      await syncGamesForDate(game.game_date);
    } catch (err) {
      console.warn("[finalizeAttendance] KBO sync failed:", (err as Error).message);
    }

    game = await loadGame();
    if (!game) {
      return { ok: false, reason: "경기 정보를 찾을 수 없어요." };
    }
    if (game.status !== "finished" || game.home_score == null || game.away_score == null) {
      return {
        ok: false,
        reason: "아직 경기가 끝나지 않았어요. 잠시 후 다시 시도해주세요.",
        status: "in-progress"
      };
    }
  }

  // 결과 계산
  const supportIsHome = attendance.support_team_id === game.home_team_id;
  const myScore = supportIsHome ? game.home_score! : game.away_score!;
  const opponentScore = supportIsHome ? game.away_score! : game.home_score!;
  const myTeamId = attendance.support_team_id;
  const opponentTeamId = supportIsHome ? game.away_team_id : game.home_team_id;

  let result: "win" | "lose" | "draw";
  if (myScore > opponentScore) result = "win";
  else if (myScore < opponentScore) result = "lose";
  else result = "draw";

  return {
    ok: true,
    result,
    myScore,
    opponentScore,
    myTeamId,
    opponentTeamId,
    gameDate: game.game_date,
    stadium: game.stadium
  };
}

// ============================================================
// acknowledgeAttendanceResult — 사용자가 결과 이펙트를 처음 확인한 시점 기록
// 멱등 — 이미 ack된 직관은 그대로 두고 ok만 반환.
// 추후 경험치/포인트 시스템 도입 시 이 액션이 첫 적립의 트리거가 됨.
// ============================================================

export async function acknowledgeAttendanceResultAction(attendanceId: string): Promise<{ ok: boolean; reason?: string }> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, reason: "로그인이 필요합니다." };
  }
  const admin = createSupabaseAdminClient();
  const userId = authData.user.id;

  // 이미 ack된 행은 건드리지 않음 (멱등 + 첫 ack 시점 보존).
  // .update().select()에 foreign table join(games!inner)을 같이 쓰면 PostgREST가
  // 빈 결과를 반환하는 케이스가 있어 본 테이블만 select하고 games는 별도 쿼리로.
  const { data, error } = await admin
    .from("attendances")
    .update({ result_acknowledged_at: new Date().toISOString() })
    .eq("id", attendanceId)
    .eq("user_id", userId)
    .is("result_acknowledged_at", null)
    .select("id, game_id")
    .maybeSingle();

  if (error) {
    return { ok: false, reason: `결과 확인 처리 실패: ${error.message}` };
  }

  // 첫 ack 시점에 시즌 XP +30 지급 (이미 ack됐던 경우 data는 null이라 자동 스킵).
  if (data?.game_id) {
    // game_date는 별도 쿼리 (UPDATE + join select 한계 우회)
    const { data: game } = await admin
      .from("games")
      .select("game_date")
      .eq("id", data.game_id)
      .maybeSingle();

    if (game?.game_date) {
      const season = new Date(game.game_date).getFullYear();
      try {
        await grantXpEvent({
          userId,
          season,
          type: "attendance_result_acknowledged",
          sourceId: attendanceId,
          xp: XP_VALUES.attendance_result_acknowledged
        });
      } catch (xpErr) {
        // XP 지급 실패는 ack 자체를 막지 않음. 로그만 남기고 진행.
        console.warn("[acknowledgeAttendanceResult] XP grant failed:", xpErr);
      }
    }
  }

  // data가 null이면 이미 ack됐거나 본인 직관이 아님 — 둘 다 사용자 입장에선 OK.
  return { ok: true };
}
