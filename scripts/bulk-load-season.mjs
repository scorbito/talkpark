#!/usr/bin/env node
/**
 * 한 시즌의 KBO 전체 일정을 Supabase games 테이블에 적재.
 *
 * Usage:
 *   node scripts/bulk-load-season.mjs            # 기본: 2026 시즌
 *   node scripts/bulk-load-season.mjs 2025       # 특정 연도
 *   node scripts/bulk-load-season.mjs 2026 03 11 # 시작 월/일 지정 (기본 03-01 ~ 11-30)
 *
 * KBO 정규시즌은 보통 3월 말 ~ 10월. 안전하게 3월 1일 ~ 11월 30일 스캔.
 * KBO API는 시즌 외 날짜에 빈 배열을 반환하므로 안전.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as cheerio from "cheerio";

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

const SEASON = parseInt(process.argv[2] ?? "2026", 10);
const START_MONTH = parseInt(process.argv[3] ?? "3", 10);
const END_MONTH = parseInt(process.argv[4] ?? "11", 10);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const USER_AGENT =
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

function mapStatus(stateCode, stateName, isCancelled) {
  if (isCancelled) return "canceled";
  if (stateCode === "2" || stateName.includes("중") || stateName.includes("진행")) return "in_progress";
  if (stateCode === "3" || stateName.includes("종료")) return "finished";
  return "scheduled";
}

async function fetchKboApi(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyymmdd = `${yyyy}${mm}${dd}`;
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const url = `https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList?leId=1&srId=0&date=${yyyymmdd}&_t=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`KBO API ${response.status}`);

  const data = await response.json();
  if (!data?.game || !Array.isArray(data.game)) return [];

  const games = [];
  for (const g of data.game) {
    const isCancelled = g.CANCEL_SC_ID !== "0" && g.CANCEL_SC_ID !== undefined;
    const awayTeamId = parseTeamCode(String(g.AWAY_NM ?? ""));
    const homeTeamId = parseTeamCode(String(g.HOME_NM ?? ""));
    if (!awayTeamId || !homeTeamId) continue;

    const stateCode = String(g.GAME_STATE_SC ?? "");
    const stateName = String(g.GAME_STATE_NM ?? "");
    const status = mapStatus(stateCode, stateName, Boolean(isCancelled));
    const homeScoreRaw = String(g.B_SCORE_CN ?? "");
    const awayScoreRaw = String(g.T_SCORE_CN ?? "");
    const homeScore = status === "finished" || status === "in_progress" ? parseInt(homeScoreRaw || "0", 10) : null;
    const awayScore = status === "finished" || status === "in_progress" ? parseInt(awayScoreRaw || "0", 10) : null;
    const inningRaw = parseInt(String(g.GAME_INN_NO ?? "0"), 10);

    games.push({
      external_id: `kbo-${yyyymmdd}-${awayTeamId}-${homeTeamId}`,
      game_date: dateStr,
      game_time: g.G_TM ? String(g.G_TM) : null,
      stadium: String(g.S_NM ?? "미정"),
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_score: homeScore,
      away_score: awayScore,
      status,
      innings: status === "finished" ? (inningRaw > 0 ? inningRaw : 9) : null
    });
  }
  return games;
}

async function fetchNaver(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyymmdd = `${yyyy}${mm}${dd}`;
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const url = `https://sports.news.naver.com/kbaseball/schedule/index?date=${yyyymmdd}`;
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Naver ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const games = [];

  $(".sch_tb tbody tr").each((_, element) => {
    const $row = $(element);
    const timeStr = $row.find(".time").text().trim();
    if (!timeStr || timeStr === "-") return;

    const teamA = $row.find(".team_lft").text().trim();
    const teamB = $row.find(".team_rgt").text().trim();
    const awayTeamId = parseTeamCode(teamA);
    const homeTeamId = parseTeamCode(teamB);
    if (!awayTeamId || !homeTeamId) return;

    const stateText = $row.find(".state").text().trim();
    let status = "scheduled";
    if (stateText.includes("종료")) status = "finished";
    else if (stateText.includes("취소")) status = "canceled";
    else if (stateText.includes("회") || stateText.includes("중계")) status = "in_progress";

    const homeScore = status === "finished" || status === "in_progress"
      ? parseInt($row.find(".num_rgt").text().trim() || "0", 10)
      : null;
    const awayScore = status === "finished" || status === "in_progress"
      ? parseInt($row.find(".num_lft").text().trim() || "0", 10)
      : null;

    games.push({
      external_id: `kbo-${yyyymmdd}-${awayTeamId}-${homeTeamId}`,
      game_date: dateStr,
      game_time: timeStr,
      stadium: $row.find(".place").text().trim() || "미정",
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_score: homeScore,
      away_score: awayScore,
      status,
      innings: status === "finished" ? 9 : null
    });
  });
  return games;
}

async function fetchForDate(date) {
  try {
    const games = await fetchKboApi(date);
    return { games, source: "kbo" };
  } catch (err) {
    try {
      const games = await fetchNaver(date);
      return { games, source: "naver" };
    } catch {
      return { games: [], source: "none" };
    }
  }
}

async function upsertGames(games) {
  if (games.length === 0) return { inserted: 0, updated: 0 };
  const externalIds = games.map((g) => g.external_id);
  const { data: existing } = await supabase
    .from("games")
    .select("external_id")
    .in("external_id", externalIds);
  const existingIds = new Set((existing ?? []).map((row) => row.external_id));
  const inserts = games.filter((g) => !existingIds.has(g.external_id));
  const updates = games.filter((g) => existingIds.has(g.external_id));

  let inserted = 0;
  let updated = 0;

  if (inserts.length > 0) {
    const { error } = await supabase.from("games").insert(inserts);
    if (error) console.error("insert error:", error.message);
    else inserted = inserts.length;
  }

  for (const row of updates) {
    const { external_id, ...rest } = row;
    const { error } = await supabase.from("games").update(rest).eq("external_id", external_id);
    if (error) console.error(`update error ${external_id}:`, error.message);
    else updated++;
  }

  return { inserted, updated };
}

async function main() {
  console.log(`KBO ${SEASON} season bulk load: ${SEASON}-${String(START_MONTH).padStart(2, "0")}-01 ~ ${SEASON}-${String(END_MONTH).padStart(2, "0")}-30`);

  const start = new Date(SEASON, START_MONTH - 1, 1);
  const end = new Date(SEASON, END_MONTH - 1, 30);

  let totalInserted = 0;
  let totalUpdated = 0;
  let daysWithGames = 0;
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const dateLabel = cursor.toISOString().slice(0, 10);
    const { games, source } = await fetchForDate(new Date(cursor));
    if (games.length > 0) {
      const { inserted, updated } = await upsertGames(games);
      totalInserted += inserted;
      totalUpdated += updated;
      daysWithGames++;
      console.log(`[${dateLabel}] ${source} ${games.length} games (+${inserted} ~${updated})`);
    } else {
      process.stdout.write(".");
    }
    cursor.setDate(cursor.getDate() + 1);
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n\n=== Done ===`);
  console.log(`Days with games: ${daysWithGames}`);
  console.log(`Inserted: ${totalInserted}, Updated: ${totalUpdated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
