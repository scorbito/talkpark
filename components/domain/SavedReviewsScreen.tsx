"use client";

import { Bookmark } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ReviewCard } from "@/components/domain/ReviewCard";
import { ProfileModal, useProfileModal } from "@/components/domain/modals/ProfileModal";
import { useAppState } from "@/lib/state/AppState";
import type { Review } from "@/lib/types/domain";

type SavedReviewsScreenProps = {
  reviews: Review[];
};

export function SavedReviewsScreen({ reviews }: SavedReviewsScreenProps) {
  const { likedReviewIds, savedReviewIds, toggleLike, toggleSave } = useAppState();
  const profileModal = useProfileModal();

  // 사용자가 페이지에서 저장 토글을 다시 누르면 savedReviewIds 가 바뀌므로,
  // 표시 중인 목록에서 즉시 제거되도록 필터.
  const visibleReviews = reviews.filter((r) => savedReviewIds.includes(r.id));

  return (
    <AppShell activeTab="my" title="저장한 후기" theme="dark" backHref="/my">
      <div className="review-feed">
        {visibleReviews.map((review) => (
          <ReviewCard
            key={review.id}
            liked={likedReviewIds.includes(review.id)}
            review={review}
            saved={savedReviewIds.includes(review.id)}
            onToggleLike={() => toggleLike(review.id)}
            onToggleSave={() => toggleSave(review.id)}
            onAuthorClick={profileModal.openProfile}
          />
        ))}
        {visibleReviews.length === 0 ? (
          <div className="empty-state-large">
            <div className="empty-state-icon"><Bookmark size={28} /></div>
            <p>아직 저장한 후기가 없어요.<br />커뮤니티에서 마음에 드는 후기를 북마크해보세요.</p>
          </div>
        ) : null}
      </div>
      <ProfileModal {...profileModal.modalProps} />
    </AppShell>
  );
}
