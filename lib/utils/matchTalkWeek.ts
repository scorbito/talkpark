/**
 * 경기톡 작성 가능 기간 — 이번 주 월~일(KST).
 * 기획서: docs/planning/match-talk.md §3.1 (월요일 00시 KST 기준 새 주차 시작)
 */
export function getThisWeekRangeKst(now: Date = new Date()): { from: string; to: string } {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dayOfWeek = kst.getDay(); // 0=일, 1=월, ...
  const daysSinceMonday = (dayOfWeek + 6) % 7; // 월요일이면 0
  const monday = new Date(kst);
  monday.setDate(kst.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(monday), to: fmt(sunday) };
}
