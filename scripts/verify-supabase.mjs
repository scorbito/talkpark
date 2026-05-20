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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const expectedTables = [
  "profiles", "teams", "games", "team_standings",
  "attendances", "reviews", "review_likes", "review_saves",
  "friends", "friend_requests", "notifications"
];

const expectedBuckets = ["ticket-images", "review-photos"];

console.log("=== TABLES ===");
for (const t of expectedTables) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  if (error) console.log(`  [FAIL] ${t}: ${error.message}`);
  else console.log(`  [OK]   ${t}: ${count} rows`);
}

console.log("\n=== STORAGE BUCKETS ===");
const { data: buckets, error: bErr } = await sb.storage.listBuckets();
if (bErr) console.log("  [FAIL]", bErr.message);
else {
  const names = new Set(buckets.map((b) => b.name));
  for (const n of expectedBuckets) {
    console.log(names.has(n) ? `  [OK]   ${n}` : `  [MISS] ${n}`);
  }
  const extras = buckets.map((b) => b.name).filter((n) => !expectedBuckets.includes(n));
  if (extras.length) console.log("  Extra buckets:", extras.join(", "));
}

console.log("\n=== SEED SAMPLE ===");
const { data: teams, error: tErr } = await sb.from("teams").select("id, name, short_name").order("id");
if (tErr) console.log("  teams query failed:", tErr.message);
else {
  console.log(`  teams: ${teams.length}`);
  teams.forEach((t) => console.log(`    - ${t.id} | ${t.name} (${t.short_name})`));
}

const { count: gameCount } = await sb.from("games").select("*", { count: "exact", head: true });
console.log(`  games: ${gameCount ?? "?"} rows`);
const { count: standCount } = await sb.from("team_standings").select("*", { count: "exact", head: true });
console.log(`  team_standings: ${standCount ?? "?"} rows`);

console.log("\n=== ANON READ CHECK (RLS) ===");
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
for (const t of ["teams", "games", "team_standings"]) {
  const { count, error } = await anon.from(t).select("*", { count: "exact", head: true });
  if (error) console.log(`  [FAIL] anon ${t}: ${error.message}`);
  else console.log(`  [OK]   anon ${t}: readable (${count} rows)`);
}
