import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const { count: total } = await sb.from("games").select("*", { count: "exact", head: true });
console.log("Total games:", total);

const { count: kboCount } = await sb
  .from("games")
  .select("*", { count: "exact", head: true })
  .like("external_id", "kbo-%");
console.log("KBO-sourced (external_id LIKE 'kbo-%'):", kboCount);

const { count: mockCount } = await sb
  .from("games")
  .select("*", { count: "exact", head: true })
  .like("external_id", "mock-%");
console.log("Mock seed (external_id LIKE 'mock-%'):", mockCount);

const { data: byMonth } = await sb
  .from("games")
  .select("game_date")
  .like("external_id", "kbo-%")
  .order("game_date");
const monthCounts = {};
for (const row of byMonth ?? []) {
  const m = row.game_date.slice(0, 7);
  monthCounts[m] = (monthCounts[m] ?? 0) + 1;
}
console.log("\nBy month:");
for (const [m, c] of Object.entries(monthCounts)) console.log(`  ${m}: ${c}`);

const { data: sample } = await sb
  .from("games")
  .select("game_date, game_time, stadium, home_team_id, away_team_id, home_score, away_score, status")
  .gte("game_date", "2026-05-01")
  .lte("game_date", "2026-05-10")
  .like("external_id", "kbo-%")
  .order("game_date")
  .limit(15);
console.log("\nSample (2026-05-01 ~ 05-10):");
console.table(sample);
