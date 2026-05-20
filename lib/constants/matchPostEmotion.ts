import type { MatchPostEmotionTag } from "@/lib/types/domain";

/**
 * 경기톡 감정 태그 메타 — 모든 화면에서 동일한 이모지/라벨/힌트를 보여주기 위한 단일 소스.
 * 작성 모달(MatchTalkComposerModal), 카드 모드(MatchPostCard), 타임라인 모드(MatchTalkTimeline)
 * 모두 여기서 import 한다.
 */
export const MATCH_POST_EMOTION_META: Record<
  MatchPostEmotionTag,
  { emoji: string; label: string; hint: string }
> = {
  cheer: { emoji: "🎉", label: "환호", hint: "홈런·승리·좋은 플레이" },
  support: { emoji: "📣", label: "응원", hint: "경기 전/중 응원, 화이팅" },
  anger: { emoji: "😡", label: "분노", hint: "오심·부진·패배" },
  anxiety: { emoji: "😰", label: "불안", hint: "동점·마무리 위기" }
};

export const MATCH_POST_EMOTION_OPTIONS: { id: MatchPostEmotionTag; emoji: string; label: string; hint: string }[] = [
  { id: "cheer", ...MATCH_POST_EMOTION_META.cheer },
  { id: "support", ...MATCH_POST_EMOTION_META.support },
  { id: "anger", ...MATCH_POST_EMOTION_META.anger },
  { id: "anxiety", ...MATCH_POST_EMOTION_META.anxiety }
];
