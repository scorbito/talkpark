"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserCheck, UserPlus } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import {
  getPublicProfileAction,
  type PublicProfilePayload,
  type PublicProfileRelationship
} from "@/lib/actions/publicProfile";
import {
  respondFriendRequestAction,
  sendFriendRequestAction
} from "@/lib/actions/friends";

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  /** 모달이 표시할 대상 사용자 id. null이면 모달은 표시되지 않는다. */
  targetUserId: string | null;
};

/**
 * 작성자(닉네임/사진) 탭 시 열리는 가벼운 프로필 모달.
 * - 본인을 눌러도 같은 모달이 열린다(`self` 상태).
 * - 시즌 레벨 영역은 Step 0에서는 placeholder. Step 10에서 실데이터 연결.
 * - 친구 액션은 기존 `lib/actions/friends.ts`를 재사용.
 */
export function ProfileModal({ open, onClose, targetUserId }: ProfileModalProps) {
  const router = useRouter();
  const { showToast, isAnonymous } = useAppState();
  const [data, setData] = useState<PublicProfilePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !targetUserId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPublicProfileAction(targetUserId)
      .then((payload) => {
        if (cancelled) return;
        if (!payload) {
          setError("프로필을 찾을 수 없어요.");
        } else {
          setData(payload);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "프로필을 불러오지 못했어요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, targetUserId]);

  const handleSendRequest = () => {
    if (!data) return;
    if (isAnonymous) {
      showToast("정식 계정으로 전환하면 사용할 수 있어요.");
      return;
    }
    startTransition(async () => {
      try {
        await sendFriendRequestAction(data.userId);
        setData({ ...data, relationship: "requested" });
        showToast("친구 신청을 보냈어요.");
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "친구 신청에 실패했어요.");
      }
    });
  };

  const handleRespondRequest = (status: "accepted" | "rejected") => {
    if (!data || !data.incomingRequestId) return;
    startTransition(async () => {
      try {
        await respondFriendRequestAction(data.incomingRequestId!, status);
        const next: PublicProfileRelationship = status === "accepted" ? "friend" : "none";
        setData({ ...data, relationship: next, incomingRequestId: null });
        showToast(status === "accepted" ? "친구 요청을 수락했어요." : "친구 요청을 거절했어요.");
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "처리에 실패했어요.");
      }
    });
  };

  return (
    <ModalShell
      open={open}
      title="프로필"
      onClose={onClose}
      panelClassName="profile-popover-panel"
      closeOnBackdrop
    >
      {loading ? (
        <div className="profile-popover-state">불러오는 중...</div>
      ) : error ? (
        <div className="profile-popover-state profile-popover-error">{error}</div>
      ) : data ? (
        <div className="profile-popover-stack">
          {/* 헤더: 사진 + 닉네임 + 팀 배지 */}
          <div className="profile-popover-header">
            <div className="profile-popover-avatar">
              {data.avatarUrl ? (
                <Image alt={data.nickname} src={data.avatarUrl} fill sizes="64px" style={{ objectFit: "cover" }} />
              ) : (
                <span className="profile-popover-avatar-fallback">{data.nickname.slice(0, 1)}</span>
              )}
            </div>
            <div className="profile-popover-headline">
              <strong className="profile-popover-name">{data.nickname}</strong>
              <span className="profile-popover-team">
                <TeamBadge teamId={data.mainTeamId} size="sm" />
                <span>{getTeam(data.mainTeamId).shortName}</span>
                {data.seasonLevel ? (
                  <>
                    <span className="profile-popover-team-separator" aria-hidden="true">·</span>
                    <span className="profile-popover-level-inline">
                      <span className="profile-popover-level-badge">Lv.{data.seasonLevel.level}</span>
                      <span className="profile-popover-level-title">{data.seasonLevel.title}</span>
                    </span>
                  </>
                ) : null}
              </span>
            </div>
          </div>

          {/* 자기소개 */}
          <p className={`profile-popover-bio ${data.bio ? "" : "profile-popover-bio-empty"}`}>
            {data.bio ?? "아직 소개가 없어요"}
          </p>

          {/* 시즌 활동 지표 */}
          <div className="profile-popover-stats">
            <div className="profile-popover-stat">
              <span className="profile-popover-stat-label">직관</span>
              <span className="profile-popover-stat-value">{data.seasonStats.attended}</span>
            </div>
            <div className="profile-popover-stat">
              <span className="profile-popover-stat-label">승률</span>
              <span className="profile-popover-stat-value">{data.seasonStats.winRate}</span>
            </div>
            <div className="profile-popover-stat">
              <span className="profile-popover-stat-label">후기</span>
              <span className="profile-popover-stat-value">{data.seasonStats.reviewCount}</span>
            </div>
          </div>

          {/* 친구 액션 */}
          <div className="profile-popover-actions">
            {data.relationship === "self" ? (
              <span className="profile-popover-action-label">내 프로필이에요</span>
            ) : data.relationship === "friend" ? (
              <span className="profile-popover-friend-badge">
                <UserCheck size={14} /> 친구
              </span>
            ) : data.relationship === "requested" ? (
              <span className="profile-popover-pending">신청됨</span>
            ) : data.relationship === "incoming" ? (
              <div className="profile-popover-respond">
                <button
                  type="button"
                  className="profile-popover-respond-accept"
                  disabled={pending}
                  onClick={() => handleRespondRequest("accepted")}
                >
                  수락
                </button>
                <button
                  type="button"
                  className="profile-popover-respond-reject"
                  disabled={pending}
                  onClick={() => handleRespondRequest("rejected")}
                >
                  거절
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="profile-popover-add-friend"
                disabled={pending}
                onClick={handleSendRequest}
              >
                <UserPlus size={14} /> 친구 신청
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="profile-popover-state">표시할 정보가 없어요.</div>
      )}
    </ModalShell>
  );
}

/** 작성자(닉네임/사진) 클릭으로 모달을 열기 위한 공통 헬퍼 hook 대신 단순 state로 가져가는 경우의 타입. */
export type ProfileModalControls = {
  openProfile: (userId: string) => void;
  modalProps: ProfileModalProps;
};

/** 호출자 측에서 한 줄로 ProfileModal 상태를 관리할 수 있게 해주는 hook. */
export function useProfileModal(): ProfileModalControls {
  const [target, setTarget] = useState<string | null>(null);
  return {
    openProfile: (userId: string) => setTarget(userId),
    modalProps: {
      open: target !== null,
      onClose: () => setTarget(null),
      targetUserId: target
    }
  };
}
