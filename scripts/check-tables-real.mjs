import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
  })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const expected = ["teams", "profiles", "games", "team_standings", "attendances", "reviews", "review_likes", "review_saves", "friends", "friend_requests", "notifications"];

console.log("Real SELECT (not head):");
for (const t of expected) {
  const { data, error } = await sb.from(t).select("*").limit(1);
  console.log(`  ${t.padEnd(20)} : ${error ? "❌ " + error.code + " " + error.message : "✅ rows=" + (data?.length ?? "n/a")}`);
}
