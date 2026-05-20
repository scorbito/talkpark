"use client";

import { useState } from "react";
import { CalendarCheck, Camera, Download, MessageSquareText, Users } from "lucide-react";
import { Button } from "@/components/common/Button";
import { ModalShell } from "@/components/common/ModalShell";

type AppGuideModalProps = {
  open: boolean;
  onClose: () => void;
};

const steps = [
  {
    title: "직관을 기록해요",
    body: [
      "다녀온 경기나 앞으로 갈 경기를 직관으로 등록할 수 있어요.",
      "시즌 중이라 이전 경기 직관도 기록할 수 있습니다."
    ],
    icon: CalendarCheck
  },
  {
    title: "티켓으로 인증해요",
    body: [
      "티켓 사진으로 등록하면 직관이 인증돼요.",
      "인증된 티켓은 티켓 컬렉션에 디지털로 보관됩니다."
    ],
    icon: Camera
  },
  {
    title: "경기 종료 후 후기를 남겨요",
    body: [
      "경기가 끝나면 승/패/무가 내 직관 승률에 반영돼요.",
      "후기는 종료된 직관마다 1개씩 작성할 수 있어요."
    ],
    icon: MessageSquareText
  },
  {
    title: "친구와 공유해요",
    body: [
      "공개 범위를 정해 친구들과 후기를 나눌 수 있어요.",
      "사용법은 홈 상단의 ? 아이콘에서 다시 볼 수 있습니다."
    ],
    icon: Users
  },
  {
    title: "홈 화면에 추가해 보세요",
    body: [
      "iPhone Safari나 Android Chrome에서 홈 화면에 추가하면 앱처럼 풀스크린으로 사용할 수 있어요.",
      "마이 페이지의 \"앱으로 설치\" 메뉴에서 안내를 확인하세요."
    ],
    icon: Download
  }
];

export function AppGuideModal({ open, onClose }: AppGuideModalProps) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  const close = () => {
    setIndex(0);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      title="사용법 안내"
      onClose={close}
      panelClassName="guide-modal-panel"
      backdropClassName="guide-modal-backdrop"
    >
      <div className="guide-modal-content">
        <div className="guide-step-indicator">{index + 1}/{steps.length}</div>
        <div className="guide-icon" aria-hidden="true">
          <Icon size={28} />
        </div>
        <h2>{step.title}</h2>
        <p>
          {step.body.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
        <div className="guide-dots" aria-hidden="true">
          {steps.map((_, dotIndex) => (
            <span key={dotIndex} className={dotIndex === index ? "guide-dot guide-dot-active" : "guide-dot"} />
          ))}
        </div>
        <div className="guide-actions">
          <button type="button" className="guide-skip" onClick={close}>
            {isLast ? "닫기" : "건너뛰기"}
          </button>
          <Button onClick={() => (isLast ? close() : setIndex((current) => current + 1))}>
            {isLast ? "시작하기" : "다음"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
