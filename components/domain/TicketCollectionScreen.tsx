"use client";

import { useState } from "react";
import Image from "next/image";
import { MapPin, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { TicketCollectionItem } from "@/app/my/tickets/page";

type Props = {
  items: TicketCollectionItem[];
};

export function TicketCollectionScreen({ items }: Props) {
  const [zoomedItem, setZoomedItem] = useState<TicketCollectionItem | null>(null);

  return (
    <AppShell activeTab="my" title="내 티켓 컬렉션" theme="dark" backHref="/my">
      {items.length === 0 ? (
        <div className="ticket-empty">
          <p>티켓으로 인증한 직관이 여기에 모여요.</p>
          <span>첫 티켓을 인증해 디지털 컬렉션을 만들어보세요.</span>
        </div>
      ) : (
        <div className="ticket-grid">
          {items.map((item) => {
            const home = getTeam(item.homeTeamId);
            const away = getTeam(item.awayTeamId);
            const support = getTeam(item.supportTeamId);
            const supportIsHome = item.supportTeamId === item.homeTeamId;
            const venueLabel = supportIsHome ? "홈경기" : "원정경기";
            const score = item.homeScore !== null && item.awayScore !== null ? `${item.homeScore} : ${item.awayScore}` : null;
            return (
              <button
                key={item.id}
                className="ticket-card"
                type="button"
                onClick={() => setZoomedItem(item)}
                aria-label={`${item.gameDate} ${home.shortName} vs ${away.shortName} 티켓 보기`}
              >
                <div className="ticket-thumb">
                  <Image alt="티켓" src={item.signedUrl} fill sizes="(max-width: 480px) 50vw, 200px" style={{ objectFit: "cover" }} />
                </div>
                <div className="ticket-meta">
                  <span className="ticket-date">{item.gameDate.replaceAll("-", ".")}</span>
                  <div className="ticket-teams">
                    <TeamBadge teamId={item.homeTeamId} size="sm" />
                    <strong>{home.shortName}</strong>
                    {score ? <em className="ticket-score">{score}</em> : <em className="ticket-vs">VS</em>}
                    <strong>{away.shortName}</strong>
                    <TeamBadge teamId={item.awayTeamId} size="sm" />
                  </div>
                  <span className="ticket-stadium">
                    <MapPin size={11} />{item.stadium} · {support.shortName} {venueLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {zoomedItem ? (
        <div
          role="dialog"
          aria-modal="true"
          className="ticket-zoom-overlay"
          onClick={() => setZoomedItem(null)}
        >
          <button className="ticket-zoom-close" type="button" aria-label="닫기" onClick={() => setZoomedItem(null)}>
            <X size={24} />
          </button>
          <div className="ticket-zoom-image-wrap" onClick={(e) => e.stopPropagation()}>
            <Image
              alt="티켓 원본"
              src={zoomedItem.signedUrl}
              width={800}
              height={1200}
              style={{ width: "100%", height: "auto", objectFit: "contain", borderRadius: 12 }}
            />
            <p className="ticket-zoom-caption">
              {zoomedItem.gameDate.replaceAll("-", ".")} · {getTeam(zoomedItem.homeTeamId).shortName} vs {getTeam(zoomedItem.awayTeamId).shortName} · {zoomedItem.stadium}
            </p>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
