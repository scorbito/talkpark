import { SkeletonBox, SkeletonLine } from "@/components/common/Skeleton";

export default function LoginLoading() {
  return (
    <main className="app-backdrop">
      <section className="phone-frame phone-frame-dark login-frame" aria-label="로그인">
        <div className="app-scroll">
          <header className="app-header login-header">
            <span />
            <SkeletonLine width={88} height={16} />
            <span />
          </header>
          <div className="login-bg-area" aria-hidden="true" />
          <div className="login-content">
            {/* 마스코트 자리 */}
            <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 14px" }}>
              <SkeletonBox width={80} height={80} radius={40} />
            </div>
            {/* 타이틀 2줄 */}
            <SkeletonLine width="70%" height={18} style={{ margin: "0 auto 8px" }} />
            <SkeletonLine width="55%" height={18} style={{ margin: "0 auto 18px" }} />
            {/* OAuth 버튼 2개 */}
            <SkeletonBox height={48} radius={12} style={{ marginBottom: 10 }} />
            <SkeletonBox height={48} radius={12} style={{ marginBottom: 18 }} />
            {/* 이메일 폼 */}
            <SkeletonBox height={40} radius={10} style={{ marginBottom: 10 }} />
            <SkeletonBox height={40} radius={10} style={{ marginBottom: 14 }} />
            <SkeletonBox height={44} radius={12} />
          </div>
        </div>
      </section>
    </main>
  );
}
