"use server";

import { getCurrentUserReviewReactionsFromDb, listGamesFromDb, listReviewsFromDb } from "@/lib/supabase/queries";
import type { Game, Review } from "@/lib/types/domain";

/** 마이 페이지/직관 등록 모달용 본인 후기 목록.
 *  layout SSR에서 빼고 AppStateProvider 마운트 후 클라에서 호출 → 첫 진입 시간 단축. */
export async function loadMyReviewsAction(): Promise<Review[]> {
  return listReviewsFromDb({ onlyMine: true });
}

/** 좋아요/저장한 후기 ID 목록.
 *  /community, 후기 상세, 마이 화면에서 사용. layout에서 빼고 클라 페치로 분리. */
export async function loadMyReactionsAction(): Promise<{ likedReviewIds: string[]; savedReviewIds: string[] }> {
  return getCurrentUserReviewReactionsFromDb();
}

/** 직관 등록 모달용 경기 목록 — 사용자가 모달을 열 때만 호출.
 *  홈 SSR에서 빼서 페이지 진입 부담 ↓ (시즌 후반에 경기 수 증가 시 효과 큼). */
export async function loadAttendanceModalGamesAction(): Promise<Game[]> {
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // 시즌 시작(3월 1일) ~ 오늘 + 14일 — 기존 page.tsx 범위 유지.
  const start = new Date(today.getFullYear(), 2, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);

  const items = await listGamesFromDb({ from: fmt(start), to: fmt(end) }).catch(() => []);
  return items.map((game) => ({
    id: game.id,
    date: game.date.replaceAll("-", "."),
    time: game.time ?? "",
    stadium: game.stadium,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    status: game.status === "finished" || game.status === "canceled" ? game.status : "scheduled"
  }));
}
