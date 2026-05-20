"use server";

import { revalidatePath } from "next/cache";
import { syncStandings } from "@/lib/server/kbo/syncStandings";
import { listStandingsFromDb } from "@/lib/supabase/queries";

const MANUAL_REFRESH_COOLDOWN_MS = 60_000;
let lastManualRefreshAt = 0;

export async function refreshStandingsAction(season = new Date().getFullYear()) {
  const now = Date.now();
  const remainingMs = MANUAL_REFRESH_COOLDOWN_MS - (now - lastManualRefreshAt);

  if (remainingMs > 0) {
    return {
      ok: false as const,
      reason: `${Math.ceil(remainingMs / 1000)}초 후 다시 시도해주세요.`,
      standings: await listStandingsFromDb(season).catch(() => [])
    };
  }

  lastManualRefreshAt = now;

  try {
    await syncStandings(season);
    revalidatePath("/rankings");
    return {
      ok: true as const,
      standings: await listStandingsFromDb(season)
    };
  } catch (err) {
    lastManualRefreshAt = 0;
    return {
      ok: false as const,
      reason: err instanceof Error ? err.message : "팀순위 갱신에 실패했어요.",
      standings: await listStandingsFromDb(season).catch(() => [])
    };
  }
}
