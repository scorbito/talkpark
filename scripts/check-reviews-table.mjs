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

console.log("=== reviews table check ===");
const { data, error, count } = await sb.from("reviews").select("*", { count: "exact", head: true });
console.log("count:", count, "error:", error?.message);

console.log("\n=== related tables ===");
for (const t of ["review_likes", "review_saves"]) {
  const { error: e, count: c } = await sb.from(t).select("*", { count: "exact", head: true });
  console.log(`${t}:`, c, e?.message ?? "OK");
}
