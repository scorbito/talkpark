"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Link2, Share2, Sparkles } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { UserProfile } from "@/lib/types/domain";
import { shareTemplates, type ShareTemplate } from "./modalHelpers";

type ShareCardModalProps = {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
};

export function ShareCardModal({ open, onClose, profile }: ShareCardModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ShareTemplate>(shareTemplates[0]);
  const [shareStatus, setShareStatus] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  // 상태 메시지는 3.5초 후 자동 사라짐
  useEffect(() => {
    if (!shareStatus) return;
    const t = window.setTimeout(() => setShareStatus(""), 3500);
    return () => window.clearTimeout(t);
  }, [shareStatus]);

  // 모달이 닫히면 상태 메시지 초기화 — 다음 진입 시 깔끔하게 시작
  useEffect(() => {
    if (!open) setShareStatus("");
  }, [open]);

  const shareCard = async () => {
    if (!shareCardRef.current || isSharing) return;
    const team = getTeam(profile.mainTeamId);
    const text = `내 직관 승률 ${profile.winRate}\n${profile.wins}승 ${profile.losses}패 ${profile.draws}무 (${team.name} 응원)\n\n톡구장`;
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const filename = `oneul-seungyo-${profile.winRate.replace(".", "")}.png`;

    setIsSharing(true);
    setShareStatus("");

    try {
      // ============================================================
      // Canvas 2D API로 카드 직접 그리기.
      // html-to-image 등 DOM 캡처 방식은 모바일 사파리/PWA에서 외부 이미지가
      // 누락되는 문제가 있어 Canvas로 픽셀 단위 직접 렌더링. 100% 호환.
      // ============================================================
      const CARD_W = 540;
      const CARD_H = 960;
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context 생성 실패");

      // 1) 폰트 로딩 대기
      if (typeof document !== "undefined" && "fonts" in document) {
        try {
          await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
        } catch {
          /* ignore */
        }
      }

      // 2) 배경 이미지 로드 & 그리기 (cover 방식 — 카드를 꽉 채움)
      const bgImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("배경 이미지 로드 실패"));
        img.src = selectedTemplate.src;
      });
      // object-fit: cover 흉내
      const imgRatio = bgImage.naturalWidth / bgImage.naturalHeight;
      const cardRatio = CARD_W / CARD_H;
      let dw: number, dh: number, dx: number, dy: number;
      if (imgRatio > cardRatio) {
        dh = CARD_H;
        dw = CARD_H * imgRatio;
        dx = (CARD_W - dw) / 2;
        dy = 0;
      } else {
        dw = CARD_W;
        dh = CARD_W / imgRatio;
        dx = 0;
        dy = (CARD_H - dh) / 2;
      }
      // 둥근 모서리 클리핑
      const radius = 32;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(CARD_W - radius, 0);
      ctx.quadraticCurveTo(CARD_W, 0, CARD_W, radius);
      ctx.lineTo(CARD_W, CARD_H - radius);
      ctx.quadraticCurveTo(CARD_W, CARD_H, CARD_W - radius, CARD_H);
      ctx.lineTo(radius, CARD_H);
      ctx.quadraticCurveTo(0, CARD_H, 0, CARD_H - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(bgImage, dx, dy, dw, dh);

      // 3) 어두운 그라데이션 오버레이
      const gradient = ctx.createLinearGradient(0, 0, 0, CARD_H);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.22)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      // 4) 텍스트 렌더링 — 카드 가운데 묶음
      const fontStack = "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // "내 직관 승률" (라벨)
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = `700 22px ${fontStack}`;
      ctx.fillText("내 직관 승률", CARD_W / 2, 380);

      // ".667" (승률 — 크게)
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 104px ${fontStack}`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 4;
      ctx.fillText(profile.winRate, CARD_W / 2, 470);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // "6승 3패 0무"
      ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
      ctx.font = `700 22px ${fontStack}`;
      ctx.fillText(`${profile.wins}승 ${profile.losses}패 ${profile.draws}무`, CARD_W / 2, 555);

      // 팀 pill — 검정 반투명 라운드 박스 + 팀 색 원 + 팀명
      const team = getTeam(profile.mainTeamId);
      const pillTextFont = `700 22px ${fontStack}`;
      ctx.font = pillTextFont;
      const teamName = team.name;
      const teamNameWidth = ctx.measureText(teamName).width;
      const pillH = 56;
      const pillPadX = 24;
      const badgeSize = 36;
      const badgeGap = 12;
      const pillW = pillPadX + badgeSize + badgeGap + teamNameWidth + pillPadX;
      const pillX = (CARD_W - pillW) / 2;
      const pillY = 590;

      // pill 배경
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      const pillR = pillH / 2;
      ctx.moveTo(pillX + pillR, pillY);
      ctx.lineTo(pillX + pillW - pillR, pillY);
      ctx.arc(pillX + pillW - pillR, pillY + pillR, pillR, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(pillX + pillR, pillY + pillH);
      ctx.arc(pillX + pillR, pillY + pillR, pillR, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 팀 배지 원
      const badgeCx = pillX + pillPadX + badgeSize / 2;
      const badgeCy = pillY + pillH / 2;
      ctx.fillStyle = team.color;
      ctx.beginPath();
      ctx.arc(badgeCx, badgeCy, badgeSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // 팀 이니셜
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 20px ${fontStack}`;
      ctx.fillText(team.initial, badgeCx, badgeCy + 1);

      // 팀명 (pill 안 우측)
      ctx.fillStyle = "#ffffff";
      ctx.font = pillTextFont;
      ctx.textAlign = "left";
      ctx.fillText(teamName, badgeCx + badgeSize / 2 + badgeGap, badgeCy);
      ctx.textAlign = "center";

      // 5) "오늘은 승요 ⚾" — 카드 하단
      const brandY = CARD_H - 96;
      ctx.fillStyle = "#ff6a2b";
      ctx.font = `800 34px ${fontStack}`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      const brandText = "톡구장";
      const brandTextWidth = ctx.measureText(brandText).width;
      const ballSize = 38;
      const brandGap = 10;
      const totalBrandW = brandTextWidth + brandGap + ballSize;
      const brandStartX = (CARD_W - totalBrandW) / 2;
      ctx.textAlign = "left";
      ctx.fillText(brandText, brandStartX, brandY);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.textAlign = "center";

      // 야구공 SVG를 Canvas로 — 흰 원 + 빨간 곡선 2개
      const ballCx = brandStartX + brandTextWidth + brandGap + ballSize / 2;
      const ballCy = brandY;
      const ballR = ballSize / 2;
      // 흰 공
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#1a2640";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ballCx, ballCy, ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 빨간 곡선
      ctx.strokeStyle = "#ff2a2a";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      // 좌측 곡선
      ctx.beginPath();
      const sx = ballCx - ballR * 0.58;
      const sy = ballCy - ballR * 0.5;
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(ballCx - ballR * 0.25, ballCy, ballCx - ballR * 0.5, ballCy + ballR * 0.5);
      ctx.stroke();
      // 우측 곡선
      ctx.beginPath();
      const sx2 = ballCx + ballR * 0.58;
      ctx.moveTo(sx2, sy);
      ctx.quadraticCurveTo(ballCx + ballR * 0.25, ballCy, ballCx + ballR * 0.5, ballCy + ballR * 0.5);
      ctx.stroke();

      ctx.restore();

      // 6) Canvas → Blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });
      if (!blob) throw new Error("이미지 변환 실패");
      const file = new File([blob], filename, { type: "image/png" });

      const isMobileShare =
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

      // 5) 1순위: 이미지 포함 Web Share
      if (isMobileShare && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "톡구장",
            text: `${text}\n${url}`
          });
          setShareStatus("공유했어요!");
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") {
            setIsSharing(false);
            return;
          }
          // share 실패 시 다운로드 폴백으로 흘러감
        }
      }

      // 6) 2순위: 다운로드 + 텍스트 클립보드
      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objUrl);

      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareStatus("이미지를 저장했고 텍스트는 클립보드에 복사됐어요.");
      } catch {
        setShareStatus("이미지를 저장했어요.");
      }
    } catch (err) {
      console.error("share failed:", err);
      setShareStatus("이미지 생성에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsSharing(false);
    }
  };

  const copyLink = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("링크가 복사됐어요!");
    } catch {
      setShareStatus("복사에 실패했어요.");
    }
  };

  return (
    <ModalShell open={open} title="공유하기" onClose={onClose} panelClassName="share-modal-panel">
      <div className="share-modal-content">
        {/* 공유 카드 — 모든 스타일을 인라인으로. 부모 CSS 컨텍스트 의존성 0.
            html-to-image가 원본을 그대로 캡처해도 미리보기와 1:1 일치 보장. */}
        <div
          ref={shareCardRef}
          style={{
            position: "relative",
            width: 270,
            height: 480,
            margin: "0 auto",
            borderRadius: 16,
            overflow: "hidden",
            background: "#1a2640",
            flexShrink: 0,
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="공유 카드 배경"
            src={selectedTemplate.src}
            crossOrigin="anonymous"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              textAlign: "center",
              padding: "26px 18px",
              boxSizing: "border-box",
              background: "linear-gradient(180deg, rgba(0, 0, 0, 0.22) 0%, rgba(0, 0, 0, 0.55) 100%)"
            }}
          >
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(255, 255, 255, 0.85)", letterSpacing: "0.2px" }}>
              내 직관 승률
            </p>
            <strong style={{ margin: 0, fontSize: 52, fontWeight: 900, color: "#ffffff", lineHeight: 1, letterSpacing: "-0.05em", textShadow: "0 4px 18px rgba(0, 0, 0, 0.5)" }}>
              {profile.winRate}
            </strong>
            <span style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(255, 255, 255, 0.82)" }}>
              {profile.wins}승 {profile.losses}패 {profile.draws}무
            </span>
            <div style={{ margin: "4px 0 0" }}>
              <b
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px 4px 4px",
                  background: "rgba(0, 0, 0, 0.45)",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#ffffff",
                  fontStyle: "normal",
                  whiteSpace: "nowrap",
                  lineHeight: 1
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    overflow: "hidden",
                    borderRadius: "50%"
                  }}
                >
                  <span style={{ transform: "scale(0.72)", transformOrigin: "center", display: "inline-flex" }}>
                    <TeamBadge teamId={profile.mainTeamId} size="sm" />
                  </span>
                </span>
                {getTeam(profile.mainTeamId).name}
              </b>
            </div>
          </div>
          {/* "오늘은 승요" 브랜드 — 카드 하단 고정 */}
          <em
            style={{
              position: "absolute",
              bottom: 48,
              left: 0,
              right: 0,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              fontStyle: "normal",
              fontSize: 17,
              fontWeight: 800,
              color: "#ff6a2b",
              letterSpacing: "-0.2px",
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.4)"
            }}
          >
            톡구장
            <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block" }}>
              <circle cx="12" cy="12" r="10" fill="#ffffff" stroke="#1a2640" strokeWidth="0.5" />
              <path d="M5 6 Q9 9 9.5 12 Q10 15 5.5 18" stroke="#ff2a2a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <path d="M19 6 Q15 9 14.5 12 Q14 15 18.5 18" stroke="#ff2a2a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
          </em>
        </div>
        <div className="template-picker">
          {shareTemplates.map((template) => {
            const isActive = selectedTemplate.id === template.id;
            return (
              <button className={isActive ? "template-active" : ""} key={template.id} type="button" onClick={() => setSelectedTemplate(template)}>
                <span className="template-thumb">
                  <Image alt={template.label} height={76} src={template.src} width={48} />
                  {isActive ? <span className="template-check" aria-hidden="true">✓</span> : null}
                </span>
                <span>{template.label}</span>
              </button>
            );
          })}
        </div>
        <div className="share-actions">
          <button type="button" className="share-action-primary" disabled={isSharing} onClick={shareCard}>
            <Share2 size={18} />
            {isSharing ? "준비 중..." : "공유하기"}
          </button>
          <button type="button" className="share-action-secondary" onClick={copyLink}>
            <Link2 size={18} />
            링크 복사
          </button>
        </div>
        {shareStatus ? <p className="inline-success">{shareStatus}</p> : null}
        <p className="share-help">
          <span className="share-help-icon" aria-hidden="true"><Sparkles size={11} /></span>
          공유하면 더 많은 팬들과 기록을 나눌 수 있어요.
        </p>
      </div>
    </ModalShell>
  );
}
