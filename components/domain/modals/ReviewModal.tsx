"use client";

import Image from "next/image";
import type { Dispatch, SetStateAction } from "react";
import { Globe2, Lock, Plus, Users } from "lucide-react";
import { Button } from "@/components/common/Button";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { AttendanceRecord } from "@/lib/state/AppState";
import type { Review } from "@/lib/types/domain";
import type { PrivacyLabel } from "./modalHelpers";
import type { useDragScroll } from "./useDragScroll";

type ReviewModalProps = {
  open: boolean;
  onClose: () => void;
  editReview: Review | null;
  reviewPhotos: string[];
  setReviewPhotos: Dispatch<SetStateAction<string[]>>;
  setReviewPhotoFiles: Dispatch<SetStateAction<Array<{ src: string; file: File }>>>;
  selectedReviewAttendance?: AttendanceRecord;
  reviewableAttendances: AttendanceRecord[];
  onSelectReviewAttendance: (attendance: AttendanceRecord) => void;
  attendanceDrag: ReturnType<typeof useDragScroll<HTMLDivElement>>;
  reviewBody: string;
  setReviewBody: (value: string) => void;
  privacy: string;
  setPrivacy: (value: PrivacyLabel) => void;
  isAnonymous: boolean;
  showToast: (message: string) => void;
  savingReview: boolean;
  onSubmit: () => void;
};

export function ReviewModal({
  open,
  onClose,
  editReview,
  reviewPhotos,
  setReviewPhotos,
  setReviewPhotoFiles,
  selectedReviewAttendance,
  reviewableAttendances,
  onSelectReviewAttendance,
  attendanceDrag,
  reviewBody,
  setReviewBody,
  privacy,
  setPrivacy,
  isAnonymous,
  showToast,
  savingReview,
  onSubmit
}: ReviewModalProps) {
  return (
    <ModalShell open={open} title={editReview ? "후기 수정" : "후기 작성"} onClose={onClose} panelClassName="review-modal-panel">
      <div className="form-stack">
        <p className="photo-strip-hint">사진은 최대 3장까지 추가할 수 있어요. ({reviewPhotos.length}/3)</p>
        <div className="photo-strip">
          {reviewPhotos.map((photo) => (
            <button
              className="photo-preview-button"
              key={photo}
              type="button"
              onClick={() => {
                setReviewPhotos((current) => current.filter((item) => item !== photo));
                setReviewPhotoFiles((current) => current.filter((item) => item.src !== photo));
              }}
            >
              <Image alt="후기 사진" height={126} src={photo} unoptimized={photo.startsWith("blob:")} width={92} />
            </button>
          ))}
          {reviewPhotos.length < 3 ? (
            <label className="photo-add-button">
              <Plus size={24} />추가
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []).slice(0, 3 - reviewPhotos.length);
                  if (files.length === 0) {
                    return;
                  }
                  const previews = files.map((file) => ({ src: URL.createObjectURL(file), file }));
                  setReviewPhotoFiles((current) => [...current, ...previews].slice(0, 3));
                  setReviewPhotos((current) => [
                    ...current,
                    ...previews.map((item) => item.src)
                  ].slice(0, 3));
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
        {editReview && selectedReviewAttendance ? (
          <div className="review-attendance-picker">
            <span>직관 경기 (수정 불가)</span>
            <div className="review-attendance-locked">
              <span className="review-attendance-date">{selectedReviewAttendance.date}</span>
              <div className="review-attendance-teams">
                <span>
                  <TeamBadge teamId={selectedReviewAttendance.homeTeamId} size="sm" />
                  <b>{getTeam(selectedReviewAttendance.homeTeamId).shortName}</b>
                </span>
                <span>
                  <TeamBadge teamId={selectedReviewAttendance.awayTeamId} size="sm" />
                  <b>{getTeam(selectedReviewAttendance.awayTeamId).shortName}</b>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="review-attendance-picker">
            <span>1. 직관 경기 선택</span>
            <p className="review-attendance-help">경기 종료된 직관마다 후기는 1개씩 작성할 수 있어요.</p>
            <div className="review-attendance-list" ref={attendanceDrag.ref} onPointerDown={attendanceDrag.onPointerDown} onPointerMove={attendanceDrag.onPointerMove} onPointerUp={attendanceDrag.onPointerUp} onPointerLeave={attendanceDrag.onPointerLeave} onPointerCancel={attendanceDrag.onPointerCancel} onClickCapture={attendanceDrag.onClickCapture}>
              {reviewableAttendances.map((attendance) => (
                <button
                  className={selectedReviewAttendance?.id === attendance.id ? "review-attendance-option review-attendance-option-active" : "review-attendance-option"}
                  key={attendance.id}
                  type="button"
                  onClick={() => onSelectReviewAttendance(attendance)}
                >
                  <span className="review-attendance-date">{attendance.date}</span>
                  <div className="review-attendance-teams">
                    <span>
                      <TeamBadge teamId={attendance.homeTeamId} size="sm" />
                      <b>{getTeam(attendance.homeTeamId).shortName}</b>
                    </span>
                    <span>
                      <TeamBadge teamId={attendance.awayTeamId} size="sm" />
                      <b>{getTeam(attendance.awayTeamId).shortName}</b>
                    </span>
                  </div>
                </button>
              ))}
              {reviewableAttendances.length === 0 ? (
                <p className="review-attendance-empty">
                  후기를 쓸 수 있는 직관이 없어요.<br />
                  경기 종료 전이거나 이미 후기를 작성한 직관은 목록에 표시되지 않아요.
                </p>
              ) : null}
            </div>
          </div>
        )}
        <label className="textarea-field review-body-field">
          <span className="review-body-label">{editReview ? "후기 내용" : "2. 후기 내용"}</span>
          <textarea value={reviewBody} placeholder="오늘 경기 어땠나요? 생생한 후기를 남겨주세요!" onChange={(event) => setReviewBody(event.target.value)} />
        </label>
        <div className="privacy-row">
          {[
            { label: "전체 공개", icon: Globe2, anonAllowed: true },
            { label: "친구 공개", icon: Users, anonAllowed: false },
            { label: "나만 보기", icon: Lock, anonAllowed: false }
          ].map((item) => {
            const Icon = item.icon;
            const disabled = isAnonymous && !item.anonAllowed;
            return (
              <button
                className={privacy === item.label ? "privacy-active" : ""}
                key={item.label}
                type="button"
                disabled={disabled}
                title={disabled ? "정식 계정 전환 시 사용 가능" : undefined}
                onClick={() => {
                  if (disabled) {
                    showToast("정식 계정으로 전환하면 사용할 수 있어요.");
                    return;
                  }
                  setPrivacy(item.label as PrivacyLabel);
                }}
              >
                <Icon size={16} />{item.label}
              </button>
            );
          })}
        </div>
        <Button disabled={savingReview} onClick={onSubmit}>
          {editReview ? (savingReview ? "수정 중" : "수정하기") : (savingReview ? "저장 중" : "등록하기")}
        </Button>
      </div>
    </ModalShell>
  );
}
