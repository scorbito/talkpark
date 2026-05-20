import type { SeasonLevelState, SeasonLevelTitle } from "./types";

/**
 * 레벨별 누적 XP threshold.
 * index = level - 1, value = 해당 레벨에 도달하는 데 필요한 누적 XP.
 *
 * Lv.10은 7,700 XP 기준 (풀세트 약 35경기).
 * 초반은 빠르게, 후반은 점점 더 많은 XP가 필요하도록 곡선 설계.
 */
export const LEVEL_THRESHOLDS: number[] = [
  0,     // Lv.1
  200,   // Lv.2
  600,   // Lv.3
  1100,  // Lv.4
  1800,  // Lv.5
  2700,  // Lv.6
  3800,  // Lv.7
  5000,  // Lv.8
  6300,  // Lv.9
  7700   // Lv.10
];

export const LEVEL_TITLES: SeasonLevelTitle[] = [
  "새싹직관러",
  "초보직관러",
  "응원입문자",
  "승요수련생",
  "직관루키",
  "응원단골",
  "야구장출석왕",
  "승리요정",
  "직관마스터",
  "레전드승요"
];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

/**
 * 누적 XP로 시즌 레벨 상태를 계산한다.
 * 멱등하고 순수 함수 — 같은 input에 항상 같은 output.
 */
export function getSeasonLevel(totalXp: number, season: number): SeasonLevelState {
  const safeXp = Math.max(0, Math.floor(totalXp));

  // 1) 현재 레벨 찾기 — totalXp가 threshold 이상인 가장 높은 레벨
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (safeXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  const currentLevelXp = LEVEL_THRESHOLDS[level - 1];
  const isMax = level >= MAX_LEVEL;
  const nextLevelXp = isMax ? currentLevelXp : LEVEL_THRESHOLDS[level];
  const xpToNextLevel = isMax ? 0 : nextLevelXp - safeXp;
  const span = nextLevelXp - currentLevelXp;
  const progress = isMax ? 1 : Math.min(1, Math.max(0, (safeXp - currentLevelXp) / span));

  return {
    season,
    level,
    title: LEVEL_TITLES[level - 1],
    totalXp: safeXp,
    currentLevelXp,
    nextLevelXp,
    xpToNextLevel,
    progress,
    isMax
  };
}

/**
 * Step 1 디자인 목업용 mock 데이터.
 * 디자인 검토를 위해 다양한 케이스를 보여줄 수 있도록 여러 변형 제공.
 *
 * Step 10에서 실데이터로 교체될 예정.
 */
export const MOCK_SEASON_LEVEL: SeasonLevelState = getSeasonLevel(2980, 2026); // Lv.6 응원단골 (2,980 / 3,800)

/** 현재 시즌(올해, KST). 클라이언트/서버 어디서 호출되든 안정적으로 동작. */
export function getCurrentSeasonYear(): number {
  const nowKst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return nowKst.getFullYear();
}
