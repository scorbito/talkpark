"use client";

import { useEffect, useState } from "react";
import { Camera, ChevronDown } from "lucide-react";
import { Button } from "@/components/common/Button";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam, teams } from "@/lib/constants/teams";
import type { Game } from "@/lib/types/domain";

type TicketPreview = {
  imageBase64: string;
  mimeType: string;
  hash: string;
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
} | null;

type AttendanceModalProps = {
  open: boolean;
  onClose: () => void;
  processingTicket: boolean;
  ticketPreview: TicketPreview;
  ticketFileName: string;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  gamesOnSelectedDate: Game[];
  gamesLoading?: boolean;
  selectedGameId: string;
  supportTeamId: string;
  setSupportTeamId: (value: string) => void;
  savingAttendance: boolean;
  /** 사용자 내 팀 ID — 기본은 이 팀의 경기만 노출하고 나머지는 토글로 펼침 */
  mainTeamId: string;
  onTicketFileChange: (file: File | null) => void;
  onSelectGameAndTeam: (gameId: string, teamId: string) => void;
  onSubmit: () => void;
};

export function AttendanceModal({
  open,
  onClose,
  processingTicket,
  ticketPreview,
  ticketFileName,
  selectedDate,
  setSelectedDate,
  gamesOnSelectedDate,
  gamesLoading = false,
  selectedGameId,
  supportTeamId,
  setSupportTeamId,
  savingAttendance,
  mainTeamId,
  onTicketFileChange,
  onSelectGameAndTeam,
  onSubmit
}: AttendanceModalProps) {
  // 내 팀이 끼어 있는 경기 vs 다른 경기로 분리. 다른 경기는 기본 접힘.
  const myTeamGames = gamesOnSelectedDate.filter(
    (g) => g.homeTeamId === mainTeamId || g.awayTeamId === mainTeamId
  );
  const otherGames = gamesOnSelectedDate.filter(
    (g) => g.homeTeamId !== mainTeamId && g.awayTeamId !== mainTeamId
  );
  const hasMyTeamGames = myTeamGames.length > 0;
  // 사용자가 "다른 팀 경기 보기" 토글한 날짜를 기록. 날짜 바꾸면 자동 초기화.
  // (게임 로딩 타이밍 / 날짜 변경에 안정적으로 동작하도록 useState 직접 초기화 X)
  const [userExpandedDate, setUserExpandedDate] = useState<string | null>(null);

  // 모달이 닫히면 펼침 상태도 초기화 — 다음 진입 시 기본(내 팀만) 보기로 시작.
  useEffect(() => {
    if (!open) setUserExpandedDate(null);
  }, [open]);
  const showOthers = userExpandedDate === selectedDate || !hasMyTeamGames;
  const visibleGames = showOthers ? gamesOnSelectedDate : myTeamGames;
  const hiddenOtherCount = hasMyTeamGames && !showOthers ? otherGames.length : 0;
  return (
    <ModalShell open={open} title="직관 등록" onClose={onClose} panelClassName="attendance-modal-panel">
      <div className="form-stack">
        <label className="upload-box">
          <Camera size={24} />
          <strong>
            {processingTicket
              ? "티켓 인식 중..."
              : ticketPreview
                ? "티켓 인식 완료 — 아래에서 확인 후 등록"
                : (ticketFileName || "티켓 사진으로 빠른 등록")}
          </strong>
          <span>
            티켓 사진을 올리면 경기와 응원팀이 자동으로 채워져요.<br />
            <em className="upload-box-hint">※ 티켓 없어도 아래에서 직접 입력하거나, 등록 후 마이 페이지에서 나중에 인증할 수 있어요.</em>
          </span>
          <input
            type="file"
            accept="image/*"
            disabled={processingTicket}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              onTicketFileChange(file);
            }}
          />
        </label>

        <div className="form-divider" aria-hidden="true">
          <span>또는 직접 입력</span>
        </div>

        <label className="field-row">
          <span>1. 직관 날짜 선택</span>
          <p className="field-help">앞으로 갈 경기뿐 아니라 이미 다녀온 경기도 등록할 수 있어요.</p>
          <input className="plain-input" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
        <div className="field-group">
          <span>2. 경기와 응원팀 선택</span>
          {gamesLoading ? (
            <p className="field-empty">경기 목록을 불러오는 중...</p>
          ) : gamesOnSelectedDate.length === 0 ? (
            <p className="field-empty">이 날짜에 등록 가능한 경기가 없어요. 다른 날짜를 선택해보세요.</p>
          ) : null}
          {visibleGames.map((game) => {
            const home = getTeam(game.homeTeamId);
            const away = getTeam(game.awayTeamId);
            const homeSelected = game.id === selectedGameId && supportTeamId === game.homeTeamId;
            const awaySelected = game.id === selectedGameId && supportTeamId === game.awayTeamId;

            const isFinished = game.status === "finished" && game.homeScore !== undefined && game.awayScore !== undefined;
            const scoreLabel = isFinished ? `${game.homeScore} : ${game.awayScore}` : "vs";
            return (
              <div className={game.id === selectedGameId ? "radio-game radio-game-active" : "radio-game"} key={game.id}>
                <button
                  className={homeSelected ? "team-choice team-choice-active" : "team-choice"}
                  type="button"
                  aria-label={`${home.shortName} 응원으로 ${home.shortName} 대 ${away.shortName} 경기 선택`}
                  onClick={() => onSelectGameAndTeam(game.id, game.homeTeamId)}
                >
                  <i />
                  <TeamBadge teamId={game.homeTeamId} size="sm" />
                  <strong>{home.shortName}</strong>
                </button>
                <em>{scoreLabel}</em>
                <button
                  className={awaySelected ? "team-choice team-choice-active" : "team-choice"}
                  type="button"
                  aria-label={`${away.shortName} 응원으로 ${home.shortName} 대 ${away.shortName} 경기 선택`}
                  onClick={() => onSelectGameAndTeam(game.id, game.awayTeamId)}
                >
                  <strong>{away.shortName}</strong>
                  <TeamBadge teamId={game.awayTeamId} size="sm" />
                  <i />
                </button>
              </div>
            );
          })}
          {hiddenOtherCount > 0 ? (
            <button
              type="button"
              className="show-others-toggle"
              onClick={() => setUserExpandedDate(selectedDate)}
            >
              <span>다른 팀 경기 {hiddenOtherCount}개 더 보기</span>
              <ChevronDown size={14} />
            </button>
          ) : null}
        </div>
        <label className="field-row">
          <span>3. 응원 팀 확인</span>
          <select className="plain-input" value={supportTeamId} onChange={(event) => setSupportTeamId(event.target.value)}>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <Button disabled={savingAttendance} onClick={onSubmit}>{savingAttendance ? "저장 중" : "등록하기"}</Button>
      </div>
    </ModalShell>
  );
}
