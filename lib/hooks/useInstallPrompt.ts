"use client";

import { useEffect, useState } from "react";

/** PWA 설치 관련 디바이스 감지 + 네이티브 prompt 캡처.
 *  - isStandalone: 이미 홈 화면 설치 / 풀스크린 모드면 true
 *  - isIOS: iPhone/iPad/iPod
 *  - isAndroid: Android 디바이스
 *  - canNativeInstall: Android Chrome 등에서 beforeinstallprompt 이벤트가 잡혀 즉시 설치 가능
 *  - promptInstall: 네이티브 다이얼로그 트리거 (Android only) */
export type InstallPromptState = {
  isStandalone: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  canNativeInstall: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent;
    // iPad는 iPadOS 13+부터 사파리가 desktop UA로 위장 (iPad 문자열 없음).
    // navigator.platform === "MacIntel" + maxTouchPoints > 1로 별도 감지.
    const isIPadOS =
      window.navigator.platform === "MacIntel" &&
      typeof window.navigator.maxTouchPoints === "number" &&
      window.navigator.maxTouchPoints > 1;
    setIsIOS(/iPhone|iPad|iPod/.test(ua) || isIPadOS);
    setIsAndroid(/Android/.test(ua));

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari 비표준 속성
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // 설치 완료되면 deferredPrompt 비움 + standalone 상태 갱신
    const installedHandler = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  };

  return {
    isStandalone,
    isIOS,
    isAndroid,
    canNativeInstall: deferredPrompt !== null,
    promptInstall
  };
}
