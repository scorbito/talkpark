"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Lock } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { teams } from "@/lib/constants/teams";
import { completeOnboardingAction } from "@/lib/actions/onboarding";

type OnboardingFormProps = {
  error?: string;
  /** 서버에서 이미 부여된 디폴트 닉네임. 익명 가입 흐름이면 "불꽃홈런왕xxxxxx" 같은 값.
   *  사용자가 그대로 가거나 수정해서 갈 수 있음. */
  initialNickname?: string;
  initialTeamId?: string;
};

const errorMessages: Record<string, string> = {
  nickname: "닉네임은 2자 이상 입력해주세요.",
  team: "응원팀을 선택해주세요."
};

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="onboarding-submit" disabled={disabled || pending}>
      {pending ? (
        <>
          <span className="onboarding-submit-spinner" aria-hidden="true" />
          시작하는 중...
        </>
      ) : "다음"}
    </button>
  );
}

export function OnboardingForm({ error, initialNickname, initialTeamId }: OnboardingFormProps) {
  const [nickname, setNickname] = useState(initialNickname ?? "승요팬");
  const [mainTeamId, setMainTeamId] = useState(initialTeamId ?? "doosan");

  return (
    <form action={completeOnboardingAction} className="onboarding-card">
      <div className="onboarding-card-inner">
        <input name="mainTeamId" type="hidden" value={mainTeamId} />

        <h1 className="onboarding-title">내 직관 프로필을<br />설정해주세요</h1>

        <label className="onboarding-field">
          <span className="onboarding-field-label">닉네임</span>
          <div className="onboarding-input-wrap">
            <input
              aria-label="닉네임"
              maxLength={15}
              placeholder="닉네임 (최대 15자)"
              name="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
            <em>{nickname.length}/15</em>
          </div>
        </label>

        {error ? <p className="onboarding-error">{errorMessages[error] ?? error}</p> : null}

        <p className="onboarding-help">
          응원하는 팀을 선택하면 일정, 순위, 직관 기록이<br />모두 우리 팀 중심으로 보여요.
        </p>

        <div className="onboarding-team-grid">
          {teams.map((team) => {
            const selected = team.id === mainTeamId;
            return (
              <button
                className={`onboarding-team-choice ${selected ? "onboarding-team-choice-active" : ""}`}
                key={team.id}
                type="button"
                onClick={() => setMainTeamId(team.id)}
              >
                <TeamBadge teamId={team.id} size="md" />
                <strong>{team.shortName}</strong>
                {selected ? (
                  <span className="onboarding-team-check"><Check size={14} strokeWidth={3} /></span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="onboarding-footnote">
          <Lock size={12} /> 언제든지 마이페이지에서 변경할 수 있어요.
        </p>

        <SubmitButton disabled={nickname.trim().length < 2} />
      </div>
    </form>
  );
}
