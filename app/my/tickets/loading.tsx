import { AppShell } from "@/components/layout/AppShell";
import { SkeletonBox } from "@/components/common/Skeleton";

export default function TicketsLoading() {
  return (
    <AppShell activeTab="my" title="내 티켓 컬렉션" theme="dark" backHref="/my">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBox key={i} height={210} radius={12} />
        ))}
      </div>
    </AppShell>
  );
}
