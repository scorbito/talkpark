"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Trophy, X, PenSquare } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";

type ConfettiPiece = {
  left: number;
  topOffset: number;
  delay: number;
  duration: number;
  rotateEnd: number;
  width: number;
  height: number;
  color: number;
  drift: number;
  shape: "rect" | "circle";
};

function generateConfetti(seed: string, count = 80): ConfettiPiece[] {
  // 시드 기반의 빠른 의사난수 (mulberry32) — 같은 결과면 동일 분포라도 시각적 다양성 충분
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  const rand = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return Array.from({ length: count }, () => ({
    left: rand() * 100,
    topOffset: -10 - rand() * 30, // -10 ~ -40vh 시작
    delay: rand() * 4,             // 0~4s 분산 — 일정 안에 와르르 떨어지지 않음
    duration: 2.8 + rand() * 3.2,  // 2.8~6s
    rotateEnd: (rand() - 0.5) * 2160, // -1080 ~ +1080도
    width: 5 + rand() * 8,         // 5~13px
    height: 8 + rand() * 12,       // 8~20px
    color: Math.floor(rand() * 5),
    drift: (rand() - 0.5) * 240,   // -120 ~ +120px 좌우 흔들림
    shape: rand() > 0.7 ? "circle" : "rect"
  }));
}

export type AttendanceResultPayload = {
  attendanceId: string;
  result: "win" | "lose" | "draw";
  myScore: number;
  opponentScore: number;
  myTeamId: string;
  opponentTeamId: string;
  gameDate: string;
  stadium: string;
};

type Props = {
  payload: AttendanceResultPayload | null;
  onClose: () => void;
  onWriteReview?: (attendanceId: string) => void;
};

const COPY: Record<"win" | "lose" | "draw", { headline: string; sub: string; emoji: string; mascot: string; mascotAlt: string }> = {
  win: {
    headline: "직관 승리 축하합니다!",
    sub: "오늘 경기장에서 응원한 보람이 있네요 🎉",
    emoji: "🎉",
    mascot: "/assets/mascot-cheer.png",
    mascotAlt: "응원하는 마스코트"
  },
  lose: {
    headline: "아쉬운 한 판이었어요",
    sub: "현장의 응원은 진심이었어요. 다음엔 꼭 승요!",
    emoji: "😢",
    mascot: "/assets/mascot-default.png",
    mascotAlt: "위로하는 마스코트"
  },
  draw: {
    headline: "치열한 한 판이었어요",
    sub: "비록 승부는 못 봤지만, 경기 자체가 멋졌어요 ⚾",
    emoji: "⚾",
    mascot: "/assets/mascot-bat.png",
    mascotAlt: "방망이 든 마스코트"
  }
};

export function AttendanceResultModal({ payload, onClose, onWriteReview }: Props) {
  // 모달이 열릴 때마다 같은 attendance에 대해선 동일한 분포 (시드 = id)
  const confetti = useMemo(
    () => (payload?.result === "win" ? generateConfetti(payload.attendanceId, 80) : []),
    [payload?.attendanceId, payload?.result]
  );

  if (!payload) return null;
  const copy = COPY[payload.result];
  const myTeam = getTeam(payload.myTeamId);
  const opponentTeam = getTeam(payload.opponentTeamId);

  return (
    <div className={`result-modal result-modal-${payload.result}`} role="dialog" aria-modal="true" aria-label="직관 결과">
      <button type="button" className="result-modal-close" onClick={onClose} aria-label="닫기">
        <X size={20} />
      </button>

      {payload.result === "win" ? (
        <div className="result-confetti" aria-hidden="true">
          {confetti.map((p, i) => (
            <span
              key={i}
              className={`confetti-piece confetti-piece-${p.color}${p.shape === "circle" ? " confetti-piece-circle" : ""}`}
              style={{
                left: `${p.left}%`,
                width: `${p.width}px`,
                height: `${p.height}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                ["--confetti-rotate" as string]: `${p.rotateEnd}deg`,
                ["--confetti-drift" as string]: `${p.drift}px`,
                ["--confetti-top" as string]: `${p.topOffset}vh`
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="result-modal-body">
        <div className="result-mascot-wrap">
          <Image src={copy.mascot} alt={copy.mascotAlt} width={210} height={210} priority />
        </div>

        <div className="result-emoji-row" aria-hidden="true">
          <span>{copy.emoji}</span>
        </div>

        <h1 className="result-headline">{copy.headline}</h1>
        <p className="result-sub">{copy.sub}</p>

        <div className="result-score-board">
          <div className="result-team-side result-team-mine">
            <TeamBadge teamId={payload.myTeamId} size="md" />
            <strong>{myTeam.shortName}</strong>
            <em>{payload.myScore}</em>
          </div>
          <span className="result-vs">VS</span>
          <div className="result-team-side">
            <TeamBadge teamId={payload.opponentTeamId} size="md" />
            <strong>{opponentTeam.shortName}</strong>
            <em>{payload.opponentScore}</em>
          </div>
        </div>

        {payload.result === "win" ? (
          <div className="result-trophy" aria-hidden="true">
            <Trophy size={20} /> 직관 승리 1번 추가!
          </div>
        ) : null}

        <div className="result-actions">
          <button
            type="button"
            className="result-action-secondary"
            onClick={() => onWriteReview?.(payload.attendanceId)}
          >
            <PenSquare size={15} /> 후기 작성하기
          </button>
          <button type="button" className="result-action-primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
