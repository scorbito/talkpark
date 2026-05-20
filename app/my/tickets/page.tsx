import { unstable_noStore as noStore } from "next/cache";
import { TicketCollectionScreen } from "@/components/domain/TicketCollectionScreen";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type TicketCollectionItem = {
  id: string;
  signedUrl: string;
  gameDate: string;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  supportTeamId: string;
  result?: "win" | "lose" | "draw";
  createdAt: string;
};

function deriveResult(homeScore: number | null, awayScore: number | null, supportTeamId: string, homeTeamId: string, awayTeamId: string): TicketCollectionItem["result"] {
  if (homeScore === null || awayScore === null) return undefined;
  if (homeScore === awayScore) return "draw";
  if (supportTeamId === homeTeamId) return homeScore > awayScore ? "win" : "lose";
  if (supportTeamId === awayTeamId) return awayScore > homeScore ? "win" : "lose";
  return undefined;
}

export default async function TicketCollectionPage() {
  noStore();

  const ssr = createSupabaseServerClient();
  const { data: authData } = await ssr.auth.getUser();
  if (!authData?.user) {
    return <TicketCollectionScreen items={[]} />;
  }

  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("attendances")
    .select("id, ticket_image_url, support_team_id, created_at, game_id")
    .eq("user_id", authData.user.id)
    .eq("verified", true)
    .not("ticket_image_url", "is", null)
    .order("created_at", { ascending: false });

  if (error || !rows || rows.length === 0) {
    return <TicketCollectionScreen items={[]} />;
  }

  const gameIds = Array.from(new Set(rows.map((r) => r.game_id)));
  const { data: games } = await admin
    .from("games")
    .select("id, game_date, stadium, home_team_id, away_team_id, home_score, away_score")
    .in("id", gameIds);
  const gamesById = new Map((games ?? []).map((g) => [g.id, g]));

  // ticket-images 버킷은 private이라 signed URL 발급 (1시간 유효)
  const items: TicketCollectionItem[] = [];
  for (const row of rows) {
    const game = gamesById.get(row.game_id);
    if (!game) continue;
    if (!row.ticket_image_url) continue;
    const { data: signed } = await admin.storage.from("ticket-images").createSignedUrl(row.ticket_image_url, 3600);
    if (!signed?.signedUrl) continue;
    items.push({
      id: row.id,
      signedUrl: signed.signedUrl,
      gameDate: game.game_date,
      stadium: game.stadium,
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      homeScore: game.home_score,
      awayScore: game.away_score,
      supportTeamId: row.support_team_id,
      result: deriveResult(game.home_score, game.away_score, row.support_team_id, game.home_team_id, game.away_team_id),
      createdAt: row.created_at
    });
  }

  return <TicketCollectionScreen items={items} />;
}
