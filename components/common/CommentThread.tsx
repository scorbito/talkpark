"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";

export type CommentThreadItem = {
  id: string;
  userId: string;
  authorNickname: string;
  authorAvatarUrl?: string | null;
  body: string;
  timeAgo: string;
};

type CommentThreadProps = {
  comments: CommentThreadItem[];
  currentUserId: string | null;
  /** 본인 댓글 외에 삭제 가능한 다른 주체(예: 글 작성자) 판별 */
  canDeleteAsOwner?: boolean;
  /** 댓글 작성. 성공 시 부모가 낙관 업데이트한 항목을 그대로 반환해도 되고, 서버 결과로 교체해도 됨. */
  onSubmit: (body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  /** 비로그인일 때 대신 보여줄 안내 문구. 기본값 있음. */
  signedOutHint?: string;
  /** input maxLength */
  maxLength?: number;
  /** 댓글 작성자 아바타/닉네임 탭 시 프로필 모달 열기 핸들러. 없으면 클릭 불가. */
  onAuthorClick?: (userId: string) => void;
};

export function CommentThread({
  comments,
  currentUserId,
  canDeleteAsOwner = false,
  onSubmit,
  onDelete,
  signedOutHint = "로그인 후 댓글을 작성할 수 있어요.",
  maxLength = 500,
  onAuthorClick
}: CommentThreadProps) {
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const body = input.trim();
    if (!body || isPending) return;
    startTransition(async () => {
      try {
        await onSubmit(body);
        setInput("");
      } catch {
        // 부모가 토스트 등을 처리한다고 가정
      }
    });
  };

  const remove = (commentId: string) => {
    if (isPending) return;
    startTransition(async () => {
      try {
        await onDelete(commentId);
      } catch {
        // 부모가 토스트 등을 처리한다고 가정
      }
    });
  };

  return (
    <section id="comments" className="comments-section">
      <h2 className="comments-heading">댓글 ({comments.length})</h2>
      <ul className="comments-list">
        {comments.length === 0 ? (
          <li className="comments-empty">첫 댓글을 남겨보세요!</li>
        ) : (
          comments.map((c) => {
            const canDelete = Boolean(currentUserId && (c.userId === currentUserId || canDeleteAsOwner));
            const avatar = c.authorAvatarUrl ? (
              <span className="comment-avatar">
                <Image alt="" src={c.authorAvatarUrl} fill sizes="26px" style={{ objectFit: "cover" }} />
              </span>
            ) : (
              <span className="comment-avatar comment-avatar-initial">
                {(c.authorNickname || "?").slice(0, 1)}
              </span>
            );
            return (
              <li className="comment-item" key={c.id}>
                {onAuthorClick ? (
                  <button
                    type="button"
                    className="profile-author-trigger comment-author-trigger"
                    aria-label={`${c.authorNickname}님의 프로필 보기`}
                    onClick={() => onAuthorClick(c.userId)}
                  >
                    {avatar}
                  </button>
                ) : (
                  avatar
                )}
                <div className="comment-body">
                  <div className="comment-meta">
                    {onAuthorClick ? (
                      <button
                        type="button"
                        className="profile-author-trigger"
                        aria-label={`${c.authorNickname}님의 프로필 보기`}
                        onClick={() => onAuthorClick(c.userId)}
                      >
                        <strong>{c.authorNickname}</strong>
                      </button>
                    ) : (
                      <strong>{c.authorNickname}</strong>
                    )}
                    <span>{c.timeAgo}</span>
                  </div>
                  <p>{c.body}</p>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    className="comment-delete"
                    aria-label="댓글 삭제"
                    disabled={isPending}
                    onClick={() => remove(c.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      {currentUserId ? (
        <div className="comment-input-row">
          <input
            type="text"
            placeholder="댓글을 입력하세요"
            value={input}
            maxLength={maxLength}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={isPending}
          />
          <button type="button" onClick={submit} disabled={isPending || !input.trim()}>
            등록
          </button>
        </div>
      ) : (
        <p className="comments-empty">{signedOutHint}</p>
      )}
    </section>
  );
}
