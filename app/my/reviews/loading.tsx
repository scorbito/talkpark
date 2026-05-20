import { AppShell } from "@/components/layout/AppShell";
import { SkeletonBox, SkeletonLine } from "@/components/common/Skeleton";

export default function MyReviewsLoading() {
  return (
    <AppShell activeTab="my" title="내 후기 모음" theme="dark" backHref="/my">
      <div className="skeleton-page">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 14,
              background: "var(--hd-bg-card)",
              border: "1px solid var(--hd-border-soft)",
              borderRadius: 14
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SkeletonBox width={36} height={36} radius={18} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <SkeletonLine width="40%" height={11} />
                <SkeletonLine width="25%" height={9} />
              </div>
            </div>
            <SkeletonBox height={180} radius={12} />
            <SkeletonLine width="100%" height={11} />
            <SkeletonLine width="80%" height={11} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
