import type { AttendanceRecord } from "@/lib/state/AppState";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

function getAttendanceResult(game: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  status: string;
}, supportTeamId: string): AttendanceRecord["result"] {
  if (game.status !== "finished" || game.homeScore === undefined || game.awayScore === undefined) {
    return undefined;
  }

  if (game.homeScore === game.awayScore) {
    return "draw";
  }

  if (supportTeamId === game.homeTeamId) {
    return game.homeScore > game.awayScore ? "win" : "lose";
  }

  if (supportTeamId === game.awayTeamId) {
    return game.awayScore > game.homeScore ? "win" : "lose";
  }

  return undefined;
}

export async function listCurrentAttendancesFromDb(): Promise<AttendanceRecord[]> {
  // 인증은 SSR 클라이언트로, DB 조회는 admin 클라이언트로 분리.
  // (@supabase/ssr가 PostgREST에 JWT를 일관되게 못 넘겨 RLS-protected SELECT가 빈 배열로 돌아오는 이슈 회피)
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();

  if (authError || !authData.user) {
    return [];
  }

  const admin = createSupabaseAdminClient();
  const { data: attendances, error: attendanceError } = await admin
    .from("attendances")
    .select("id,game_id,support_team_id,verified,memo,created_at,result_acknowledged_at")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });

  if (attendanceError) {
    throw new Error(`Failed to load attendances: ${attendanceError.message}`);
  }

  const gameIds = attendances.map((attendance) => attendance.game_id);
  if (gameIds.length === 0) {
    return [];
  }

  const { data: games, error: gameError } = await admin
    .from("games")
    .select("id,game_date,game_time,stadium,home_team_id,away_team_id,home_score,away_score,status")
    .in("id", gameIds);

  if (gameError) {
    throw new Error(`Failed to load attendance games: ${gameError.message}`);
  }

  const gamesById = new Map(games.map((game) => [game.id, game]));

  return attendances.flatMap((attendance) => {
    const game = gamesById.get(attendance.game_id);
    if (!game) {
      return [];
    }

    const homeScore = game.home_score;
    const awayScore = game.away_score;
    const status = game.status;
    const score = status === "finished" && homeScore !== null && awayScore !== null
      ? `${homeScore} : ${awayScore}`
      : "경기전";
    const mappedGame = {
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      homeScore: homeScore ?? undefined,
      awayScore: awayScore ?? undefined,
      status
    };

    return [{
      id: attendance.id,
      date: game.game_date.replaceAll("-", "."),
      time: game.game_time ?? undefined,
      stadium: game.stadium,
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      supportTeamId: attendance.support_team_id,
      score,
      result: getAttendanceResult(mappedGame, attendance.support_team_id),
      verified: attendance.verified,
      memo: attendance.memo ?? undefined,
      resultAcknowledgedAt: attendance.result_acknowledged_at ?? null
    }];
  });
}
