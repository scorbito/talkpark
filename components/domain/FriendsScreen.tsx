"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Inbox, Lock, Search, UserMinus, UserPlus, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/common/Button";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { useAppState } from "@/lib/state/AppState";
import {
  deleteFriendAction,
  respondFriendRequestAction,
  searchProfilesByNicknameAction,
  sendFriendRequestAction,
  type FriendCandidate
} from "@/lib/actions/friends";
import type { FriendListItem, IncomingFriendRequest } from "@/lib/supabase/queries";

type FriendsScreenProps = {
  initialIncomingRequests: IncomingFriendRequest[];
  initialFriends: FriendListItem[];
};

type Tab = "친구" | "요청" | "추천";

export function FriendsScreen({ initialIncomingRequests, initialFriends }: FriendsScreenProps) {
  const { isAnonymous, showToast } = useAppState();
  const [tab, setTab] = useState<Tab>("친구");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState(initialIncomingRequests);
  const [friends, setFriends] = useState(initialFriends);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FriendListItem | null>(null);
  const debounceRef = useRef<number | null>(null);

  // 검색어 입력 → 300ms 디바운스 후 server action 호출
  useEffect(() => {
    if (isAnonymous) return;
    const trimmed = query.trim();
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const results = await searchProfilesByNicknameAction(trimmed);
        setSearchResults(results);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "검색에 실패했어요.");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query, isAnonymous, showToast]);

  if (isAnonymous) {
    return (
      <AppShell activeTab="my" title="친구 관리" theme="dark" backHref="/my">
        <div className="empty-state-large">
          <div className="empty-state-icon"><Lock size={28} /></div>
          <p>
            친구 관리는 정식 계정 전환 후 이용할 수 있어요.<br />
            카카오·Google·이메일로 전환하면 그동안 쌓은 기록은 그대로 유지됩니다.
          </p>
          <Link className="upgrade-cta" href="/login" prefetch>정식 계정으로 전환</Link>
        </div>
      </AppShell>
    );
  }

  const handleSendRequest = (candidate: FriendCandidate) => {
    setBusyId(candidate.userId);
    startTransition(async () => {
      try {
        await sendFriendRequestAction(candidate.userId);
        // 검색 결과에서 해당 항목의 relationship 을 requested 로 업데이트
        setSearchResults((current) =>
          current.map((item) =>
            item.userId === candidate.userId ? { ...item, relationship: "requested" } : item
          )
        );
        showToast(`${candidate.nickname}님에게 친구 요청을 보냈어요.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "친구 요청에 실패했어요.");
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleRespond = (request: IncomingFriendRequest, status: "accepted" | "rejected") => {
    setBusyId(request.requestId);
    startTransition(async () => {
      try {
        await respondFriendRequestAction(request.requestId, status);
        setIncomingRequests((current) => current.filter((r) => r.requestId !== request.requestId));
        if (status === "accepted") {
          setFriends((current) =>
            current.some((f) => f.userId === request.fromUser.userId) ? current : [request.fromUser, ...current]
          );
          showToast(`${request.fromUser.nickname}님과 친구가 됐어요.`);
        } else {
          showToast("친구 요청을 거절했어요.");
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : "요청 처리에 실패했어요.");
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleDeleteFriend = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.userId);
    startTransition(async () => {
      try {
        await deleteFriendAction(target.userId);
        setFriends((current) => current.filter((friend) => friend.userId !== target.userId));
        setDeleteTarget(null);
        setSearchResults((current) =>
          current.map((item) =>
            item.userId === target.userId ? { ...item, relationship: "none" } : item
          )
        );
        showToast(`${target.nickname}님을 친구 목록에서 삭제했어요.`);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "친구 삭제에 실패했어요.");
      } finally {
        setBusyId(null);
      }
    });
  };

  const renderAvatar = (item: FriendListItem | FriendCandidate) => {
    if (item.avatarUrl) {
      return (
        <span className="friend-avatar">
          <Image alt="" src={item.avatarUrl} fill sizes="42px" style={{ objectFit: "cover" }} />
        </span>
      );
    }
    return <TeamBadge teamId={item.mainTeamId} size="md" />;
  };

  const trimmedQuery = query.trim();
  const showingSearch = trimmedQuery.length > 0;

  return (
    <AppShell activeTab="my" title="친구 관리" theme="dark" backHref="/my">
      <div className="friend-search">
        <Search size={16} />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="닉네임으로 친구 찾기"
          aria-label="친구 닉네임 검색"
        />
      </div>
      {showingSearch ? (
        <section className="friend-list">
          <h3 className="friend-section-title">
            검색 결과 {searching ? "..." : `(${searchResults.length})`}
          </h3>
          {searchResults.map((candidate) => {
            const isBusy = busyId === candidate.userId && isPending;
            return (
              <article className="friend-row" key={candidate.userId}>
                {renderAvatar(candidate)}
                <div>
                  <strong>{candidate.nickname}</strong>
                </div>
                {candidate.relationship === "friend" ? (
                  <button type="button" className="friend-action-done" disabled>
                    <Check size={14} /> 친구
                  </button>
                ) : candidate.relationship === "requested" ? (
                  <button type="button" className="friend-action-done" disabled>
                    <Check size={14} /> 신청됨
                  </button>
                ) : candidate.relationship === "incoming" ? (
                  <button type="button" className="friend-action-done" disabled>
                    요청 받음
                  </button>
                ) : (
                  <button type="button" disabled={isBusy} onClick={() => handleSendRequest(candidate)}>
                    <UserPlus size={14} /> {isBusy ? "..." : "신청하기"}
                  </button>
                )}
              </article>
            );
          })}
          {!searching && searchResults.length === 0 ? (
            <p className="empty-inline">일치하는 사용자가 없어요.</p>
          ) : null}
        </section>
      ) : (
        <>
          <div className="segmented-control">
            {(["친구", "요청", "추천"] as Tab[]).map((item) => (
              <button
                className={tab === item ? "segment segment-active" : "segment"}
                key={item}
                type="button"
                onClick={() => setTab(item)}
              >
                {item}
                {item === "요청" && incomingRequests.length > 0 ? (
                  <span className="segment-badge">{incomingRequests.length}</span>
                ) : null}
              </button>
            ))}
          </div>
          <section className="friend-list">
            {tab === "친구" ? (
              friends.length === 0 ? (
                <div className="empty-state-large">
                  <div className="empty-state-icon"><UserPlus size={32} strokeWidth={1.8} /></div>
                  <p>아직 친구가 없어요.<br />닉네임으로 친구를 찾아 신청해보세요.</p>
                </div>
              ) : (
                friends.map((friend) => (
                  <article className="friend-row friend-row-compact" key={friend.userId}>
                    {renderAvatar(friend)}
                    <div>
                      <strong>{friend.nickname}</strong>
                    </div>
                    <button
                      type="button"
                      className="friend-action-remove"
                      aria-label={`${friend.nickname} 친구 삭제`}
                      title="친구 삭제"
                      disabled={busyId === friend.userId && isPending}
                      onClick={() => setDeleteTarget(friend)}
                    >
                      <UserMinus size={15} />
                    </button>
                  </article>
                ))
              )
            ) : null}

            {tab === "요청" ? (
              incomingRequests.length === 0 ? (
                <div className="empty-state-large">
                  <div className="empty-state-icon"><Inbox size={32} strokeWidth={1.8} /></div>
                  <p>처리할 친구 요청이 없어요.</p>
                </div>
              ) : (
                incomingRequests.map((request) => {
                  const isBusy = busyId === request.requestId && isPending;
                  return (
                    <article className="friend-row" key={request.requestId}>
                      {renderAvatar(request.fromUser)}
                      <div>
                        <strong>{request.fromUser.nickname}</strong>
                      </div>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRespond(request, "accepted")}
                      >
                        <Check size={14} /> 수락
                      </button>
                      <button
                        type="button"
                        className="friend-action-done"
                        disabled={isBusy}
                        onClick={() => handleRespond(request, "rejected")}
                      >
                        <X size={14} /> 거절
                      </button>
                    </article>
                  );
                })
              )
            ) : null}

            {tab === "추천" ? (
              <div className="empty-state-large">
                <div className="empty-state-icon"><UserPlus size={32} strokeWidth={1.8} /></div>
                <p>추천 기능은 곧 추가될 예정이에요.<br />지금은 닉네임 검색으로 친구를 찾아보세요.</p>
              </div>
            ) : null}
          </section>
        </>
      )}
      <ModalShell
        open={Boolean(deleteTarget)}
        title="친구 삭제"
        onClose={() => setDeleteTarget(null)}
        panelClassName="dark-confirm-panel"
      >
        <div className="confirm-stack">
          <p>{deleteTarget?.nickname}님을 친구 목록에서 삭제할까요?</p>
          <span className="confirm-hint">서로의 친구 공개 후기를 더 이상 볼 수 없어요.</span>
          <div className="confirm-actions">
            <button
              type="button"
              className="confirm-cancel"
              disabled={Boolean(deleteTarget && busyId === deleteTarget.userId && isPending)}
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </button>
            <Button
              disabled={Boolean(deleteTarget && busyId === deleteTarget.userId && isPending)}
              onClick={handleDeleteFriend}
            >
              {deleteTarget && busyId === deleteTarget.userId && isPending ? "삭제 중" : "삭제하기"}
            </Button>
          </div>
        </div>
      </ModalShell>
    </AppShell>
  );
}
