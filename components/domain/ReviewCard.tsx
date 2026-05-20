"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import type { Review } from "@/lib/types/domain";

type ReviewCardProps = {
  review: Review;
  liked?: boolean;
  saved?: boolean;
  onToggleLike?: () => void;
  onToggleSave?: () => void;
  actionSlot?: ReactNode;
  /** 작성자 아바타/닉네임 탭 시 프로필 모달 열기 핸들러. 없으면 클릭 비활성. */
  onAuthorClick?: (userId: string) => void;
};

export function ReviewCard({ review, liked = false, saved = false, onToggleLike, onToggleSave, actionSlot, onAuthorClick }: ReviewCardProps) {
  const { showToast } = useAppState();
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [review.body]);

  const showToggle = isClamped || expanded;

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}/reviews/${review.id}`;
    const shareTitle = review.title || `${review.author}님의 직관 후기`;

    // 1. Native Web Share API 우선 사용 (모바일 기본 공유 시트)
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      } catch (err) {
        // 사용자가 시트를 닫은 경우(AbortError)는 그냥 종료
        if (err instanceof Error && err.name === "AbortError") return;
        // 다른 오류는 클립보드 폴백 시도
      }
    }

    // 2. 폴백 — 클립보드 복사
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast("링크가 복사되었어요. 원하는 곳에 붙여넣어보세요.");
      } else {
        showToast("이 브라우저에서는 공유를 지원하지 않아요.");
      }
    } catch {
      showToast("링크 복사에 실패했어요.");
    }
  };

  return (
    <article className="review-card">
      <div className="review-author">
        {(() => {
          const avatar = review.authorAvatarUrl ? (
            <span className="review-avatar review-avatar-image" aria-hidden="true">
              <Image alt="" src={review.authorAvatarUrl} fill sizes="32px" style={{ objectFit: "cover" }} />
            </span>
          ) : (
            <span className="review-avatar review-avatar-initial" aria-hidden="true">
              {(review.author || "?").slice(0, 1)}
            </span>
          );
          const clickable = Boolean(onAuthorClick && review.ownerId);
          if (clickable) {
            return (
              <>
                <button
                  type="button"
                  className="profile-author-trigger"
                  aria-label={`${review.author}님의 프로필 보기`}
                  onClick={() => onAuthorClick!(review.ownerId!)}
                >
                  {avatar}
                </button>
                <button
                  type="button"
                  className="profile-author-trigger review-author-name"
                  aria-label={`${review.author}님의 프로필 보기`}
                  onClick={() => onAuthorClick!(review.ownerId!)}
                >
                  <strong>{review.author}</strong>
                  <span>{review.timeAgo}</span>
                </button>
              </>
            );
          }
          return (
            <>
              {avatar}
              <div>
                <strong>{review.author}</strong>
                <span>{review.timeAgo}</span>
              </div>
            </>
          );
        })()}
        {actionSlot ? <div className="review-author-action">{actionSlot}</div> : null}
        <TeamBadge teamId={review.teamId} size="sm" />
      </div>
      <Link className="review-image-link" href={`/reviews/${review.id}`} prefetch draggable={false}>
        <Image
          alt={review.title || "후기 사진"}
          className="review-image"
          height={220}
          src={review.image}
          width={330}
          draggable={false}
        />
        {review.images && review.images.length > 1 ? <span>1/{review.images.length}</span> : null}
      </Link>
      {review.game ? (() => {
        const home = getTeam(review.game.homeTeamId);
        const away = getTeam(review.game.awayTeamId);
        const score = review.game.homeScore !== null && review.game.awayScore !== null
          ? `${review.game.homeScore} : ${review.game.awayScore}`
          : "경기전";
        const result = review.game.result;
        const resultLabel = result === "win" ? "승" : result === "lose" ? "패" : result === "draw" ? "무" : null;
        return (
          <div className="review-game-meta">
            <span className="review-game-meta-date">{review.game.date}</span>
            <div className="review-game-meta-match">
              <span className="review-game-meta-side review-game-meta-side-home">
                <TeamBadge teamId={review.game.homeTeamId} size="sm" />
                <strong>{home.shortName}</strong>
              </span>
              <b>{score}</b>
              <span className="review-game-meta-side review-game-meta-side-away">
                <strong>{away.shortName}</strong>
                <TeamBadge teamId={review.game.awayTeamId} size="sm" />
              </span>
            </div>
            {resultLabel ? (
              <span className={`review-game-meta-result review-game-meta-result-${result}`}>{resultLabel}</span>
            ) : null}
          </div>
        );
      })() : null}
      {review.title ? <Link className="review-title" href={`/reviews/${review.id}`} prefetch>{review.title}</Link> : null}
      <p ref={bodyRef} className={expanded ? "review-body" : "review-body review-body-clamped"}>
        {review.body}
      </p>
      {showToggle ? (
        <button
          type="button"
          className="review-body-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "접기" : "더보기"}
        </button>
      ) : null}
      {/* 해시태그 칩은 MVP에서 숨김 — 본문 안 #태그 텍스트는 그대로 표시 */}
      <div className="review-actions">
        <button
          aria-label={liked ? "좋아요 취소" : "좋아요"}
          aria-pressed={liked}
          onClick={onToggleLike}
          style={liked ? { color: "#ff6a2b" } : undefined}
          type="button"
        >
          <Heart fill={liked ? "currentColor" : "none"} size={18} />
          {review.likes}
        </button>
        <Link className="review-comment-link" href={`/reviews/${review.id}#comments`} prefetch aria-label="댓글 보기">
          <MessageCircle size={18} />{review.comments}
        </Link>
        <button type="button" aria-label="후기 공유" onClick={handleShare}>
          <Send size={18} />
        </button>
        <button
          aria-label={saved ? "저장 취소" : "저장"}
          aria-pressed={saved}
          onClick={onToggleSave}
          style={saved ? { color: "#2563eb" } : undefined}
          type="button"
        >
          <Bookmark fill={saved ? "currentColor" : "none"} size={18} />
        </button>
      </div>
    </article>
  );
}
