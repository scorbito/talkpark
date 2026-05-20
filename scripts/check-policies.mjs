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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: "public" }
});

// Use raw SQL via Postgres REST endpoint (RPC)
// Need to create a tiny SQL exec function or use the metadata endpoint
// Simpler: query via the Supabase Management API isn't available with service key directly,
// so let's try to call a stored function. If not available, we'll print what we can.

// Try using pgmeta-style query via from with schema
const { data, error } = await admin
  .from("profiles")
  .select("*")
  .limit(5);

console.log("admin profiles:", data?.length ?? 0, "rows", error?.message ?? "");

// Check if RLS is enabled — query pg_class via service role
// Service role bypasses RLS so direct SELECT works
const { data: oneRow } = await admin.from("profiles").select("id, nickname, main_team_id");
console.log("admin can read:", oneRow);

// Now test anon explicitly
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});
const { data: anonRows, error: anonErr } = await anon.from("profiles").select("id");
console.log("anon SELECT profiles:", anonRows, "err:", anonErr?.message);

const { data: anonTeams } = await anon.from("teams").select("id").limit(2);
console.log("anon SELECT teams (sanity):", anonTeams);
