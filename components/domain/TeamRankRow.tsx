import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { TeamStanding } from "@/lib/types/domain";

type TeamRankRowProps = {
  standing: TeamStanding;
  highlighted?: boolean;
};

export function TeamRankRow({ standing, highlighted = false }: TeamRankRowProps) {
  const team = getTeam(standing.teamId);

  return (
    <li className={`rank-row ${highlighted ? "rank-row-highlighted" : ""}`}>
      <span className="rank-num">{standing.rank}</span>
      <TeamBadge teamId={standing.teamId} size="sm" />
      <span className="rank-team">{team.shortName}</span>
      <span className="rank-record">
        {standing.wins}-{standing.draws}-{standing.losses}
      </span>
      <strong>{standing.winRate}</strong>
    </li>
  );
}
