import { AppShell } from "@/components/layout/AppShell";
import { SkeletonBox, SkeletonLine } from "@/components/common/Skeleton";

export default function ReviewDetailLoading() {
  return (
    <AppShell activeTab="community" title="후기 상세" theme="dark" backHref="/community">
      <div className="skeleton-page">
        {/* 작성자 행 (avatar + name + more) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 4px 0" }}>
          <SkeletonBox width={36} height={36} radius={18} />
          <SkeletonLine width="35%" height={13} />
        </div>
        {/* 큰 이미지 */}
        <SkeletonBox height={260} radius={14} />
        {/* 게임 메타 행 */}
        <SkeletonBox height={48} radius={10} />
        {/* 좋아요/댓글 액션 */}
        <SkeletonBox height={42} radius={10} />
        {/* 본문 */}
        <SkeletonLine width="100%" height={12} />
        <SkeletonLine width="92%" height={12} />
        <SkeletonLine width="76%" height={12} />
        {/* 댓글 입력 */}
        <SkeletonBox height={44} radius={12} />
      </div>
    </AppShell>
  );
}
