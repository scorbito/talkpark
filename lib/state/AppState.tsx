"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Review, UserProfile } from "@/lib/types/domain";
import type { ProfileStats, UserProfileRecord } from "@/lib/types/api-contracts";
import { toggleReviewLikeAction, toggleReviewSaveAction } from "@/lib/actions/reviewReactions";
import { acknowledgeAttendanceResultAction } from "@/lib/actions/attendance";
import { loadMyReactionsAction, loadMyReviewsAction } from "@/lib/actions/initialData";
import { useVisibilityRefresh } from "@/lib/hooks/useVisibilityRefresh";

export type AttendanceRecord = {
  id: string;
  date: string;
  time?: string;
  stadium: string;
  homeTeamId: string;
  awayTeamId: string;
  supportTeamId?: string;
  score: string;
  result?: "win" | "lose" | "draw";
  verified: boolean;
  memo?: string;
  // 사용자가 결과 이펙트를 처음 확인한 ISO timestamp. null/undefined면 미확인 → 홈에서 "결과 보기" 버튼 노출.
  resultAcknowledgedAt?: string | null;
};

type RawAttendanceRecord = Omit<AttendanceRecord, "result"> & {
  result?: AttendanceRecord["result"] | string;
};

type Toast = {
  id: number;
  message: string;
};

type ProfileSettings = Pick<UserProfile, "nickname" | "mainTeamId" | "interestTeamIds" | "avatarUrl" | "bio">;

type AppState = {
  attendances: AttendanceRecord[];
  reviews: Review[];
  likedReviewIds: string[];
  savedReviewIds: string[];
  notificationsEnabled: boolean;
  publicScope: string;
  profile: UserProfile;
  isAnonymous: boolean;
  toast: Toast | null;
  addAttendance: (attendance: Omit<AttendanceRecord, "id"> & { id?: string }) => void;
  deleteAttendance: (id: string) => void;
  markAttendanceVerified: (id: string) => void;
  markAttendanceResult: (id: string, payload: { result: "win" | "lose" | "draw"; myScore: number; opponentScore: number; supportTeamId: string; homeTeamId: string }) => void;
  acknowledgeAttendanceResult: (id: string) => Promise<{ ok: boolean; reason?: string }>;
  updateProfile: (profile: Partial<ProfileSettings>) => void;
  addReview: (review: Omit<Review, "id" | "likes" | "comments" | "timeAgo">) => void;
  deleteReview: (id: string) => void;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setPublicScope: (scope: string) => void;
  showToast: (message: string) => void;
};

const AppStateContext = createContext<AppState | null>(null);

function inferAttendanceResult(attendance: Pick<AttendanceRecord, "awayTeamId" | "homeTeamId" | "score" | "supportTeamId">) {
  const [homeScore, awayScore] = attendance.score.split(":").map((value) => Number(value.trim()));

  if (Number.isNaN(homeScore) || Number.isNaN(awayScore) || homeScore === awayScore) {
    return homeScore === awayScore ? "draw" : undefined;
  }

  const supportTeamId = attendance.supportTeamId;

  if (supportTeamId === attendance.homeTeamId) {
    return homeScore > awayScore ? "win" : "lose";
  }

  if (supportTeamId === attendance.awayTeamId) {
    return awayScore > homeScore ? "win" : "lose";
  }

  return undefined;
}

function normalizeAttendance(attendance: RawAttendanceRecord): AttendanceRecord {
  const supportTeamId = attendance.supportTeamId ?? attendance.homeTeamId;
  const result = attendance.result === "win" || attendance.result === "lose" || attendance.result === "draw"
    ? attendance.result
    : undefined;

  return {
    ...attendance,
    supportTeamId,
    result: result ?? inferAttendanceResult({ ...attendance, supportTeamId })
  };
}

function createDbProfile(attendances: AttendanceRecord[], profileSettings: ProfileSettings, _stats: ProfileStats | null): UserProfile {
  // MVP는 등록된 모든 직관(인증 여부 무관)을 카운트.
  // profile_stats view는 verified=true만 세기 때문에 비인증 직관이 누락됨 → 로컬 계산이 정답.
  const wins = attendances.filter((a) => a.result === "win").length;
  const losses = attendances.filter((a) => a.result === "lose").length;
  const draws = attendances.filter((a) => a.result === "draw").length;
  const totalDecision = wins + losses;
  return {
    ...profileSettings,
    interestTeamIds: profileSettings.interestTeamIds,
    attendanceCount: attendances.length,
    wins,
    losses,
    draws,
    winRate: totalDecision > 0 ? `.${Math.round((wins / totalDecision) * 1000).toString().padStart(3, "0")}` : ".000"
  };
}

const emptyProfileSettings: ProfileSettings = {
  nickname: "",
  mainTeamId: "lg",
  interestTeamIds: [],
  avatarUrl: null,
  bio: null
};

type AppStateProviderProps = {
  children: ReactNode;
  initialProfile?: UserProfileRecord | null;
  initialStats?: ProfileStats | null;
  initialAttendances?: AttendanceRecord[];
  initialReviews?: Review[];
  initialIsAnonymous?: boolean;
  initialLikedReviewIds?: string[];
  initialSavedReviewIds?: string[];
};

export function AppStateProvider({ children, initialProfile, initialStats, initialAttendances, initialReviews, initialIsAnonymous = false, initialLikedReviewIds = [], initialSavedReviewIds = [] }: AppStateProviderProps) {
  // ─────────────────────────────────────────────
  // 1. useState — 모든 상태 선언을 맨 앞에 모아둠 (Rules of Hooks 준수, 가독성)
  // ─────────────────────────────────────────────
  const [attendances, setAttendances] = useState<AttendanceRecord[]>(
    (initialAttendances ?? []).map(normalizeAttendance)
  );
  const [reviews, setReviews] = useState<Review[]>(initialReviews ?? []);
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(
    initialProfile
      ? {
          nickname: initialProfile.nickname,
          mainTeamId: initialProfile.mainTeamId,
          interestTeamIds: initialProfile.interestTeamIds ?? [],
          avatarUrl: initialProfile.avatarImageUrl ?? null,
          bio: initialProfile.bio ?? null
        }
      : emptyProfileSettings
  );
  const [dbStats] = useState<ProfileStats | null>(initialStats ?? null);
  const [likedReviewIds, setLikedReviewIds] = useState<string[]>(initialLikedReviewIds);
  const [savedReviewIds, setSavedReviewIds] = useState<string[]>(initialSavedReviewIds);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    initialProfile?.notificationsEnabled ?? true
  );
  const [publicScope, setPublicScope] = useState(
    initialProfile?.defaultPublicScope === "friends" ? "친구 공개"
    : initialProfile?.defaultPublicScope === "private" ? "나만 보기"
    : "전체 공개"
  );
  const [toast, setToast] = useState<Toast | null>(null);

  // ─────────────────────────────────────────────
  // 2. 커스텀 hook (내부적으로 useEffect 등 사용)
  // ─────────────────────────────────────────────
  useVisibilityRefresh();

  // ─────────────────────────────────────────────
  // 3. useEffect — 모든 사이드 이펙트를 한 곳에 모음
  // ─────────────────────────────────────────────

  // SSR로 받은 initialProfile이 변경되면 (router.refresh 등) client state도 동기화
  useEffect(() => {
    if (!initialProfile) return;
    setProfileSettings({
      nickname: initialProfile.nickname,
      mainTeamId: initialProfile.mainTeamId,
      interestTeamIds: initialProfile.interestTeamIds ?? [],
      avatarUrl: initialProfile.avatarImageUrl ?? null,
      bio: initialProfile.bio ?? null
    });
  }, [initialProfile?.nickname, initialProfile?.mainTeamId, initialProfile?.avatarImageUrl, initialProfile?.bio]);

  // React 콘텐츠가 마운트되면 initial-loader 페이드아웃 신호.
  useEffect(() => {
    document.documentElement.setAttribute("data-loaded", "true");
  }, []);

  // reviews + reactions는 layout SSR에서 빠진 데이터 — 마운트 후 백그라운드 페치.
  useEffect(() => {
    let cancelled = false;
    void loadMyReviewsAction()
      .then((data) => {
        if (cancelled) return;
        setReviews(data);
      })
      .catch(() => {
        // 실패해도 사용자 체험은 그대로 — 빈 리스트 노출.
      });
    void loadMyReactionsAction()
      .then((data) => {
        if (cancelled) return;
        setLikedReviewIds(data.likedReviewIds);
        setSavedReviewIds(data.savedReviewIds);
      })
      .catch(() => {
        // 실패해도 좋아요/저장 상태 없이 진행.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // SSR 으로 받은 초기 reactions가 변경되면 (router.refresh) 동기화
  useEffect(() => {
    setLikedReviewIds(initialLikedReviewIds);
  }, [initialLikedReviewIds.join(",")]);
  useEffect(() => {
    setSavedReviewIds(initialSavedReviewIds);
  }, [initialSavedReviewIds.join(",")]);

  // ─────────────────────────────────────────────
  // 4. 일반 변수 / 핸들러 (hook 아님)
  // ─────────────────────────────────────────────
  const isAuthed = Boolean(initialProfile);

  const showToast = (message: string) => {
    const id = Date.now();
    setToast({ id, message });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 2200);
  };

  const value = useMemo<AppState>(() => {
    const profile = createDbProfile(attendances, profileSettings, isAuthed ? dbStats : null);

    return {
      attendances,
      reviews,
      likedReviewIds,
      savedReviewIds,
      notificationsEnabled,
      publicScope,
      profile,
      isAnonymous: initialIsAnonymous,
      toast,
      addAttendance: (attendance) => {
        setAttendances((current) => [{ ...attendance, id: attendance.id ?? `att-${Date.now()}` }, ...current]);
        showToast("직관이 등록됐어요.");
      },
      deleteAttendance: (id) => {
        setAttendances((current) => current.filter((item) => item.id !== id));
        showToast("직관 기록을 삭제했어요.");
      },
      markAttendanceVerified: (id) => {
        setAttendances((current) =>
          current.map((item) => (item.id === id ? { ...item, verified: true } : item))
        );
      },
      markAttendanceResult: (id, payload) => {
        setAttendances((current) =>
          current.map((item) => {
            if (item.id !== id) return item;
            const supportIsHome = payload.supportTeamId === payload.homeTeamId;
            const homeScore = supportIsHome ? payload.myScore : payload.opponentScore;
            const awayScore = supportIsHome ? payload.opponentScore : payload.myScore;
            return {
              ...item,
              result: payload.result,
              score: `${homeScore} : ${awayScore}`
            };
          })
        );
      },
      acknowledgeAttendanceResult: async (id) => {
        // 이미 ack된 직관이면 클라이언트/서버 둘 다 건너뜀 (멱등 + 첫 ack 시점 보존).
        const target = attendances.find((item) => item.id === id);
        if (!target || target.resultAcknowledgedAt) return { ok: true };

        const optimisticTimestamp = new Date().toISOString();
        setAttendances((current) =>
          current.map((item) => (item.id === id ? { ...item, resultAcknowledgedAt: optimisticTimestamp } : item))
        );
        try {
          const res = await acknowledgeAttendanceResultAction(id);
          if (!res.ok) {
            // 실패 시 롤백 — 다음 진입 때 다시 결과 보기 버튼 노출
            setAttendances((current) =>
              current.map((item) => (item.id === id ? { ...item, resultAcknowledgedAt: undefined } : item))
            );
            // 사용자에게 토스트로 알리진 않음 — UX상 결과 모달은 이미 보여줬고 다음 기회에 또 볼 수 있음.
          }
          return res;
        } catch {
          setAttendances((current) =>
            current.map((item) => (item.id === id ? { ...item, resultAcknowledgedAt: undefined } : item))
          );
          return { ok: false, reason: "결과 확인 처리 중 오류가 발생했어요." };
        }
      },
      updateProfile: (nextProfile) => {
        setProfileSettings((current) => ({ ...current, ...nextProfile }));
        showToast("프로필을 저장했어요.");
      },
      addReview: (review) => {
        setReviews((current) => [
          {
            ...review,
            id: `review-${Date.now()}`,
            likes: 0,
            comments: 0,
            timeAgo: "방금 전"
          },
          ...current
        ]);
        showToast("후기가 등록됐어요.");
      },
      deleteReview: (id) => {
        setReviews((current) => current.filter((item) => item.id !== id));
        showToast("후기를 삭제했어요.");
      },
      toggleLike: (id) => {
        // 낙관적 업데이트 → server action → 실패 시 롤백
        const wasLiked = likedReviewIds.includes(id);
        setLikedReviewIds((current) => wasLiked ? current.filter((item) => item !== id) : [...current, id]);
        // 카운트 ±1 도 같이 (review.likes 는 props 라 setReviews 로 갱신)
        setReviews((current) =>
          current.map((review) =>
            review.id === id ? { ...review, likes: Math.max(0, review.likes + (wasLiked ? -1 : 1)) } : review
          )
        );
        toggleReviewLikeAction(id).catch((err) => {
          // 롤백
          setLikedReviewIds((current) => wasLiked ? [...current, id] : current.filter((item) => item !== id));
          setReviews((current) =>
            current.map((review) =>
              review.id === id ? { ...review, likes: Math.max(0, review.likes + (wasLiked ? 1 : -1)) } : review
            )
          );
          showToast(err instanceof Error ? err.message : "좋아요 처리에 실패했어요.");
        });
      },
      toggleSave: (id) => {
        const wasSaved = savedReviewIds.includes(id);
        setSavedReviewIds((current) => wasSaved ? current.filter((item) => item !== id) : [...current, id]);
        toggleReviewSaveAction(id).catch((err) => {
          setSavedReviewIds((current) => wasSaved ? [...current, id] : current.filter((item) => item !== id));
          showToast(err instanceof Error ? err.message : "저장 처리에 실패했어요.");
        });
      },
      setNotificationsEnabled: (enabled) => {
        setNotificationsEnabled(enabled);
        showToast(enabled ? "알림을 켰어요." : "알림을 껐어요.");
      },
      setPublicScope: (scope) => {
        setPublicScope(scope);
        showToast(`${scope}로 변경했어요.`);
      },
      showToast
    };
  }, [attendances, dbStats, isAuthed, initialIsAnonymous, likedReviewIds, notificationsEnabled, profileSettings, publicScope, reviews, savedReviewIds, toast]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
      {toast ? <div className="toast-message">{toast.message}</div> : null}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
