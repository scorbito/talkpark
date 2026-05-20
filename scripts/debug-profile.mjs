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

console.log("=== profiles ===");
const { data: profiles } = await sb.from("profiles").select("id,nickname,main_team_id,created_at");
console.log(profiles);

console.log("\n=== auth.users ===");
const { data: users } = await sb.auth.admin.listUsers();
console.log(users.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })));

console.log("\n=== profile_stats view ===");
const { data: stats, error: statsErr } = await sb.from("profile_stats").select("*").limit(5);
if (statsErr) console.log("ERROR:", statsErr.message);
else console.log(stats);

console.log("\n=== verified_attendance_results view ===");
const { data: var_, error: varErr } = await sb.from("verified_attendance_results").select("*").limit(5);
if (varErr) console.log("ERROR:", varErr.message);
else console.log(var_);
