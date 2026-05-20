"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { AppModals, type ModalKind } from "@/components/domain/AppModals";
import { getTeam } from "@/lib/constants/teams";
import type { Game } from "@/lib/types/domain";

type GameDetailScreenProps = {
  game?: Game;
};

export function GameDetailScreen({ game }: GameDetailScreenProps) {
  const [modal, setModal] = useState<ModalKind>(null);

  if (!game) {
    return (
      <AppShell activeTab="schedule" title="경기 상세">
        <div className="detail-topbar">
          <a href="/schedule" aria-label="뒤로가기"><ArrowLeft size={20} /></a>
          <span>경기 상세</span>
          <span />
        </div>
        <section className="not-found-panel">
          <h1>경기를 찾을 수 없어요</h1>
          <p>일정 화면에서 다시 경기 카드를 선택해주세요.</p>
          <a href="/schedule">일정으로 돌아가기</a>
        </section>
      </AppShell>
    );
  }

  const home = getTeam(game.homeTeamId);
  const away = getTeam(game.awayTeamId);

  return (
    <AppShell activeTab="schedule" title="경기 상세">
      <div className="detail-topbar">
        <a href="/schedule" aria-label="뒤로가기"><ArrowLeft size={20} /></a>
        <span>{game.date} ({game.time})</span>
        <button className="icon-button" aria-label="공유"><Share2 size={17} /></button>
      </div>
      <section className="score-board">
        <div>
          <TeamBadge teamId={game.homeTeamId} size="lg" />
          <strong>{home.shortName}</strong>
          {game.status === "finished" && game.homeScore !== undefined && game.awayScore !== undefined && game.homeScore > game.awayScore
            ? <span className="pill-win">승</span>
            : null}
        </div>
        <b>
          {game.status === "finished" && game.homeScore !== undefined && game.awayScore !== undefined
            ? `${game.homeScore} : ${game.awayScore}`
            : "경기전"}
        </b>
        <div>
          <TeamBadge teamId={game.awayTeamId} size="lg" />
          <strong>{away.shortName}</strong>
          {game.status === "finished" && game.homeScore !== undefined && game.awayScore !== undefined && game.awayScore > game.homeScore
            ? <span className="pill-win">승</span>
            : null}
        </div>
      </section>
      <Card className="info-list">
        <div><span>경기장</span><strong>{game.stadium}</strong></div>
        <div><span>상태</span><strong>{game.status === "finished" ? "종료" : "예정"}</strong></div>
      </Card>
      <div className="sticky-action-row">
        <Button onClick={() => setModal("attendance")}>
          <Plus size={17} />
          이 경기 직관 등록
        </Button>
      </div>
      <AppModals open={modal} setOpen={setModal} initialGames={[game]} initialGameId={game.id} initialDate={game.date} />
    </AppShell>
  );
}
