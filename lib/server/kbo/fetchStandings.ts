import * as cheerio from "cheerio";
import { parseTeamCode } from "./teamCode";

export type RawStanding = {
  teamId: string;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  gamesBehind: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchKboStandings(): Promise<RawStanding[]> {
  const url = "https://www.koreabaseball.com/Record/TeamRank/TeamRank.aspx";
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`KBO standings ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const standings: RawStanding[] = [];

  $(".tData tbody tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 8) return;

    const teamId = parseTeamCode(tds.eq(1).text().trim());
    if (!teamId) return;

    const gamesBehindText = tds.eq(7).text().trim();
    standings.push({
      teamId,
      rank: parseInt(tds.eq(0).text().trim(), 10),
      wins: parseInt(tds.eq(3).text().trim(), 10),
      losses: parseInt(tds.eq(4).text().trim(), 10),
      draws: parseInt(tds.eq(5).text().trim(), 10),
      gamesBehind: gamesBehindText === "-" || gamesBehindText === "0" ? "-" : gamesBehindText
    });
  });

  return standings;
}

export async function fetchNaverStandings(season: number): Promise<RawStanding[]> {
  const url = `https://api-gw.sports.naver.com/statistics/categories/kbo/seasons/${season}/teams`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": USER_AGENT,
      "Referer": "https://sports.news.naver.com/",
      "Accept": "application/json",
      "X-Sports-Backend": "kotlin"
    }
  });
  if (!response.ok) throw new Error(`Naver standings ${response.status}`);

  const json = (await response.json()) as { result?: { seasonTeamStats?: Array<Record<string, unknown>> } };
  const list = json?.result?.seasonTeamStats ?? [];
  if (list.length === 0) return [];

  const standings: RawStanding[] = [];
  for (const item of list) {
    const teamId = parseTeamCode(String(item.teamName ?? ""));
    if (!teamId) continue;
    const wins = Number(item.winGameCount ?? 0);
    const losses = Number(item.loseGameCount ?? 0);
    const draws = Number(item.drawnGameCount ?? 0);
    standings.push({
      teamId,
      rank: Number(item.ranking ?? 0),
      wins,
      losses,
      draws,
      gamesBehind: String(item.gameBehind ?? "0") === "0" ? "-" : String(item.gameBehind)
    });
  }
  return standings;
}

export async function fetchStandings(season: number): Promise<{ standings: RawStanding[]; source: "kbo" | "naver" | "none" }> {
  const [kbo, naver] = await Promise.allSettled([fetchKboStandings(), fetchNaverStandings(season)]);
  const kboData = kbo.status === "fulfilled" ? kbo.value : [];
  const naverData = naver.status === "fulfilled" ? naver.value : [];

  // Pick whichever has more total games (more up-to-date)
  const sumGames = (s: RawStanding[]) => s.reduce((acc, cur) => acc + cur.wins + cur.losses + cur.draws, 0);
  if (naverData.length >= 10 && sumGames(naverData) >= sumGames(kboData)) {
    return { standings: naverData, source: "naver" };
  }
  if (kboData.length >= 10) {
    return { standings: kboData, source: "kbo" };
  }
  if (naverData.length > 0) {
    return { standings: naverData, source: "naver" };
  }
  return { standings: [], source: "none" };
}
