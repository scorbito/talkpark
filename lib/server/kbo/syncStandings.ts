import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { fetchStandings } from "./fetchStandings";

export type StandingsSyncResult = {
  source: "kbo" | "naver" | "none";
  upserted: number;
};

/**
 * 팀 순위 동기화. team_standings.unique(team_id, season) 기준으로 upsert.
 */
export async function syncStandings(season: number): Promise<StandingsSyncResult> {
  const { standings, source } = await fetchStandings(season);

  if (standings.length === 0) {
    return { source, upserted: 0 };
  }

  const supabase = createSupabaseAdminClient();
  const teamIds = standings.map((standing) => standing.teamId);
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("game_date,game_time,home_team_id,away_team_id,home_score,away_score,status")
    .eq("status", "finished")
    .not("home_score", "is", null)
    .not("away_score", "is", null)
    .or(teamIds.map((teamId) => `home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).join(","))
    .order("game_date", { ascending: false })
    .order("game_time", { ascending: false });

  if (gamesError) {
    throw new Error(`standings form games load failed: ${gamesError.message}`);
  }

  const formsByTeam = new Map<string, Array<"win" | "lose" | "draw">>();
  for (const teamId of teamIds) {
    formsByTeam.set(teamId, []);
  }

  for (const game of games ?? []) {
    const homeScore = game.home_score;
    const awayScore = game.away_score;
    if (homeScore === null || awayScore === null) continue;

    const homeForm = homeScore === awayScore ? "draw" : homeScore > awayScore ? "win" : "lose";
    const awayForm = homeScore === awayScore ? "draw" : awayScore > homeScore ? "win" : "lose";
    const homeItems = formsByTeam.get(game.home_team_id);
    const awayItems = formsByTeam.get(game.away_team_id);

    if (homeItems && homeItems.length < 5) {
      homeItems.unshift(homeForm);
    }
    if (awayItems && awayItems.length < 5) {
      awayItems.unshift(awayForm);
    }

    const hasAllForms = teamIds.every((teamId) => (formsByTeam.get(teamId)?.length ?? 0) >= 5);
    if (hasAllForms) {
      break;
    }
  }

  const rows = standings.map((s) => ({
    team_id: s.teamId,
    season,
    rank: s.rank,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    games_behind: s.gamesBehind,
    form: formsByTeam.get(s.teamId) ?? [],
    synced_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from("team_standings")
    .upsert(rows, { onConflict: "team_id,season" });

  if (error) {
    throw new Error(`standings upsert failed: ${error.message}`);
  }

  return { source, upserted: rows.length };
}
