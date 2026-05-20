import { unstable_noStore as noStore } from "next/cache";
import { HomeScreen } from "@/components/domain/HomeScreen";
import { listGamesFromDb, listNoticesFromDb, listStandingsFromDb } from "@/lib/supabase/queries";
import { countMatchPostsByGameIds } from "@/lib/supabase/query-parts/matchPosts";
import { getCurrentUserSeasonLevel } from "@/lib/season-level/queries";
import type { Game } from "@/lib/types/domain";

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

export default async function HomePage() {
  noStore();

  // 비로그인 사용자는 middleware(lib/supabase/middleware.ts)에서 /landing으로 리다이렉트.
  // 서버 컴포넌트에서 redirect() 호출이 Next.js App Router의 React #310 버그를
  // 트리거하므로(https://github.com/vercel/next.js/issues/78396) HTTP 레벨에서 처리.

  // 이번주 (월요일 시작 ~ 일요일 끝) 범위
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  // 홈 첫 화면은 이번주 경기만 SSR — 모달용 전체 시즌 경기 목록은 모달 열 때 lazy fetch.
  const [standings, weekGames, notices, seasonLevel] = await Promise.all([
    listStandingsFromDb(today.getFullYear()).catch(() => []),
    listGamesFromDb({ from: fmt(monday), to: fmt(sunday) })
      .then((items) => items.map(toDomainGame))
      .catch(() => []),
    listNoticesFromDb().catch(() => []),
    getCurrentUserSeasonLevel().catch(() => null)
  ]);
  const latestNoticeAt = notices[0]?.publishedAt ?? null;

  // 이번주 경기들의 경기톡 글 개수 (홈 카드 뱃지용)
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
