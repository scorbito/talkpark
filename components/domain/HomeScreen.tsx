"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleHelp, Flag, Megaphone, Plus, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { AppModals, type ModalKind } from "@/components/domain/AppModals";
import { AppGuideModal } from "@/components/domain/AppGuideModal";
import { AttendanceResultModal, type AttendanceResultPayload } from "@/components/domain/AttendanceResultModal";
import { SeasonLevelMiniChip } from "@/components/domain/SeasonLevelCard";
import type { SeasonLevelState } from "@/lib/season-level/types";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { finalizeAttendanceAction } from "@/lib/actions/attendance";
import type { Game, TeamStanding } from "@/lib/types/domain";

const WEEK_LABELS_SUN = ["일", "월", "화", "수", "목", "금", "토"];
const WEEK_LABELS_MON = ["월", "화", "수", "목", "금", "토", "일"];
const RESULT_PAYLOAD_STORAGE_KEY = "oneul-seungyo.pendingResultPayload";
const GUIDE_SEEN_STORAGE_KEY = "oneul-seungyo.guideSeen";

function todayDotDate(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function parseDotDate(date: string) {
  const [year, month, day] = date.split(".").map(Number);
  return new Date(year, month - 1, day);
}

/** att.date(YYYY.MM.DD) + att.time(HH:MM[:SS]) 을 KST 기준 시작 시각으로 변환.
 *  time이 없으면 18:30 기본값. now >= 시작 시각 이면 true. */
function hasGameStarted(date: string, time?: string): boolean {
  const [yy, mm, dd] = date.split(".").map(Number);
  const [hh, mi] = (time ?? "18:30").split(":").map(Number);
  const start = new Date(yy, mm - 1, dd, hh || 18, mi || 30);
  return new Date().getTime() >= start.getTime();
}

/** 종료된 직관 데이터에서 결과 모달 payload 구성. score는 "home : away" 포맷. */
function buildResultPayload(att: {
  id: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  supportTeamId?: string;
  score: string;
  result?: "win" | "lose" | "draw";
  stadium: string;
}) {
  if (!att.result || !att.score.includes(":")) return null;
  const [homeScoreStr, awayScoreStr] = att.score.split(":").map((s) => s.trim());
  const homeScore = Number(homeScoreStr);
  const awayScore = Number(awayScoreStr);
  if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return null;

  const supportTeamId = att.supportTeamId ?? att.homeTeamId;
  const supportIsHome = supportTeamId === att.homeTeamId;
  const myScore = supportIsHome ? homeScore : awayScore;
  const opponentScore = supportIsHome ? awayScore : homeScore;
  const opponentTeamId = supportIsHome ? att.awayTeamId : att.homeTeamId;

  const isoDate = att.date.replaceAll(".", "-");
  return {
    attendanceId: att.id,
    result: att.result,
    myScore,
    opponentScore,
    myTeamId: supportTeamId,
    opponentTeamId,
    gameDate: isoDate,
    stadium: att.stadium
  };
}

function getDday(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = parseDotDate(date);
  const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "D-Day";
  return diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;
}

function formatDateWithDay(date: string) {
  const dateObj = parseDotDate(date);
  return `${date} (${WEEK_LABELS_SUN[dateObj.getDay()]})`;
}

function formatMonthDay(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function getGameResult(game: Game, mainTeamId: string): "win" | "lose" | "draw" | null {
  if (game.status !== "finished" || game.homeScore == null || game.awayScore == null) return null;
  const myScore = game.homeTeamId === mainTeamId ? game.homeScore : game.awayScore;
  const opponentScore = game.homeTeamId === mainTeamId ? game.awayScore : game.homeScore;
  if (myScore === opponentScore) return "draw";
  return myScore > opponentScore ? "win" : "lose";
}

type HomeScreenProps = {
  standings?: TeamStanding[];
  weekGames?: Game[];
  weekStart?: string;
  latestNoticeAt?: string | null;
  /** 경기톡 글 개수 (game_id → count). 홈 카드 뱃지에 사용. */
  matchPostCounts?: Record<string, number>;
  /** 현재 사용자의 시즌 레벨 — 비로그인 / XP 없음 시 null */
  seasonLevel?: SeasonLevelState | null;
};

export function HomeScreen({ weekGames = [], weekStart, latestNoticeAt = null, matchPostCounts = {}, seasonLevel = null }: HomeScreenProps) {
  const { attendances, profile, showToast, markAttendanceResult, acknowledgeAttendanceResult } = useAppState();
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const [reviewTargetId, setReviewTargetId] = useState<string | undefined>(undefined);
  const [nextIndex, setNextIndex] = useState(0);
  const [nextDir, setNextDir] = useState<"next" | "prev">("next");
  const [hasUnreadNotice, setHasUnreadNotice] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [resultPayload, setResultPayload] = useState<AttendanceResultPayload | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [, startFinalize] = useTransition();
  const resultOpenTimerRef = useRef<number | null>(null);

  const clearResultOpenTimer = () => {
    if (resultOpenTimerRef.current === null) return;
    window.clearTimeout(resultOpenTimerRef.current);
    resultOpenTimerRef.current = null;
  };

  const openResultModal = (payload: AttendanceResultPayload, options: { persist?: boolean; delayMs?: number } = {}) => {
    clearResultOpenTimer();

    if (options.persist) {
      try {
        window.sessionStorage.setItem(RESULT_PAYLOAD_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // sessionStorage가 막힌 환경에서는 현재 화면 상태만 사용.
      }
    }

    const applyPayload = () => {
      // 가드 제거 — 같은 attendance 다시 클릭해도 모달 다시 열기.
      // 이전엔 current?.attendanceId === payload.attendanceId 면 set 안 했는데,
      // 그러면 X로 닫은 후 다시 클릭 시 모달이 안 열리는 케이스가 있음.
      setResultPayload(payload);
      resultOpenTimerRef.current = null;
    };

    if (options.delayMs && options.delayMs > 0) {
      resultOpenTimerRef.current = window.setTimeout(applyPayload, options.delayMs);
      return;
    }

    applyPayload();
  };

  const closeResultModal = () => {
    clearResultOpenTimer();
    try {
      window.sessionStorage.removeItem(RESULT_PAYLOAD_STORAGE_KEY);
    } catch {
      // ignore
    }
    setResultPayload(null);
  };

  useEffect(() => clearResultOpenTimer, []);

  useEffect(() => {
    if (!latestNoticeAt) {
      setHasUnreadNotice(false);
      return;
    }
    try {
      const lastSeen = window.localStorage.getItem("notices.lastSeenAt");
      setHasUnreadNotice(!lastSeen || latestNoticeAt > lastSeen);
    } catch {
      setHasUnreadNotice(true);
    }
  }, [latestNoticeAt]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(GUIDE_SEEN_STORAGE_KEY) === "1") return;
      setGuideOpen(true);
    } catch {
      setGuideOpen(true);
    }
  }, []);

  const closeGuide = () => {
    try {
      window.localStorage.setItem(GUIDE_SEEN_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setGuideOpen(false);
  };

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(RESULT_PAYLOAD_STORAGE_KEY);
      if (!stored || resultPayload) return;
      setResultPayload(JSON.parse(stored) as AttendanceResultPayload);
    } catch {
      try {
        window.sessionStorage.removeItem(RESULT_PAYLOAD_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, [resultPayload]);

  const myTeam = getTeam(profile.mainTeamId);

  const todayDateOnly = new Date();
  todayDateOnly.setHours(0, 0, 0, 0);

  // page.tsx에서 월요일을 보냄 — 월~일 순서로 표시
  const monday = weekStart ? new Date(`${weekStart}T00:00:00`) : null;

  const myWeekGames = weekGames
    .filter((g) => g.homeTeamId === profile.mainTeamId || g.awayTeamId === profile.mainTeamId)
    .map((g) => ({
      ...g,
      isHome: g.homeTeamId === profile.mainTeamId,
      opponentTeamId: g.homeTeamId === profile.mainTeamId ? g.awayTeamId : g.homeTeamId,
      dateObj: parseDotDate(g.date)
    }));

  const weekDaysAll = monday
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const game = myWeekGames.find((g) => g.dateObj.getTime() === d.getTime());
        const isToday = d.getTime() === todayDateOnly.getTime();
        return { date: d, label: WEEK_LABELS_MON[i], dayNum: d.getDate(), isToday, game, dayIndex: i };
      })
    : [];

  // KBO는 보통 월요일이 휴식일이라 우리팀 월요일 경기가 없는 경우가 대부분.
  // 월요일 경기가 없으면 화~일 6개만 표시해 각 카드의 가로 공간을 넓힌다.
  // 단, 오늘이 월요일이면 사용자 위치 파악을 위해 그대로 7개 유지.
  const mondayHasGame = Boolean(weekDaysAll[0]?.game);
  const todayIsMonday = todayDateOnly.getDay() === 1;
  const weekDays = weekDaysAll.length === 0 || mondayHasGame || todayIsMonday
    ? weekDaysAll
    : weekDaysAll.slice(1);

  const weekHomeCount = weekDays.filter((d) => d.game?.isHome).length;
  const weekAwayCount = weekDays.filter((d) => d.game && !d.game.isHome).length;

  // 결과가 있어도 사용자가 결과 이펙트를 직접 확인하기 전까진 "현재 직관" 영역에 남긴다.
  // (자동 노출이 아니라 사용자 클릭으로 결과를 보게 해 보상감 + 추후 경험치 트리거 활용)
  const upcomingAttendances = attendances
    .filter((a) => !a.result || !a.resultAcknowledgedAt)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 최근 직관: 결과 있고 + 사용자가 이펙트를 본 직관만. 오래된 → 최신 (좌→우)
  const recentAttendances = attendances
    .filter((a) => !!a.result && !!a.resultAcknowledgedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .reverse();

  // 섹션 헤더용: 최근 5경기 승/패 집계 — 통계 자체는 acknowledged 와 무관.
  const last5Attendances = attendances
    .filter((a) => !!a.result)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const last5Wins = last5Attendances.filter((a) => a.result === "win").length;
  const last5Losses = last5Attendances.filter((a) => a.result === "lose").length;

  const totalAttendances = attendances.length;
  const wins = attendances.filter((a) => a.result === "win").length;
  const losses = attendances.filter((a) => a.result === "lose").length;
  const draws = attendances.filter((a) => a.result === "draw").length;

  return (
    <AppShell
      activeTab="home"
      theme="dark"
      showBeta
      headerAction={
        <div className="header-actions">
          <button className="header-action" type="button" aria-label="사용법 안내" onClick={() => setGuideOpen(true)}>
            <CircleHelp size={17} />
          </button>
          <Link className="header-action" href="/my/notices" aria-label="공지사항" prefetch>
            <Megaphone size={17} />
            {hasUnreadNotice ? <span className="header-action-badge" aria-hidden="true" /> : null}
          </Link>
        </div>
      }
    >
      {/* HERO */}
      <section className="hd-card hd-hero" aria-label="내 직관 승률">
        <div className="hd-hero-bg" aria-hidden="true" />

        <div className="hd-hero-top">
          <div className="hd-team-pill">
            <TeamBadge teamId={profile.mainTeamId} size="md" />
            <span className="hd-team-pill-text">내 팀 {myTeam.shortName}</span>
          </div>
          {seasonLevel ? <SeasonLevelMiniChip state={seasonLevel} /> : null}
        </div>

        <div className="hd-hero-center">
          <p className="hd-hero-label">내 직관 승률</p>
          <p className="hd-hero-number">{profile.winRate}</p>
          <p className="hd-hero-summary">
            <span>총 {totalAttendances}경기 ·</span>
            <span className="hd-text-win">{wins}승</span>
            <span className="hd-text-loss">{losses}패</span>
            <span className="hd-text-draw">{draws}무</span>
          </p>
        </div>

        <div className="hd-hero-actions">
          <button type="button" className="hd-btn hd-btn-primary" onClick={() => setModal("attendance")}>
            <Plus size={18} /> 직관 등록
          </button>
          <button type="button" className="hd-btn hd-btn-secondary" onClick={() => setModal("review")}>
            후기 작성
          </button>
          <button type="button" className="hd-btn hd-btn-tertiary" onClick={() => setModal("share")} aria-label="공유">
            <Share2 size={16} /> 공유
          </button>
        </div>
      </section>

      {/* NEXT GAME */}
      {upcomingAttendances.length === 0 ? (
        <section className="hd-card hd-empty-card" aria-label="다음 직관">
          <div className="hd-section-header">
            <h2 className="hd-section-title">다음 직관</h2>
          </div>
          <div className="hd-empty-body">
            <p>예정된 직관이 아직 없어요.</p>
            <button type="button" className="hd-empty-cta" onClick={() => setModal("attendance")}>
              <Plus size={16} strokeWidth={3} /> 예정 직관 등록
            </button>
          </div>
        </section>
      ) : null}
      {upcomingAttendances.length > 0 && (() => {
        const safeIndex = Math.min(nextIndex, upcomingAttendances.length - 1);
        const att = upcomingAttendances[safeIndex];
        const home = getTeam(att.homeTeamId);
        const away = getTeam(att.awayTeamId);
        const hasPrev = safeIndex > 0;
        const hasNext = safeIndex < upcomingAttendances.length - 1;
        const isLive = hasGameStarted(att.date, att.time);
        const today = todayDotDate();
        const isPast = att.date < today;
        const hasUnseenResult = !!att.result;
        // 섹션 제목: 결과가 이미 있고 지난날이면 "지난 직관", 시작했거나 오늘이면 "현재 직관", 아니면 "다음 직관"
        const sectionTitle = hasUnseenResult && isPast ? "지난 직관" : isLive ? "현재 직관" : "다음 직관";
        return (
          <section className="hd-card hd-next" aria-label={sectionTitle}>
            <div className="hd-section-header">
              <h2 className={`hd-section-title${isLive ? " hd-section-title-live" : ""}`}>
                {isLive ? <span className="hd-section-live-dot" aria-hidden="true" /> : null}
                {sectionTitle}
              </h2>
              <div className="hd-next-nav">
                <button
                  type="button"
                  aria-label="이전 직관"
                  disabled={!hasPrev}
                  onClick={() => { setNextDir("prev"); setNextIndex((i) => Math.max(0, i - 1)); }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  aria-label="다음 직관"
                  disabled={!hasNext}
                  onClick={() => { setNextDir("next"); setNextIndex((i) => i + 1); }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="hd-next-content" key={att.id} data-dir={nextDir}>
              <div className="hd-next-meta-row">
                <span className="hd-status-chip hd-status-chip-dday">{getDday(att.date)}</span>
                <span className="hd-next-datetime">
                  {formatDateWithDay(att.date)} {att.time ? att.time.slice(0, 5) : ""}
                </span>
                <span className="hd-next-location">{att.stadium}</span>
              </div>

              <div className="hd-matchup-row">
                <div className="hd-matchup-team">
                  <TeamBadge teamId={att.awayTeamId} size="md" />
                  <div className="hd-matchup-team-info">
                    <span className="hd-team-name">{away.shortName}</span>
                    <span className="hd-tiny-chip">원정</span>
                  </div>
                </div>
                <div className="hd-matchup-vs">VS</div>
                <div className="hd-matchup-team hd-matchup-team-right">
                  <div className="hd-matchup-team-info">
                    <span className="hd-team-name">{home.shortName}</span>
                    <span className="hd-tiny-chip">홈</span>
                  </div>
                  <TeamBadge teamId={att.homeTeamId} size="md" />
                </div>
              </div>

              {isLive ? (
                <div className="hd-game-progress-row">
                  <span className="hd-game-progress-label">
                    <span className="hd-game-progress-pulse" aria-hidden="true" />
                    {hasUnseenResult ? (isPast ? "경기 결과가 도착했어요" : "경기가 끝났어요") : "경기가 시작되었어요"}
                  </span>
                  {hasUnseenResult ? (
                    <button
                      type="button"
                      className="hd-game-end-btn"
                      disabled={finalizingId === att.id}
                      onClick={() => {
                        const payload = buildResultPayload(att);
                        if (payload) {
                          openResultModal(payload, { persist: true });
                          return;
                        }
                        // client state에 score/result가 비어있는 경우 (cron 타이밍 차이 등):
                        // 서버에서 직접 결과를 가져와 모달 열기 + client state 갱신.
                        if (finalizingId === att.id) return;
                        setFinalizingId(att.id);
                        startFinalize(async () => {
                          try {
                            const res = await finalizeAttendanceAction(att.id);
                            if (!res.ok) {
                              showToast(res.reason);
                              setFinalizingId(null);
                              return;
                            }
                            markAttendanceResult(att.id, {
                              result: res.result,
                              myScore: res.myScore,
                              opponentScore: res.opponentScore,
                              supportTeamId: res.myTeamId,
                              homeTeamId: att.homeTeamId
                            });
                            openResultModal({ attendanceId: att.id, ...res }, { persist: true, delayMs: 350 });
                            setFinalizingId(null);
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : "결과 확인 중 오류가 발생했어요.");
                            setFinalizingId(null);
                          }
                        });
                      }}
                    >
                      {finalizingId === att.id ? (
                        <>
                          <span className="onboarding-submit-spinner" aria-hidden="true" />
                          확인 중...
                        </>
                      ) : (
                        <>
                          <Flag size={14} /> {isPast ? "결과 보기" : "경기 종료"}
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="hd-game-end-btn"
                      disabled={finalizingId === att.id}
                      onClick={() => {
                        if (finalizingId === att.id) return;
                        setFinalizingId(att.id);
                        startFinalize(async () => {
                          try {
                            const res = await finalizeAttendanceAction(att.id);
                            if (!res.ok) {
                              showToast(res.reason);
                              setFinalizingId(null);
                              return;
                            }
                            // 클라이언트 state 즉시 업데이트 — router.refresh() 대신.
                            // refresh를 여기서 부르면 Suspense 경계 재발동 → 모달 state 손실 + 카드 깜빡.
                            markAttendanceResult(att.id, {
                              result: res.result,
                              myScore: res.myScore,
                              opponentScore: res.opponentScore,
                              supportTeamId: res.myTeamId,
                              homeTeamId: att.homeTeamId
                            });
                            openResultModal({ attendanceId: att.id, ...res }, { persist: true, delayMs: 350 });
                            setFinalizingId(null);
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : "확인 중 오류가 발생했어요.");
                            setFinalizingId(null);
                          }
                        });
                      }}
                    >
                      {finalizingId === att.id ? (
                        <>
                          <span className="onboarding-submit-spinner" aria-hidden="true" />
                          확인 중...
                        </>
                      ) : (
                        <>
                          <Flag size={14} /> 경기 종료
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        );
      })()}

      {/* RECENT GAMES */}
      {recentAttendances.length === 0 ? (
        <section className="hd-card hd-empty-card" aria-label="최근 직관 경기">
          <div className="hd-section-header">
            <h2 className="hd-section-title">최근 직관 경기</h2>
          </div>
          <div className="hd-empty-body">
            <p>아직 다녀온 직관이 없어요.</p>
            <button type="button" className="hd-empty-cta" onClick={() => setModal("attendance")}>
              <Plus size={16} strokeWidth={3} /> 이전 직관 등록
            </button>
          </div>
        </section>
      ) : null}
      {recentAttendances.length > 0 && (
        <section className="hd-card" aria-label="최근 직관 경기">
          <div className="hd-section-header">
            <div className="hd-section-title-wrap">
              <h2 className="hd-section-title">최근 직관 경기</h2>
              <p className="hd-section-substat">
                <span className="hd-text-win">{last5Wins}승</span>
                <span className="hd-text-loss">{last5Losses}패</span>
              </p>
            </div>
            <Link href="/my/attendances" className="hd-text-link" prefetch>더보기 <ChevronRight size={14} /></Link>
          </div>

          <div className="hd-recent-list">
            {recentAttendances.map((att) => {
              const compactDate = att.date.split(".").slice(1).join(".");
              const dateObj = parseDotDate(att.date);
              const dayLabel = WEEK_LABELS_SUN[dateObj.getDay()];
              const result = att.result as "win" | "lose" | "draw";
              const resultLabel = result === "win" ? "승" : result === "lose" ? "패" : "무";

              // 점수 표기: home : away (홈팀 좌측)
              const score = att.score && att.score.includes(":")
                ? att.score.replace(/\s/g, "").split(":").join(" : ")
                : "- : -";

              return (
                <button
                  type="button"
                  className="hd-recent-card hd-recent-card-clickable"
                  key={att.id}
                  onClick={() => {
                    const payload = buildResultPayload(att);
                    if (payload) openResultModal(payload);
                  }}
                  aria-label={`${compactDate} ${getTeam(att.homeTeamId).shortName} vs ${getTeam(att.awayTeamId).shortName} ${resultLabel} 다시 보기`}
                >
                  <p className="hd-recent-date">{compactDate} ({dayLabel})</p>
                  <div className="hd-recent-score">
                    <TeamBadge teamId={att.homeTeamId} size="sm" />
                    <span className="hd-score-text">{score}</span>
                    <TeamBadge teamId={att.awayTeamId} size="sm" />
                  </div>
                  <div className="hd-result-line">
                    <span className={`hd-result-dot hd-result-${result === "lose" ? "loss" : result}`} />
                    <span className={`hd-result-text hd-text-${result === "lose" ? "loss" : result}`}>{resultLabel}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* WEEKLY SCHEDULE */}
      {weekDays.length > 0 && (
        <section className="hd-card" aria-label="우리팀 일정">
          <div className="hd-section-header">
            <h2 className="hd-section-title">우리팀 일정</h2>
            <Link href="/schedule" className="hd-text-link" prefetch>전체 일정 <ChevronRight size={14} /></Link>
          </div>

          <div
            className="hd-week-list"
            style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(0, 1fr))` }}
          >
            {weekDays.map((d) => {
              const result = d.game ? getGameResult(d.game, profile.mainTeamId) : null;
              const dayClass = d.dayIndex === 6 ? "hd-week-day-sun" : d.dayIndex === 5 ? "hd-week-day-sat" : "";

              let statusLabel: string | null = null;
              let statusClass = "";
              if (d.isToday) {
                statusLabel = "오늘";
                statusClass = "hd-week-status-today";
              } else if (result === "win") {
                statusLabel = "승";
                statusClass = "hd-text-win";
              } else if (result === "lose") {
                statusLabel = "패";
                statusClass = "hd-text-loss";
              } else if (result === "draw") {
                statusLabel = "무";
                statusClass = "hd-text-draw";
              } else if (d.game) {
                statusLabel = "예정";
                statusClass = "hd-text-info";
              }

              const postCount = d.game ? matchPostCounts[d.game.id] ?? 0 : 0;
              const postCountLabel = postCount > 9 ? "9+" : String(postCount);
              return (
                <article
                  className={`hd-week-cell${d.isToday ? " hd-week-cell-today" : ""}`}
                  key={d.date.toISOString()}
                >
                  {postCount > 0 && d.game ? (
                    <Link
                      href={`/community?tab=match-talk&gameId=${d.game.id}`}
                      className="hd-week-talk-bubble"
                      aria-label={`경기톡 ${postCount}개 보기`}
                      prefetch={false}
                    >
                      {postCountLabel}
                    </Link>
                  ) : null}
                  <p className={`hd-week-day ${dayClass}`}>{d.label}</p>
                  <p className="hd-week-date">{formatMonthDay(d.date)}</p>
                  {d.game ? (
                    <TeamBadge teamId={d.game.opponentTeamId} size="sm" />
                  ) : (
                    <span className="hd-week-rest" aria-label="휴식" />
                  )}
                  {statusLabel ? <p className={`hd-week-status ${statusClass}`}>{statusLabel}</p> : null}
                </article>
              );
            })}
          </div>

          <p className="hd-week-summary">
            {weekAwayCount}경기 원정 · {weekHomeCount}경기 홈
          </p>
        </section>
      )}

      <AppModals open={modal} setOpen={setModal} initialAttendanceId={reviewTargetId} />
      <AppGuideModal open={guideOpen} onClose={closeGuide} />
      <AttendanceResultModal
        payload={resultPayload}
        onClose={async () => {
          // 결과를 본 직관은 DB에 ack 시각 저장 → 다음 진입부터 "최근 직관"으로 이동.
          if (resultPayload) {
            const res = await acknowledgeAttendanceResult(resultPayload.attendanceId);
            if (!res.ok && res.reason) showToast(res.reason);
          }
          closeResultModal();
          // 모달 닫은 후에 다른 페이지(/my, /my/attendances)도 최신 데이터 반영되도록.
          router.refresh();
        }}
        onWriteReview={async (attendanceId) => {
          // 후기 작성 흐름으로 넘어가는 것도 결과를 확인한 행위로 본다.
          const res = await acknowledgeAttendanceResult(attendanceId);
          if (!res.ok && res.reason) showToast(res.reason);
          closeResultModal();
          setReviewTargetId(attendanceId);
          setModal("review");
        }}
      />
    </AppShell>
  );
}
