#!/usr/bin/env node
// KBO 순위 동기화. KBO 공식 + 네이버 API 둘 다 시도하고 더 최신 소스 채택.
// Usage: node scripts/sync-standings.mjs [season]

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as cheerio from "cheerio";

const SEASON = parseInt(process.argv[2] ?? new Date().getFullYear(), 10);

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function parseTeamCode(name) {
  if (!name) return null;
  const up = name.toUpperCase();
  if (up.includes("LG")) return "lg";
  if (up.includes("KT")) return "kt";
  if (up.includes("SSG") || up.includes("SK")) return "ssg";
  if (up.includes("NC")) return "nc";
  if (up.includes("두산") || up.includes("DOO") || up.includes("OB")) return "doosan";
  if (up.includes("KIA") || up.includes("기아") || up.includes("타이거즈")) return "kia";
  if (up.includes("롯데") || up.includes("LOT")) return "lotte";
  if (up.includes("삼성") || up.includes("SAM")) return "samsung";
  if (up.includes("한화") || up.includes("HAN")) return "hanwha";
  if (up.includes("키움") || up.includes("히어로즈") || up.includes("KIW")) return "kiwoom";
  return null;
}

async function fetchKboStandings() {
  const url = "https://www.koreabaseball.com/Record/TeamRank/TeamRank.aspx";
  const r = await fetch(url, { cache: "no-store", headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`KBO ${r.status}`);
  const $ = cheerio.load(await r.text());
  const out = [];
  $(".tData tbody tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 8) return;
    const teamId = parseTeamCode(tds.eq(1).text().trim());
    if (!teamId) return;
    const gb = tds.eq(7).text().trim();
    out.push({
      teamId,
      rank: parseInt(tds.eq(0).text().trim(), 10),
      wins: parseInt(tds.eq(3).text().trim(), 10),
      losses: parseInt(tds.eq(4).text().trim(), 10),
      draws: parseInt(tds.eq(5).text().trim(), 10),
      gamesBehind: gb === "-" || gb === "0" ? "-" : gb
    });
  });
  return out;
}

async function fetchNaverStandings(season) {
  const url = `https://api-gw.sports.naver.com/statistics/categories/kbo/seasons/${season}/teams`;
  const r = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": UA,
      Referer: "https://sports.news.naver.com/",
      Accept: "application/json",
      "X-Sports-Backend": "kotlin"
    }
  });
  if (!r.ok) throw new Error(`Naver ${r.status}`);
  const json = await r.json();
  const list = json?.result?.seasonTeamStats ?? [];
  const out = [];
  for (const item of list) {
    const teamId = parseTeamCode(String(item.teamName ?? ""));
    if (!teamId) continue;
    const gb = String(item.gameBehind ?? "0");
    out.push({
      teamId,
      rank: Number(item.ranking ?? 0),
      wins: Number(item.winGameCount ?? 0),
      losses: Number(item.loseGameCount ?? 0),
      draws: Number(item.drawnGameCount ?? 0),
      gamesBehind: gb === "0" ? "-" : gb
    });
  }
  return out;
}

const sumGames = (s) => s.reduce((acc, c) => acc + c.wins + c.losses + c.draws, 0);

/** 각 팀의 가장 최근 finished 5경기 결과를 [최근→과거] 순서로 배열로 반환 */
async function fetchRecentForms(season) {
  const start = `${season}-01-01`;
  const end = `${season}-12-31`;
  const { data: games, error } = await sb
    .from("games")
    .select("game_date, home_team_id, away_team_id, home_score, away_score")
    .gte("game_date", start)
    .lte("game_date", end)
    .eq("status", "finished")
    .order("game_date", { ascending: false });

  if (error) throw new Error(`recent games fetch: ${error.message}`);

  const formByTeam = {};
  for (const g of games ?? []) {
    if (g.home_score == null || g.away_score == null) continue;
    const teams = [
      { id: g.home_team_id, my: g.home_score, opp: g.away_score },
      { id: g.away_team_id, my: g.away_score, opp: g.home_score }
    ];
    for (const t of teams) {
      if (!formByTeam[t.id]) formByTeam[t.id] = [];
      if (formByTeam[t.id].length >= 5) continue;
      const result = t.my > t.opp ? "win" : t.my < t.opp ? "lose" : "draw";
      formByTeam[t.id].push(result);
    }
  }
  // form is [most recent first] in our rendering pipeline; existing UI shows .slice(-5) so keep this order.
  // To match the convention used by seed (which lists oldest→newest in last 5), reverse to oldest→newest.
  for (const id of Object.keys(formByTeam)) {
    formByTeam[id] = formByTeam[id].reverse();
  }
  return formByTeam;
}

async function main() {
  console.log(`Fetching ${SEASON} standings...`);
  const [kboRes, naverRes] = await Promise.allSettled([fetchKboStandings(), fetchNaverStandings(SEASON)]);
  const kbo = kboRes.status === "fulfilled" ? kboRes.value : [];
  const naver = naverRes.status === "fulfilled" ? naverRes.value : [];

  if (kboRes.status === "rejected") console.warn("KBO fetch failed:", kboRes.reason?.message);
  if (naverRes.status === "rejected") console.warn("Naver fetch failed:", naverRes.reason?.message);

  console.log(`KBO: ${kbo.length} teams (${sumGames(kbo)} games), Naver: ${naver.length} teams (${sumGames(naver)} games)`);

  let chosen = kbo;
  let source = "kbo";
  if (naver.length >= 10 && sumGames(naver) >= sumGames(kbo)) {
    chosen = naver;
    source = "naver";
  } else if (kbo.length < 10 && naver.length > 0) {
    chosen = naver;
    source = "naver";
  }

  if (chosen.length === 0) {
    console.error("No standings data from any source.");
    process.exit(1);
  }

  console.log(`Source: ${source} (${chosen.length} teams)`);
  console.table(chosen);

  console.log("Computing recent 5-game forms from games table...");
  const formByTeam = await fetchRecentForms(SEASON);

  const rows = chosen.map((s) => ({
    team_id: s.teamId,
    season: SEASON,
    rank: s.rank,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    games_behind: s.gamesBehind,
    form: formByTeam[s.teamId] ?? [],
    synced_at: new Date().toISOString()
  }));

  console.log("Forms (oldest→newest):");
  for (const r of rows) {
    console.log(`  ${r.team_id}: [${r.form.join(", ")}]`);
  }

  const { error } = await sb.from("team_standings").upsert(rows, { onConflict: "team_id,season" });
  if (error) {
    console.error("Upsert error:", error.message);
    process.exit(1);
  }
  console.log(`✅ Upserted ${rows.length} standings for season ${SEASON}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
