"use client";

import { useTransition } from "react";
import { signInWithOAuthAction } from "@/lib/actions/auth";

export function OAuthButtons() {
  const [pending, startTransition] = useTransition();

  const start = (provider: "google" | "kakao") => {
    startTransition(() => signInWithOAuthAction(provider));
  };

  return (
    <div className="oauth-buttons">
      <button
        className="oauth-button oauth-kakao"
        type="button"
        disabled={pending}
        onClick={() => start("kakao")}
      >
        <span className="oauth-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.86 5.36 4.66 6.79l-1.16 4.21c-.1.36.29.65.6.45L11.21 19c.26.02.53.03.79.03 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
          </svg>
        </span>
        카카오로 계속하기
      </button>
      <button
        className="oauth-button oauth-google"
        type="button"
        disabled={pending}
        onClick={() => start("google")}
      >
        <span className="oauth-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.61z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/>
          </svg>
        </span>
        Google로 계속하기
      </button>
    </div>
  );
}
