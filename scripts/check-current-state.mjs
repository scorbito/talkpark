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

console.log("=== auth.users ===");
const { data: users } = await sb.auth.admin.listUsers();
console.log(users.users.map((u) => ({
  id: u.id,
  email: u.email,
  email_confirmed_at: u.email_confirmed_at,
  created_at: u.created_at
})));

console.log("\n=== profiles ===");
const { data: profiles, error: pErr } = await sb
  .from("profiles")
  .select("id, nickname, main_team_id, interest_team_ids, created_at");
if (pErr) console.log("ERROR:", pErr.message);
else console.log(profiles);
