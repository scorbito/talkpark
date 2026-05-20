import type { Game } from "@/lib/types/domain";

export const shareTemplates = [
  { id: "red", label: "불꽃 레드", src: "/assets/share-bg-navy-red.png" },
  { id: "field", label: "그라운드", src: "/assets/share-bg-field.png" },
  { id: "white", label: "미니멀", src: "/assets/share-bg-white.png" }
] as const;

export const publicScopeMap = {
  "전체 공개": "public",
  "친구 공개": "friends",
  "나만 보기": "private"
} as const;

export type ShareTemplate = (typeof shareTemplates)[number];
export type PrivacyLabel = keyof typeof publicScopeMap;
export type PublicScopeValue = (typeof publicScopeMap)[PrivacyLabel];

export function publicScopeToLabel(scope?: PublicScopeValue): PrivacyLabel {
  if (scope === "friends") return "친구 공개";
  if (scope === "private") return "나만 보기";
  return "전체 공개";
}

export function extractHashtags(body: string): string[] {
  const matches = body.match(/#[가-힣ㄱ-ㆎa-zA-Z0-9_]+/g) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of matches) {
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
      if (result.length >= 20) break;
    }
  }
  return result;
}

export function getAttendanceResult(game: Game, supportTeamId: string): "win" | "lose" | "draw" | undefined {
  if (game.status !== "finished" || game.homeScore === undefined || game.awayScore === undefined) {
    return undefined;
  }

  if (game.homeScore === game.awayScore) {
    return "draw";
  }

  if (supportTeamId === game.homeTeamId) {
    return game.homeScore > game.awayScore ? "win" : "lose";
  }

  if (supportTeamId === game.awayTeamId) {
    return game.awayScore > game.homeScore ? "win" : "lose";
  }

  return undefined;
}
