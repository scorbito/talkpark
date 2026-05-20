"use client";

import { useState } from "react";
import { Share2, Plus, PenLine } from "lucide-react";
import { Button } from "@/components/common/Button";
import { TeamBadge } from "@/components/common/TeamBadge";
import { AppModals, type ModalKind } from "@/components/domain/AppModals";
import { getTeam } from "@/lib/constants/teams";
import type { Game, UserProfile } from "@/lib/types/domain";

type WinRateHeroCardProps = {
  profile: UserProfile;
  games?: Game[];
};

export function WinRateHeroCard({ profile, games = [] }: WinRateHeroCardProps) {
  const team = getTeam(profile.mainTeamId);
  const [modal, setModal] = useState<ModalKind>(null);

  return (
    <>
      <section
        className="win-hero"
        style={{
          background: `radial-gradient(circle at 85% 20%, ${team.accent ?? "#FF6B35"} 0, transparent 32%), linear-gradient(135deg, ${team.color}, #090b21 58%, ${team.accent ?? "#FF6B35"})`
        }}
      >
        <div className="win-hero-team-pill">
          <TeamBadge teamId={profile.mainTeamId} size="sm" />
          <span>내 팀 {team.shortName}</span>
        </div>
        <div className="win-hero-copy">
          <p>내 직관 승률</p>
          <strong>{profile.winRate}</strong>
          <span>
            {profile.wins}승 {profile.losses}패 {profile.draws}무
          </span>
        </div>
        <div className="hero-register-center">
          <Button variant="secondary" onClick={() => setModal("attendance")}>
            <Plus size={16} />
            등록하기
          </Button>
        </div>
        <div className="review-float-buttons">
          <button className="review-float-button" type="button" onClick={() => setModal("share")}>
            <Share2 size={15} />
          </button>
          <button className="review-float-button" type="button" onClick={() => setModal("review")}>
            <PenLine size={15} />
            후기
          </button>
        </div>
      </section>
      <AppModals open={modal} setOpen={setModal} initialGames={games} />
    </>
  );
}
