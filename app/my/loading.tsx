import { AppShell } from "@/components/layout/AppShell";
import { SkeletonBox, SkeletonLine, SkeletonList } from "@/components/common/Skeleton";

export default function MyLoading() {
  return (
    <AppShell activeTab="my" title="마이" theme="dark" hideHeader>
      <div className="skeleton-page">
        {/* 프로필 카드 */}
        <SkeletonBox height={210} radius={16} />
        {/* 통계 카드 */}
        <SkeletonBox height={110} radius={14} />
        {/* 메뉴 리스트 5개 */}
        <SkeletonList rows={5} avatar={false} />
      </div>
    </AppShell>
  );
}
