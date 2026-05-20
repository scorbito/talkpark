import { AppShell } from "@/components/layout/AppShell";
import { SkeletonBox, SkeletonLine } from "@/components/common/Skeleton";

export default function AttendancesLoading() {
  return (
    <AppShell activeTab="my" title="내 직관 리스트" theme="dark" backHref="/my">
      <div className="skeleton-page">
        {/* segmented control */}
        <SkeletonBox height={36} radius={10} />
        {/* 직관 카드 4개 */}
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBox key={i} height={120} radius={14} />
        ))}
      </div>
    </AppShell>
  );
}
