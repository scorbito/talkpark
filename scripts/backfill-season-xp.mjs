#!/usr/bin/env node
/**
 * 시즌 레벨 XP 백필 스크립트 (Step 9)
 * 시즌 레벨 기능 도입 시점에 기존 attendances/reviews 데이터를 기준으로
 * XP 이벤트를 소급 생성. 멱등 — 같은 백필을 여러 번 실행해도 중복 안 됨.
 *
 * Usage:
 *   node scripts/backfill-season-xp.mjs            # 기본: 현재 연도 시즌 dry-run
 *   node scripts/backfill-season-xp.mjs 2026       # 특정 시즌
 *   node scripts/backfill-season-xp.mjs 2026 --apply  # 실제 적용 (없으면 dry-run)
 *
 * 백필 대상 (시즌 = games.game_date의 연도):
 *   - attendances.result_acknowledged_at IS NOT NULL → attendance_result_acknowledged +30
 *   - attendances.verified = true                   → ticket_verified +100
 *   - reviews with attendance_id                    → review_created +70
 *   - reviews.photos에 사용자 사진 1장 이상 (length > 0) → review_photo_bonus +20
 *
 * 정책:
 *   - 시스템 기본 이미지는 더 이상 사용 안 함 (P0). photos.length > 0이면 모두 사용자 사진.
 *   - upsert(onConflict, ignoreDuplicates) — 이미 있는 이벤트는 건너뜀.
 *   - dry-run 모드: 무엇이 들어갈지만 출력, 실제 INSERT 안 함.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ----- env load -----
const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

// ----- args -----
const args = process.argv.slice(2);
const seasonArg = args.find((a) => /^\d{4}$/.test(a));
const apply = args.includes("--apply");
const season = seasonArg ? Number(seasonArg) : new Date().getFullYear();
const startDate = `${season}-01-01`;
const endDate = `${season}-12-31`;

console.log(`\n시즌 XP 백필 — 시즌 ${season} (${apply ? "APPLY" : "DRY RUN"})`);
console.log(`범위: ${startDate} ~ ${endDate}\n`);

const XP = {
  attendance_result_acknowledged: 30,
  ticket_verified: 100,
  review_created: 70,
  review_photo_bonus: 20
};

const events = [];

// ----- 1) attendance_result_acknowledged + ticket_verified -----
console.log("1) attendances 조회 (result_acknowledged_at, verified, game_date)...");
const { data: attendances, error: attErr } = await admin
  .from("attendances")
  .select("id, user_id, result_acknowledged_at, verified, games!inner(game_date)")
  .gte("games.game_date", startDate)
  .lte("games.game_date", endDate);

if (attErr) {
  console.error("attendances 조회 실패:", attErr.message);
  process.exit(1);
}

console.log(`  → ${attendances.length}개 attendance 조회됨`);

for (const a of attendances) {
  const gameDate = a.games?.game_date;
  if (!gameDate) continue;
  if (a.result_acknowledged_at) {
    events.push({
      user_id: a.user_id,
      season,
      type: "attendance_result_acknowledged",
      source_id: a.id,
      xp: XP.attendance_result_acknowledged,
      metadata: { backfilled_at: new Date().toISOString() }
    });
  }
  if (a.verified) {
    events.push({
      user_id: a.user_id,
      season,
      type: "ticket_verified",
      source_id: a.id,
      xp: XP.ticket_verified,
      metadata: { backfilled_at: new Date().toISOString() }
    });
  }
}

// ----- 2) review_created + review_photo_bonus -----
console.log("\n2) reviews 조회 (attendance_id, photos, game_date)...");
const { data: reviews, error: revErr } = await admin
  .from("reviews")
  .select("id, user_id, attendance_id, photos, attendances!inner(games!inner(game_date))")
  .not("attendance_id", "is", null);

if (revErr) {
  console.error("reviews 조회 실패:", revErr.message);
  process.exit(1);
}

// 현재 시즌 범위로 필터 (Supabase nested filter는 정확하지 않을 수 있어 클라이언트에서 한 번 더)
const seasonReviews = reviews.filter((r) => {
  const gd = r.attendances?.games?.game_date;
  return gd && gd >= startDate && gd <= endDate;
});

console.log(`  → ${seasonReviews.length}개 review (시즌 ${season} 범위)`);

for (const r of seasonReviews) {
  if (!r.attendance_id) continue;
  events.push({
    user_id: r.user_id,
    season,
    type: "review_created",
    source_id: r.attendance_id,
    xp: XP.review_created,
    metadata: { backfilled_at: new Date().toISOString() }
  });
  const photos = Array.isArray(r.photos) ? r.photos : [];
  if (photos.length > 0) {
    events.push({
      user_id: r.user_id,
      season,
      type: "review_photo_bonus",
      source_id: r.attendance_id,
      xp: XP.review_photo_bonus,
      metadata: { backfilled_at: new Date().toISOString() }
    });
  }
}

// ----- 요약 -----
console.log(`\n총 ${events.length}개 XP 이벤트 후보 생성됨`);
const byType = events.reduce((acc, e) => {
  acc[e.type] = (acc[e.type] || 0) + 1;
  return acc;
}, {});
console.log("타입별:", byType);

if (!apply) {
  console.log("\nDRY RUN — 실제 INSERT 안 함. 적용하려면 `--apply` 옵션 추가.");
  console.log("샘플 3개:", events.slice(0, 3));
  process.exit(0);
}

// ----- 실제 적용 -----
console.log("\n적용 중... (upsert with ignoreDuplicates)");
const BATCH = 500;
let inserted = 0;
let skipped = 0;
for (let i = 0; i < events.length; i += BATCH) {
  const chunk = events.slice(i, i + BATCH);
  const { data, error } = await admin
    .from("season_xp_events")
    .upsert(chunk, { onConflict: "user_id,season,type,source_id", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error(`배치 ${i}-${i + chunk.length} 실패:`, error.message);
    continue;
  }
  inserted += data?.length ?? 0;
  skipped += chunk.length - (data?.length ?? 0);
  console.log(`  배치 ${i}-${i + chunk.length}: 신규 ${data?.length ?? 0} / 스킵 ${chunk.length - (data?.length ?? 0)}`);
}

console.log(`\n완료! 신규 ${inserted} / 스킵(이미 존재) ${skipped}`);
process.exit(0);
