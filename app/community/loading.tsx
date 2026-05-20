import { AppShell } from "@/components/layout/AppShell";
import { SkeletonBox, SkeletonLine } from "@/components/common/Skeleton";

export default function CommunityLoading() {
  return (
    <AppShell activeTab="community" title="커뮤니티" theme="dark" hideHeader>
      <div className="skeleton-page">
        {/* 필터 칩 */}
        <SkeletonBox height={36} radius={999} />
        {/* 후기 카드 3개 */}
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
                <SkeletonLine width="35%" height={11} />
                <SkeletonLine width="22%" height={9} />
              </div>
            </div>
            <SkeletonBox height={200} radius={12} />
            <SkeletonLine width="100%" height={11} />
            <SkeletonLine width="78%" height={11} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
