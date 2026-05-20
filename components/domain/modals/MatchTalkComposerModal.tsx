"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { Button } from "@/components/common/Button";
import { TeamBadge } from "@/components/common/TeamBadge";
import {
  createMatchPostAction,
  getLiveScorePreviewAction,
  listWriteableGamesAction,
  type LiveScorePreview,
  type WriteableGameOption
} from "@/lib/actions/matchTalk";
import { uploadUserFile } from "@/lib/supabase/storage-client";
import { useAppState } from "@/lib/state/AppState";
import { getThisWeekRangeKst } from "@/lib/utils/matchTalkWeek";
import { getTeam } from "@/lib/constants/teams";
import type { MatchPostEmotionTag } from "@/lib/types/domain";
import { MATCH_POST_EMOTION_OPTIONS as EMOTION_OPTIONS } from "@/lib/constants/matchPostEmotion";

const MAX_BODY = 300;

type MatchTalkComposerModalProps = {
  open: boolean;
  onClose: () => void;
  /** 성공적으로 글이 작성되면 새 글의 id를 인자로 호출됨. 부모(목록)가 prepend에 사용. */
  onCreated?: (newPostId: string) => void;
  /** 진입 시 미리 선택할 경기 ID. 예: 일정 → 경기톡 보기에서 진입할 때 */
  initialGameId?: string;
};

function formatDateLabel(dateStr: string): { md: string; weekday: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return { md: `${m}/${d}`, weekday: `(${weekdays[date.getDay()]})` };
}

export function MatchTalkComposerModal({ open, onClose, onCreated, initialGameId }: MatchTalkComposerModalProps) {
  const { showToast, profile } = useAppState();
  const [games, setGames] = useState<WriteableGameOption[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedGameId, setSelectedGameId] = useState<string>(initialGameId ?? "");
  const [body, setBody] = useState("");
  const [emotionTag, setEmotionTag] = useState<MatchPostEmotionTag | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 선택된 경기의 라이브 스코어 미리보기 (lazy refresh, TTL 2분)
  const [livePreview, setLivePreview] = useState<LiveScorePreview | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  // 모달 열릴 때 경기 목록 lazy fetch
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGamesLoading(true);
    listWriteableGamesAction()
      .then((list) => {
        if (cancelled) return;
        setGames(list);

        // 초기 날짜/경기 선택
        if (initialGameId && list.some((g) => g.id === initialGameId)) {
          const target = list.find((g) => g.id === initialGameId);
          if (target) {
            setSelectedDate(target.date);
            setSelectedGameId(initialGameId);
            return;
          }
        }
        // 기본값: 오늘. 오늘 경기 없으면 가장 가까운 날짜.
        const todayKst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const todayStr = `${todayKst.getFullYear()}-${String(todayKst.getMonth() + 1).padStart(2, "0")}-${String(todayKst.getDate()).padStart(2, "0")}`;
        const datesWithGames = Array.from(new Set(list.map((g) => g.date))).sort();
        const fallback = datesWithGames.find((d) => d >= todayStr) ?? datesWithGames[0] ?? "";
        const initialDate = list.some((g) => g.date === todayStr) ? todayStr : fallback;
        setSelectedDate(initialDate);
        const onDate = list.filter((g) => g.date === initialDate);
        // 우리팀 경기가 있으면 우선 선택, 없으면 그 날짜 첫 경기
        const myGame = onDate.find(
          (g) => g.homeTeamId === profile.mainTeamId || g.awayTeamId === profile.mainTeamId
        );
        setSelectedGameId((myGame ?? onDate[0])?.id ?? "");
      })
      .catch((err) => {
        showToast(err instanceof Error ? err.message : "경기 목록을 불러오지 못했어요.");
      })
      .finally(() => {
        if (!cancelled) setGamesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialGameId, showToast, profile.mainTeamId]);

  // 모달 닫힐 때 폼 초기화
  useEffect(() => {
    if (open) return;
    setBody("");
    setEmotionTag(null);
    setPhotoUrl(null);
    setSelectedGameId("");
    setLivePreview(null);
  }, [open]);

  // 선택된 경기 변경 시 라이브 스코어 lazy refresh (TTL 2분 캐시)
  useEffect(() => {
    if (!open || !selectedGameId) {
      setLivePreview(null);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    getLiveScorePreviewAction(selectedGameId)
      .then((preview) => {
        if (cancelled) return;
        setLivePreview(preview);
      })
      .catch(() => {
        if (cancelled) return;
        setLivePreview(null);
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedGameId]);

  const week = useMemo(() => getThisWeekRangeKst(), []);
  const datesThisWeek = useMemo(() => {
    const result: string[] = [];
    const [y, m, d] = week.from.split("-").map(Number);
    const cursor = new Date(y, m - 1, d);
    for (let i = 0; i < 7; i++) {
      const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      result.push(ds);
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [week]);

  const gamesOnSelectedDate = useMemo(() => {
    const filtered = games.filter((g) => g.date === selectedDate);
    // 우리팀(profile.mainTeamId) 경기를 맨 왼쪽으로
    return [...filtered].sort((a, b) => {
      const aIsMine = a.homeTeamId === profile.mainTeamId || a.awayTeamId === profile.mainTeamId;
      const bIsMine = b.homeTeamId === profile.mainTeamId || b.awayTeamId === profile.mainTeamId;
      if (aIsMine === bIsMine) return 0;
      return aIsMine ? -1 : 1;
    });
  }, [games, selectedDate, profile.mainTeamId]);
  const hasGamesByDate = useMemo(() => {
    const set = new Set(games.map((g) => g.date));
    return (date: string) => set.has(date);
  }, [games]);

  const selectedGame = games.find((g) => g.id === selectedGameId);

  const handleSelectDate = (date: string) => {
    if (!hasGamesByDate(date)) return;
    setSelectedDate(date);
    const onDate = games.filter((g) => g.date === date);
    // 우리팀 경기가 있으면 우선 선택, 없으면 그 날짜의 첫 경기
    const myGame = onDate.find(
      (g) => g.homeTeamId === profile.mainTeamId || g.awayTeamId === profile.mainTeamId
    );
    setSelectedGameId((myGame ?? onDate[0])?.id ?? "");
  };

  const handlePickPhoto = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadUserFile("review-photos", file, "match-talk");
      setPhotoUrl(url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "사진 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  // 버튼은 진행 중 외에는 항상 활성. 누락된 항목은 handleSubmit에서 토스트로 안내.
  const canSubmit = !submitting && !uploading;

  const handleSubmit = async () => {
    if (submitting || uploading) return;

    // 누락 항목을 순서대로 점검해 사용자가 어디를 채워야 하는지 명확히 알린다.
    if (!selectedGameId) {
      showToast("작성할 경기를 선택해주세요.");
      return;
    }
    if (body.trim().length === 0) {
      showToast("내용을 입력해주세요.");
      return;
    }
    if (body.length > MAX_BODY) {
      showToast(`내용은 ${MAX_BODY}자 이내로 작성해주세요.`);
      return;
    }
    if (!emotionTag) {
      showToast("감정 태그를 선택해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createMatchPostAction({
        gameId: selectedGameId,
        body,
        emotionTag,
        photoUrl
      });
      showToast("경기톡에 글을 올렸어요.");
      onCreated?.(result.id);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "글 작성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      open={open}
      title="경기톡 글쓰기"
      onClose={() => !submitting && onClose()}
      panelClassName="match-talk-modal-panel"
    >
      <div className="match-talk-composer">
        {/* 1. 날짜 */}
        <div className="composer-section">
          <label className="composer-label">날짜</label>
          <div className="composer-date-row">
            {datesThisWeek.map((date) => {
              const has = hasGamesByDate(date);
              const isSelected = date === selectedDate;
              const { md, weekday } = formatDateLabel(date);
              return (
                <button
                  key={date}
                  type="button"
                  className={
                    isSelected
                      ? "composer-date-chip composer-date-chip-active"
                      : has
                        ? "composer-date-chip"
                        : "composer-date-chip composer-date-chip-disabled"
                  }
                  disabled={!has}
                  onClick={() => handleSelectDate(date)}
                >
                  <span className="composer-date-md">{md}</span>
                  <span className="composer-date-weekday">{weekday}</span>
                </button>
              );
            })}
          </div>
          {gamesLoading ? <span className="composer-loading">경기 목록 불러오는 중…</span> : null}
        </div>

        {/* 2. 경기 */}
        <div className="composer-section">
          <label className="composer-label">경기</label>
          {gamesOnSelectedDate.length === 0 ? (
            <p className="composer-empty">
              {gamesLoading ? "" : "이 날짜에는 작성 가능한 경기가 없어요."}
            </p>
          ) : (
            <div className="composer-game-list">
              {gamesOnSelectedDate.map((g) => {
                const home = getTeam(g.homeTeamId);
                const away = getTeam(g.awayTeamId);
                const isSelected = g.id === selectedGameId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={isSelected ? "composer-game-chip composer-game-chip-active" : "composer-game-chip"}
                    onClick={() => setSelectedGameId(g.id)}
                    aria-label={`${away.shortName} vs ${home.shortName}`}
                  >
                    <span className="composer-game-team-line">
                      <TeamBadge teamId={g.awayTeamId} size="sm" />
                      <span>{away.shortName}</span>
                    </span>
                    <span className="composer-game-team-line">
                      <TeamBadge teamId={g.homeTeamId} size="sm" />
                      <span>{home.shortName}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2.5. 선택한 경기의 라이브 정보 (박제 미리보기) */}
        {selectedGame ? (
          <div className="composer-live-preview">
            <div className="composer-live-preview-header">
              <span className="composer-live-preview-label">박제 미리보기</span>
              {livePreview ? (
                <span className="composer-live-preview-source">
                  {livePreview.source === "kbo" ? "방금 갱신" : livePreview.source === "cache" ? "최근 캐시" : "캐시"}
                </span>
              ) : null}
            </div>
            <div className="composer-live-preview-body">
              {liveLoading && !livePreview ? (
                <span className="composer-live-preview-muted">현재 점수 불러오는 중…</span>
              ) : (() => {
                const away = getTeam(selectedGame.awayTeamId);
                const home = getTeam(selectedGame.homeTeamId);
                const status = livePreview?.status ?? selectedGame.status;
                if (status === "scheduled") {
                  return (
                    <span className="composer-live-preview-text">
                      {away.shortName} vs {home.shortName} · 경기 전
                    </span>
                  );
                }
                if (status === "canceled") {
                  return (
                    <span className="composer-live-preview-text">
                      {away.shortName} vs {home.shortName} · 취소
                    </span>
                  );
                }
                const a = livePreview?.awayScore ?? "-";
                const h = livePreview?.homeScore ?? "-";
                const suffix = status === "in_progress" ? " · 진행 중" : " (최종)";
                return (
                  <span className="composer-live-preview-text">
                    {away.shortName} {a} : {h} {home.shortName}{suffix}
                  </span>
                );
              })()}
            </div>
            <p className="composer-live-preview-hint">
              지금 보이는 점수와 상태가 글에 박제돼요.
            </p>
          </div>
        ) : null}

        {/* 3. 본문 */}
        <div className="composer-section">
          <label className="composer-label" htmlFor="match-talk-body">내용</label>
          <textarea
            id="match-talk-body"
            className="composer-textarea"
            placeholder="한두 줄로 가볍게 — 무슨 얘기를 하고 싶으신가요?"
            maxLength={MAX_BODY}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitting}
          />
          <div className="composer-counter">
            <span>{body.length} / {MAX_BODY}</span>
          </div>
        </div>

        {/* 4. 감정 태그 */}
        <div className="composer-section">
          <label className="composer-label">감정 태그 (필수)</label>
          <div className="composer-emotion-row">
            {EMOTION_OPTIONS.map((opt) => {
              const active = emotionTag === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={active ? "composer-emotion-chip composer-emotion-chip-active" : "composer-emotion-chip"}
                  onClick={() => setEmotionTag(opt.id)}
                  aria-pressed={active}
                  title={opt.hint}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. 사진 */}
        <div className="composer-section">
          <label className="composer-label">사진 (선택, 1장)</label>
          {photoUrl ? (
            <div className="composer-photo-preview">
              <div className="composer-photo-frame">
                <Image src={photoUrl} alt="" fill sizes="320px" style={{ objectFit: "cover" }} />
              </div>
              <button
                type="button"
                className="composer-photo-remove"
                onClick={() => setPhotoUrl(null)}
                aria-label="사진 제거"
              >
                <Trash2 size={14} /> 제거
              </button>
            </div>
          ) : (
            <label className="composer-photo-pick">
              <ImagePlus size={16} />
              <span>{uploading ? "업로드 중…" : "사진 추가"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={uploading || submitting}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handlePickPhoto(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {/* 6. 등록 */}
        <div className="composer-actions">
          <button
            type="button"
            className="composer-cancel"
            disabled={submitting}
            onClick={onClose}
          >
            취소
          </button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? "올리는 중…" : "올리기"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
