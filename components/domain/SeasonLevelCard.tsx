"use client";

import { Info, Trophy, X } from "lucide-react";
import { useState } from "react";
import type { SeasonLevelState } from "@/lib/season-level/types";

type SeasonLevelCardProps = {
  state: SeasonLevelState;
};

export function SeasonLevelCard({ state }: SeasonLevelCardProps) {
  const progressPercent = Math.round(state.progress * 100);
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <article className="season-level-card" aria-label={`${state.season} 시즌 레벨`}>
      <header className="season-level-head">
        <span className="season-level-head-label">
          <Trophy size={13} />
          {state.season} 시즌
        </span>
        <button
          type="button"
          className="season-level-info-button"
          aria-label="경험치 획득 방법 보기"
          aria-expanded={infoOpen}
          onClick={() => setInfoOpen((current) => !current)}
        >
          <Info size={15} />
        </button>
      </header>

      {infoOpen ? (
        <div className="season-level-info-popover" role="dialog" aria-label="경험치 획득 방법">
          <div className="season-level-info-popover-head">
            <strong>경험치 획득 방법</strong>
            <button
              type="button"
              className="season-level-info-close"
              aria-label="경험치 획득 방법 닫기"
              onClick={() => setInfoOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
          <dl>
            <div>
              <dt>경기 결과 확인</dt>
              <dd>+30 XP</dd>
            </div>
            <div>
              <dt>티켓 인증</dt>
              <dd>+100 XP</dd>
            </div>
            <div>
              <dt>후기 작성</dt>
              <dd>+70 XP</dd>
            </div>
            <div>
              <dt>사진 포함 후기</dt>
              <dd>+20 XP</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="season-level-title-row">
        <span className="season-level-badge">Lv.{state.level}</span>
        <strong className="season-level-title">{state.title}</strong>
      </div>

      <div className="season-level-progress" aria-hidden="true">
        <div
          className="season-level-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="season-level-progress-meta">
        {state.isMax ? (
          <span className="season-level-progress-max">최고 레벨에 도달했어요</span>
        ) : (
          <>
            <span>
              {state.totalXp.toLocaleString()} / {state.nextLevelXp.toLocaleString()} XP
            </span>
            <span>다음 레벨까지 {state.xpToNextLevel.toLocaleString()} XP</span>
          </>
        )}
      </div>
    </article>
  );
}

export function SeasonLevelMiniChip({ state }: SeasonLevelCardProps) {
  return (
    <span
      className="season-level-mini-chip"
      aria-label={`현재 시즌 레벨 Lv.${state.level} ${state.title}`}
    >
      <span className="season-level-mini-badge">Lv.{state.level}</span>
      <span className="season-level-mini-title">{state.title}</span>
    </span>
  );
}
