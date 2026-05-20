"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, X } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { Button } from "@/components/common/Button";
import { verifyAttendanceWithTicket } from "@/lib/actions/ticket";
import { useAppState } from "@/lib/state/AppState";

type Props = {
  open: boolean;
  attendanceId: string | null;
  gameLabel?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

async function fileToBase64(file: File): Promise<{ imageBase64: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = document.createElement("img");
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
    img.src = dataUrl;
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지 변환을 준비하지 못했어요.");
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("이미지 변환에 실패했어요.");

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { imageBase64: btoa(binary), mimeType: "image/jpeg" };
}

export function VerifyTicketModal({ open, attendanceId, gameLabel, onClose, onSuccess }: Props) {
  const { showToast, markAttendanceVerified } = useAppState();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (picked.size > 8 * 1024 * 1024) {
      showToast("티켓 사진은 8MB 이하여야 해요.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const handleSubmit = async () => {
    if (!file || !attendanceId) return;
    setSubmitting(true);
    try {
      const { imageBase64, mimeType } = await fileToBase64(file);
      const result = await verifyAttendanceWithTicket({
        attendanceId,
        imageBase64,
        mimeType
      });
      if (!result.ok) {
        showToast(result.reason);
        setSubmitting(false);
        return;
      }
      markAttendanceVerified?.(attendanceId);
      showToast("티켓 인증이 완료됐어요!");
      reset();
      onClose();
      onSuccess?.();
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "인증 처리 중 오류가 발생했어요.");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell open={open} title="티켓 인증" onClose={handleClose} panelClassName="dark-confirm-panel">
      <div className="verify-ticket">
        {gameLabel ? <p className="verify-ticket-label">{gameLabel} 경기 직관</p> : null}
        <p className="verify-ticket-help">
          이 직관의 티켓 사진을 올려주세요. <br />
          AI가 자동으로 경기 정보를 확인해 인증해드려요.<br />
          인증된 티켓은 티켓 컬렉션에 보관됩니다.
        </p>

        {previewUrl ? (
          <div className="verify-ticket-preview">
            <Image src={previewUrl} alt="티켓 미리보기" width={320} height={200} style={{ width: "100%", height: "auto", borderRadius: 12 }} />
            <button type="button" className="verify-ticket-clear" aria-label="사진 다시 선택" onClick={() => {
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setFile(null);
              setPreviewUrl(null);
            }} disabled={submitting}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className={`verify-ticket-picker${submitting ? " is-disabled" : ""}`}>
            <Camera size={20} />
            <span>티켓 사진 선택</span>
            <input type="file" accept="image/*" onChange={handlePick} disabled={submitting} />
          </label>
        )}

        <div className="verify-ticket-tips">
          <span>📌 인식이 잘 되려면</span>
          <ul>
            <li>티켓 전체가 잘리지 않게 찍어주세요</li>
            <li>날짜·구장·팀 이름이 또렷하게 보여야 해요</li>
            <li>전자 티켓 캡처도 가능해요</li>
          </ul>
        </div>

        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={handleClose} disabled={submitting}>
            취소
          </button>
          <Button onClick={handleSubmit} disabled={!file || submitting}>
            {submitting ? "분석 중..." : (
              <>
                <CheckCircle2 size={16} />
                인증하기
              </>
            )}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
