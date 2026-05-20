import { SkeletonBox, SkeletonLine } from "@/components/common/Skeleton";

export default function OnboardingLoading() {
  return (
    <main className="app-backdrop">
      <section className="phone-frame phone-frame-dark onboarding-frame" aria-label="온보딩">
        <div className="app-scroll">
          <div className="onboarding-bg-area" aria-hidden="true" />
          <div style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* 타이틀 */}
            <SkeletonLine width="60%" height={22} />
            <SkeletonLine width="80%" height={14} />
            {/* 닉네임 입력 */}
            <SkeletonBox height={44} radius={10} style={{ marginTop: 10 }} />
            {/* 팀 그리드 (5x2) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonBox key={i} height={56} radius={10} />
              ))}
            </div>
            {/* 시작 버튼 */}
            <SkeletonBox height={48} radius={12} style={{ marginTop: 12 }} />
          </div>
        </div>
      </section>
    </main>
  );
}
