import { getTeam } from "@/lib/constants/teams";
import type { CSSProperties } from "react";

type TeamBadgeProps = {
  teamId: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
};

const sizeClass = {
  sm: "team-badge-sm",
  md: "team-badge-md",
  lg: "team-badge-lg"
};

export function TeamBadge({ teamId, size = "md", showName = false }: TeamBadgeProps) {
  const team = getTeam(teamId);

  return (
    <span className="team-badge-wrap">
      <span
        className={`team-badge ${sizeClass[size]}`}
        style={{
          background: team.color,
          "--team-color": team.color,
          "--team-accent": team.accent ?? team.color
        } as CSSProperties}
        aria-label={team.name}
      >
        <span className="team-badge-initial">{team.initial}</span>
      </span>
      {showName ? <span className="team-badge-name">{team.shortName}</span> : null}
    </span>
  );
}
