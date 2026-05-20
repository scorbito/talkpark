"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lock, Smartphone, Trophy, X } from "lucide-react";
import { Button } from "@/components/common/Button";
import { signInAnonymouslyAction } from "@/lib/actions/auth";

// 랜딩 페이지는 사용자별 데이터 없음 — 항상 같은 모습. CDN 캐싱 가능.
// (Note: 클라이언트 컴포넌트는 정적 렌더링되므로 force-static 효과는 자동)

export default function LandingPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleStart = () => {
    startTransition(() => signInAnonymouslyAction());
  };

  return (
    <main className="landing-page">
      <Image
        alt="해질녘 야구장"
        className="landing-bg"
        fill
        priority
        src="/assets/stadium-hero-vertical.png"
      />
      <div className="landing-shade" />
      <section className="landing-copy">
        <div className="landing-mark">
          <Trophy size={18} />
          톡구장
        </div>
        <h1>내 직관 승률을 기록하고 공유하세요!</h1>
        <p>야구팬을 위한 톡구장앱, 직관 기록 & 커뮤니티</p>
        <div className="landing-actions">
          <Button onClick={() => setConfirmOpen(true)}>비로그인으로 시작하기</Button>
          <Link href="/login" prefetch>
            <Button variant="ghost">로그인하기</Button>
          </Link>
        </div>
      </section>

      {confirmOpen ? (
        <div className="landing-confirm-overlay" role="dialog" aria-modal="true">
          <div className="landing-confirm-panel">
            <button
              type="button"
              className="landing-confirm-close"
              aria-label="닫기"
              onClick={() => setConfirmOpen(false)}
            >
              <X size={18} />
            </button>

            <h2>비로그인으로 시작할까요?</h2>
            <p className="landing-confirm-lede">
              가입 없이 바로 체험할 수 있어요.<br />다만 아래 두 가지를 알려드려요.
            </p>

            <ul className="landing-confirm-list">
              <li>
                <span className="landing-confirm-icon"><Smartphone size={16} /></span>
                <div>
                  <strong>이 디바이스에서만 이용 가능</strong>
                  <span>다른 폰·PC에서는 같은 기록을 볼 수 없어요.</span>
                </div>
              </li>
              <li>
                <span className="landing-confirm-icon"><Lock size={16} /></span>
                <div>
                  <strong>친구 관리·일부 공개 범위 제한</strong>
                  <span>친구 추가, 후기 친구공개/나만보기는 정식 가입 후 사용 가능.</span>
                </div>
              </li>
            </ul>

            <p className="landing-confirm-note">
              나중에 카카오 / Google / 이메일로 <b>정식 계정 전환</b> 시
              <br />그동안 쌓은 직관·후기·사진은 <b>그대로 유지</b>됩니다.
            </p>

            <div className="landing-confirm-actions">
              <button
                type="button"
                className="landing-confirm-cancel"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="landing-confirm-start"
                disabled={pending}
                onClick={handleStart}
              >
                {pending ? "시작 중..." : "비로그인으로 시작"}
              </button>
            </div>

            <Link className="landing-confirm-altlink" href="/login" prefetch>
              또는 카카오·Google·이메일로 정식 가입 →
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
