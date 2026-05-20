import type { CSSProperties } from "react";

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

/** 텍스트 한 줄 모양 placeholder. height 기본 12px. */
export function SkeletonLine({ width = "100%", height = 12, radius = 6, className = "", style }: {
  width?: number | string;
  height?: number | string;
  radius?: number;
} & SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${className}`}
      style={{ display: "block", width, height, borderRadius: radius, ...style }}
    />
  );
}

/** 원형 placeholder (아바타/아이콘). */
export function SkeletonCircle({ size = 40, className = "", style }: { size?: number | string } & SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${className}`}
      style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", ...style }}
    />
  );
}

/** 카드/이미지 모양 박스 placeholder. */
export function SkeletonBox({ width = "100%", height = 120, radius = 14, className = "", style }: {
  width?: number | string;
  height?: number | string;
  radius?: number;
} & SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${className}`}
      style={{ display: "block", width, height, borderRadius: radius, ...style }}
    />
  );
}

/** 자주 쓰는 행 패턴 — 원 + 두 줄 (메뉴, 친구 행 등). */
export function SkeletonRow({ avatar = true }: { avatar?: boolean }) {
  return (
    <div className="skeleton-row">
      {avatar ? <SkeletonCircle size={36} /> : null}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <SkeletonLine width="60%" height={11} />
        <SkeletonLine width="40%" height={9} />
      </div>
    </div>
  );
}

/** 리스트형 — N개의 SkeletonRow. */
export function SkeletonList({ rows = 5, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} avatar={avatar} />
      ))}
    </div>
  );
}
