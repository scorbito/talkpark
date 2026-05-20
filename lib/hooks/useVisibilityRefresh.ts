"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const MIN_HIDDEN_MS = 30_000; // 30초 이상 숨겨졌다 돌아왔을 때만 갱신 (너무 잦은 갱신 방지)

/** 사용자가 PWA/탭을 다시 활성화할 때 자동으로 router.refresh().
 *  - 카톡 보다가 돌아오기, 다른 앱 사용 후 복귀 등에서 최신 데이터 노출.
 *  - 30초 미만으로 짧게 벗어났다 돌아온 경우는 갱신 X (서버 부담 방지). */
export function useVisibilityRefresh() {
  const router = useRouter();
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState === "visible" && hiddenAtRef.current !== null) {
        const elapsed = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (elapsed >= MIN_HIDDEN_MS) {
          router.refresh();
        }
      }
    };

    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [router]);
}
