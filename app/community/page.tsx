import { unstable_noStore as noStore } from "next/cache";
import { HomeScreen } from "@/components/domain/HomeScreen";
import { listGamesFromDb, listNoticesFromDb, listStandingsFromDb } from "@/lib/supabase/queries";
import { countMatchPostsByGameIds } from "@/lib/supabase/query-parts/matchPosts";
import { getCurrentUserSeasonLevel } from "@/lib/season-level/queries";
import type { Game } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function toDomainGame(game: Awaited<ReturnType<typeof listGamesFromDb>>[number]): Game {
  return {
    id: game.id,
    date: game.date.replaceAll("-", "."),
    time: game.time ?? "",
    stadium: game.stadium,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    status: game.status === "finished" || game.status === "canceled" ? game.status : "scheduled"
  };
}

export default async function CommunityPage() {
  noStore();

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const [standings, weekGames, notices, seasonLevel] = await Promise.all([
    listStandingsFromDb(today.getFullYear()).catch(() => []),
    listGamesFromDb({ from: fmt(monday), to: fmt(sunday) })
      .then((items) => items.map(toDomainGame))
      .catch(() => []),
    listNoticesFromDb().catch(() => []),
    getCurrentUserSeasonLevel().catch(() => null)
  ]);
  const latestNoticeAt = notices[0]?.publishedAt ?? null;

  const matchPostCounts = await countMatchPostsByGameIds(weekGames.map((g) => g.id)).catch(() => ({}));

  return (
    <HomeScreen
      standings={standings}
      weekGames={weekGames}
      weekStart={fmt(monday)}
      latestNoticeAt={latestNoticeAt}
      matchPostCounts={matchPostCounts}
      seasonLevel={seasonLevel}
    />
  );
}
