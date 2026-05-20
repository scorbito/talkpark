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

const { data: users } = await sb.auth.admin.listUsers();
console.log("auth users:", users.users.map((u) => `${u.id} (${u.email})`));

console.log("\n=== all attendances (ticket_image_hash highlighted) ===");
const { data: atts } = await sb
  .from("attendances")
  .select("id, user_id, game_id, ticket_image_url, ticket_image_hash, verified, created_at");
console.table(atts?.map((a) => ({
  id: a.id.slice(0, 8),
  user: a.user_id.slice(0, 8),
  game: a.game_id.slice(0, 8),
  hash: a.ticket_image_hash ? a.ticket_image_hash.slice(0, 12) + "..." : null,
  hasUrl: Boolean(a.ticket_image_url),
  verified: a.verified,
  created: a.created_at.slice(0, 19)
})));

console.log("\n=== ticket-images bucket files ===");
async function listAll(prefix = "", depth = 0) {
  if (depth > 3) return;
  const { data, error } = await sb.storage.from("ticket-images").list(prefix, { limit: 100 });
  if (error) { console.log("list error:", error.message); return; }
  for (const item of data ?? []) {
    if (item.id) {
      console.log(`  ${prefix}${item.name}`);
    } else {
      // folder
      await listAll(prefix + item.name + "/", depth + 1);
    }
  }
}
await listAll();
