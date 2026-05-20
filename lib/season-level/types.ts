/**
 * 시즌 레벨 도메인 타입.
 * Step 1(디자인 목업) 단계에서는 mock 데이터로 채워지고, Step 10에서 실데이터로 교체된다.
 */

export type SeasonLevelTitle =
  | "새싹직관러"
  | "초보직관러"
  | "응원입문자"
  | "승요수련생"
  | "직관루키"
  | "응원단골"
  | "야구장출석왕"
  | "승리요정"
  | "직관마스터"
  | "레전드승요";

/** 현재 시즌 레벨 + XP 진행 상태. */
export type SeasonLevelState = {
  /** 시즌 (예: 2026) */
  season: number;
  /** 현재 레벨 (1~10) */
  level: number;
  /** 현재 칭호 */
  title: SeasonLevelTitle;
  /** 누적 시즌 XP */
  totalXp: number;
  /** 현재 레벨의 시작 XP (진행 바 좌측 기준점) */
  currentLevelXp: number;
  /** 다음 레벨의 시작 XP (Lv.10이면 totalXp와 같음) */
  nextLevelXp: number;
  /** 다음 레벨까지 남은 XP (Lv.10이면 0) */
  xpToNextLevel: number;
  /** 진행률 0~1 (Lv.10이면 1) */
  progress: number;
  /** Lv.10 도달 여부 */
  isMax: boolean;
};
