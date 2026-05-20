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

console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL);

// Test 1: anon key SELECT (this is what the server uses without JWT)
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

console.log("\n=== anon SELECT profiles ===");
const { data: anonData, error: anonErr } = await anon
  .from("profiles")
  .select("id,nickname,main_team_id");
console.log("data:", anonData);
console.log("error:", anonErr?.message);

// Test 2: check policies
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

console.log("\n=== RLS policies on profiles ===");
const { data: policies, error: polErr } = await admin
  .rpc("pg_policies_lookup", {})
  .select("*");
if (polErr) {
  // Fallback: query pg_policies directly
  const { data: pol2 } = await admin
    .from("pg_policies")
    .select("*")
    .eq("tablename", "profiles");
  console.log(pol2);
} else {
  console.log(policies);
}
