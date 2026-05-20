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

console.log("=== List tables in public schema via metadata ===");
// Try multiple approaches

// 1. Direct head select on reviews
const { error: headErr, count } = await sb.from("reviews").select("*", { count: "exact", head: true });
console.log("HEAD select reviews:", { count, error: headErr?.message, code: headErr?.code });

// 2. Try a real select
const { data: reviewsData, error: selectErr } = await sb.from("reviews").select("id").limit(1);
console.log("SELECT id reviews:", { rows: reviewsData?.length, error: selectErr?.message, code: selectErr?.code });

// 3. List user's attendances to find one to attach review to
const { data: atts } = await sb.from("attendances").select("id, user_id").limit(3);
console.log("\nattendances sample:", atts);

if (atts && atts.length > 0) {
  console.log("\n=== Try test insert into reviews ===");
  const att = atts[0];
  const { data: insData, error: insErr } = await sb.from("reviews").insert({
    user_id: att.user_id,
    attendance_id: att.id,
    body: "테스트 후기 본문 5자 이상",
    photos: ["/assets/mainherobg.png"],
    public_scope: "public"
  }).select();
  console.log("INSERT result:", { data: insData, error: insErr?.message, code: insErr?.code });

  if (insData && insData[0]) {
    const insertedId = insData[0].id;
    await sb.from("reviews").delete().eq("id", insertedId);
    console.log("Cleanup: deleted test row");
  }
}
