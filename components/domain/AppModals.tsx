"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getTeam } from "@/lib/constants/teams";
import { createAttendanceAction, findCurrentUserAttendanceId } from "@/lib/actions/attendance";
import { createReviewAction, updateReviewAction } from "@/lib/actions/review";
import { previewTicket, registerAttendanceFromTicket } from "@/lib/actions/ticket";
import { loadAttendanceModalGamesAction } from "@/lib/actions/initialData";
import { AttendanceModal } from "@/components/domain/modals/AttendanceModal";
import { ReviewModal } from "@/components/domain/modals/ReviewModal";
import { ShareCardModal } from "@/components/domain/modals/ShareCardModal";
import { extractHashtags, getAttendanceResult, publicScopeMap, publicScopeToLabel, type PrivacyLabel } from "@/components/domain/modals/modalHelpers";
import { useDragScroll } from "@/components/domain/modals/useDragScroll";
import { useAppState } from "@/lib/state/AppState";
import { uploadUserFile } from "@/lib/supabase/storage-client";
import type { Game, Review } from "@/lib/types/domain";

export type ModalKind = "attendance" | "review" | "share" | null;

type AppModalsProps = {
  open: ModalKind;
  setOpen: (open: ModalKind) => void;
  /** SSR 등에서 미리 받아둔 games. 없으면 모달 열 때 lazy fetch. */
  initialGames?: Game[];
  initialGameId?: string;
  initialDate?: string;
  initialAttendanceId?: string;
  /** 후기 수정 모드: 전달되면 review 모달이 수정 흐름으로 전환됨 */
  editReview?: Review | null;
};

export function AppModals({ open, setOpen, initialGames, initialGameId, initialDate, initialAttendanceId, editReview = null }: AppModalsProps) {
  const { addAttendance, addReview, attendances, reviews, profile, publicScope: defaultPublicScope, isAnonymous, showToast } = useAppState();
  const router = useRouter();
  // games는 모달 열 때 lazy fetch (홈 SSR에서 빼서 첫 진입 시간 단축).
  // initialGames가 있으면 그대로 사용, 없으면 모달 열릴 때 한 번만 server action 호출.
  const [games, setGames] = useState<Game[]>(initialGames ?? []);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedGameId, setSelectedGameId] = useState(initialGames?.[0]?.id ?? "");
  const [supportTeamId, setSupportTeamId] = useState("lg");
  const [ticketFileName, setTicketFileName] = useState("");
  const [processingTicket, setProcessingTicket] = useState(false);
  // Vision으로 미리 분석된 티켓 정보. 등록 시 hash dedup + ticket 인증 흐름에 사용.
  const [ticketPreview, setTicketPreview] = useState<{
    imageBase64: string;
    mimeType: string;
    hash: string;
    gameId: string;
    homeTeamId: string;
    awayTeamId: string;
  } | null>(null);
  const [reviewBody, setReviewBody] = useState("");
  const [privacy, setPrivacy] = useState<PrivacyLabel>("전체 공개");
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [reviewPhotoFiles, setReviewPhotoFiles] = useState<Array<{ src: string; file: File }>>([]);
  const [selectedReviewAttendanceId, setSelectedReviewAttendanceId] = useState("");
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const attendanceDrag = useDragScroll<HTMLDivElement>();
  const gamesOnSelectedDate = useMemo(() => {
    const dotDate = selectedDate.replaceAll("-", ".");
    const filtered = games.filter((game) => game.date === dotDate);
    return [...filtered].sort((a, b) => {
      const aIsMine = a.homeTeamId === profile.mainTeamId || a.awayTeamId === profile.mainTeamId;
      const bIsMine = b.homeTeamId === profile.mainTeamId || b.awayTeamId === profile.mainTeamId;
      if (aIsMine === bIsMine) return 0;
      return aIsMine ? -1 : 1;
    });
  }, [games, profile.mainTeamId, selectedDate]);
  const selectedGame = useMemo(
    () => gamesOnSelectedDate.find((game) => game.id === selectedGameId) ?? gamesOnSelectedDate[0],
    [gamesOnSelectedDate, selectedGameId]
  );
  const reviewableAttendances = useMemo(() => {
    const reviewedIds = new Set(reviews.map((r) => r.attendanceId).filter(Boolean));
    return attendances
      .filter((attendance) => Boolean(attendance.result) && !reviewedIds.has(attendance.id))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date)); // 왼쪽=오래된, 오른쪽=최신
  }, [attendances, reviews]);
  const selectedReviewAttendance = useMemo(() => {
    if (editReview) {
      return attendances.find((a) => a.id === selectedReviewAttendanceId)
        ?? attendances.find((a) => a.id === editReview.attendanceId);
    }
    return reviewableAttendances.find((attendance) => attendance.id === selectedReviewAttendanceId) ?? reviewableAttendances[0];
  }, [attendances, editReview, reviewableAttendances, selectedReviewAttendanceId]);
  const onClose = () => setOpen(null);
  const selectGameAndTeam = (gameId: string, teamId: string) => {
    setSelectedGameId(gameId);
    setSupportTeamId(teamId);
  };
  const selectReviewAttendance = useCallback((attendance: typeof reviewableAttendances[number]) => {
    setSelectedReviewAttendanceId(attendance.id);
    setSelectedDate(attendance.date.replaceAll(".", "-"));
    setSupportTeamId(attendance.supportTeamId ?? profile.mainTeamId);

    const matchedGame = games.find((game) => (
      game.date === attendance.date
      && (
        (game.homeTeamId === attendance.homeTeamId && game.awayTeamId === attendance.awayTeamId)
        || (game.homeTeamId === attendance.awayTeamId && game.awayTeamId === attendance.homeTeamId)
      )
    ));
    if (matchedGame) {
      setSelectedGameId(matchedGame.id);
    }
  }, [games, profile.mainTeamId]);

  const handleTicketFileChange = async (file: File | null) => {
    if (!file) return;
    setTicketFileName(file.name);
    setTicketPreview(null);
    setProcessingTicket(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const imageBase64 = btoa(binary);
      const mimeType = file.type || "image/jpeg";

      const result = await previewTicket({ imageBase64, mimeType });
      if (!result.ok) {
        showToast(result.reason);
        setTicketFileName("");
        return;
      }

      setSelectedDate(result.gameDate);
      setSelectedGameId(result.gameId);
      if (result.suggestedSupportTeamId) {
        setSupportTeamId(result.suggestedSupportTeamId);
      } else {
        setSupportTeamId(result.homeTeamId);
        showToast("응원팀을 직접 선택해 주세요.");
      }
      setTicketPreview({
        imageBase64,
        mimeType,
        hash: result.hash,
        gameId: result.gameId,
        homeTeamId: result.homeTeamId,
        awayTeamId: result.awayTeamId
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "티켓 인식 실패");
      setTicketFileName("");
    } finally {
      setProcessingTicket(false);
    }
  };

  useEffect(() => {
    if (open !== "attendance") {
      return;
    }
    if (initialGameId && games.some((game) => game.id === initialGameId)) {
      setSelectedGameId(initialGameId);
    }
    if (initialDate) {
      setSelectedDate(initialDate.replaceAll(".", "-"));
    }
  }, [games, initialDate, initialGameId, open]);

  // attendance / review 모달이 열릴 때 games가 비어 있으면 server action으로 lazy fetch.
  // 한 번 받아오면 세션 내내 재사용 — 모달 닫고 다시 열어도 캐시.
  useEffect(() => {
    if (open !== "attendance" && open !== "review") return;
    if (games.length > 0 || gamesLoading) return;
    setGamesLoading(true);
    loadAttendanceModalGamesAction()
      .then((data) => {
        setGames(data);
      })
      .catch(() => {
        showToast("경기 목록을 불러오지 못했어요.");
      })
      .finally(() => {
        setGamesLoading(false);
      });
  }, [open, games.length, gamesLoading, showToast]);

  // 날짜 변경 시 해당 날짜의 첫 경기를 자동 선택
  useEffect(() => {
    if (open !== "attendance") return;
    if (gamesOnSelectedDate.length === 0) {
      setSelectedGameId("");
      return;
    }
    if (!gamesOnSelectedDate.some((g) => g.id === selectedGameId)) {
      const first = gamesOnSelectedDate[0];
      setSelectedGameId(first.id);
      // 우리 팀 경기면 우리 팀을 응원팀 기본값으로
      const myTeamIsHome = first.homeTeamId === profile.mainTeamId;
      const myTeamIsAway = first.awayTeamId === profile.mainTeamId;
      setSupportTeamId(myTeamIsHome || myTeamIsAway ? profile.mainTeamId : first.homeTeamId);
    }
  }, [gamesOnSelectedDate, open, profile.mainTeamId, selectedGameId]);

  useEffect(() => {
    if (open !== "review" || reviewableAttendances.length === 0) {
      return;
    }
    if (editReview?.attendanceId) {
      // 수정 모드: 그 attendance가 reviewableAttendances에 없을 가능성 → attendances에서 찾아서 selectedReviewAttendanceId만 직접 세팅
      const target = reviewableAttendances.find((a) => a.id === editReview.attendanceId)
        ?? attendances.find((a) => a.id === editReview.attendanceId);
      if (target) {
        setSelectedReviewAttendanceId(target.id);
      }
      return;
    }
    if (initialAttendanceId) {
      const target = reviewableAttendances.find((attendance) => attendance.id === initialAttendanceId);
      if (target) {
        selectReviewAttendance(target);
        return;
      }
    }
    if (!reviewableAttendances.some((attendance) => attendance.id === selectedReviewAttendanceId)) {
      selectReviewAttendance(reviewableAttendances[0]);
    }
  }, [attendances, editReview, initialAttendanceId, open, reviewableAttendances, selectReviewAttendance, selectedReviewAttendanceId]);

  // 수정 모드: body, photos, privacy 기존 값으로 prefill
  useEffect(() => {
    if (open !== "review") return;
    if (!editReview) return;
    setReviewBody(editReview.body);
    const photos = editReview.images && editReview.images.length > 0 ? editReview.images : [editReview.image];
    setReviewPhotos(photos);
    setReviewPhotoFiles([]);
    setPrivacy(publicScopeToLabel(editReview.publicScope));
  }, [open, editReview]);

  // 작성 모드: 사용자 설정의 기본 공개 범위를 초기값으로 사용
  useEffect(() => {
    if (open !== "review" || editReview) return;
    setPrivacy(defaultPublicScope as PrivacyLabel);
  }, [defaultPublicScope, editReview, open]);

  const submitAttendance = async () => {
    if (!selectedGame) {
      showToast("경기를 먼저 선택해주세요.");
      return;
    }
    const attendance = {
      date: selectedDate.replaceAll("-", "."),
      stadium: selectedGame.stadium,
      homeTeamId: selectedGame.homeTeamId,
      awayTeamId: selectedGame.awayTeamId,
      supportTeamId,
      score: selectedGame.status === "finished" ? `${selectedGame.homeScore ?? 0} : ${selectedGame.awayScore ?? 0}` : "경기전",
      result: getAttendanceResult(selectedGame, supportTeamId),
      verified: Boolean(ticketFileName)
    };

    setSavingAttendance(true);
    try {
      if (ticketPreview) {
        // 티켓 흐름: Vision 인증 + Storage 업로드 + DB insert를 server action 한 번에
        const result = await registerAttendanceFromTicket({
          imageBase64: ticketPreview.imageBase64,
          mimeType: ticketPreview.mimeType,
          supportTeamId
        });
        if (!result.ok) {
          showToast(result.reason);
          setSavingAttendance(false);
          return;
        }
        addAttendance({ ...attendance, id: result.attendanceId, verified: true });
        showToast("티켓 인증 직관 등록 완료!");
      } else {
        // 수동 흐름
        const result = await createAttendanceAction({
          date: attendance.date,
          homeTeamId: attendance.homeTeamId,
          awayTeamId: attendance.awayTeamId,
          supportTeamId
        });
        addAttendance({ ...attendance, id: result.attendanceId });
        showToast("직관을 DB에 저장했어요.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "직관 저장에 실패했습니다.";
      if (message.includes("로그인")) {
        addAttendance(attendance);
        showToast("로그인 전이라 mock 기록으로 저장했어요.");
      } else {
        showToast(message);
        setSavingAttendance(false);
        return;
      }
    }
    setSavingAttendance(false);
    setTicketFileName("");
    setTicketPreview(null);
    setOpen(null);
    router.refresh();
  };

  const submitReview = async () => {
    if (!selectedReviewAttendance) {
      showToast("후기를 작성할 직관 경기를 선택해주세요.");
      return;
    }
    if (reviewBody.trim().length < 5) {
      showToast("후기를 5자 이상 입력해주세요.");
      return;
    }
    const reviewTeamId = selectedReviewAttendance.supportTeamId ?? profile.mainTeamId;
    const trimmedBody = reviewBody.trim();
    const review = {
      author: profile.nickname,
      teamId: reviewTeamId,
      publicScope: publicScopeMap[privacy as keyof typeof publicScopeMap] ?? "public",
      title: "",
      body: trimmedBody,
      gameLabel: `${selectedReviewAttendance.date} · ${getTeam(selectedReviewAttendance.homeTeamId).shortName} ${selectedReviewAttendance.score} ${getTeam(selectedReviewAttendance.awayTeamId).shortName}`,
      image: reviewPhotos[0] ?? "/assets/mainherobg.png",
      tags: extractHashtags(trimmedBody),
      attendanceId: selectedReviewAttendance.id
    };

    setSavingReview(true);
    try {
      const uploadedPhotos = await Promise.all(
        reviewPhotoFiles.map((item, index) => uploadUserFile("review-photos", item.file, `review-${Date.now()}-${index}`))
      );

      if (editReview) {
        // 수정 모드: 새로 업로드한 파일 + 유지하는 기존 사진들 (blob: URL은 제외)
        const keptExisting = reviewPhotos.filter((url) => !url.startsWith("blob:"));
        const persistedPhotos = [...keptExisting, ...uploadedPhotos];
        await updateReviewAction({
          reviewId: editReview.id,
          body: reviewBody.trim(),
          photos: persistedPhotos,
          publicScope: publicScopeMap[privacy as keyof typeof publicScopeMap] ?? "public"
        });
        showToast("후기를 수정했어요.");
      } else {
        const attendanceId = await findCurrentUserAttendanceId({
          date: selectedReviewAttendance.date,
          homeTeamId: selectedReviewAttendance.homeTeamId,
          awayTeamId: selectedReviewAttendance.awayTeamId
        });

        if (!attendanceId) {
          throw new Error("DB에 저장된 직관 기록을 찾지 못했습니다.");
        }

        const persistedPhotos = uploadedPhotos.length > 0 ? uploadedPhotos : reviewPhotos;
        await createReviewAction({
          attendanceId,
          body: reviewBody.trim(),
          photos: persistedPhotos,
          publicScope: publicScopeMap[privacy as keyof typeof publicScopeMap] ?? "public"
        });
        addReview({ ...review, attendanceId, image: persistedPhotos[0] ?? review.image });
        showToast("후기를 DB에 저장했어요.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "후기 저장에 실패했습니다.";
      if (!editReview && (message.includes("로그인") || message.includes("DB에 저장된 직관"))) {
        addReview(review);
        showToast("DB 연결 전이라 mock 후기로 저장했어요.");
      } else {
        showToast(message);
        setSavingReview(false);
        return;
      }
    }
    setSavingReview(false);
    setReviewBody("");
    setReviewPhotoFiles([]);
    setOpen(null);
    router.refresh();
  };

  return (
    <>
      <AttendanceModal
        open={open === "attendance"}
        onClose={onClose}
        processingTicket={processingTicket}
        ticketPreview={ticketPreview}
        ticketFileName={ticketFileName}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        gamesOnSelectedDate={gamesOnSelectedDate}
        gamesLoading={gamesLoading}
        selectedGameId={selectedGameId}
        supportTeamId={supportTeamId}
        setSupportTeamId={setSupportTeamId}
        savingAttendance={savingAttendance}
        mainTeamId={profile.mainTeamId}
        onTicketFileChange={handleTicketFileChange}
        onSelectGameAndTeam={selectGameAndTeam}
        onSubmit={submitAttendance}
      />

      <ReviewModal
        open={open === "review"}
        onClose={onClose}
        editReview={editReview}
        reviewPhotos={reviewPhotos}
        setReviewPhotos={setReviewPhotos}
        setReviewPhotoFiles={setReviewPhotoFiles}
        selectedReviewAttendance={selectedReviewAttendance}
        reviewableAttendances={reviewableAttendances}
        onSelectReviewAttendance={selectReviewAttendance}
        attendanceDrag={attendanceDrag}
        reviewBody={reviewBody}
        setReviewBody={setReviewBody}
        privacy={privacy}
        setPrivacy={setPrivacy}
        isAnonymous={isAnonymous}
        showToast={showToast}
        savingReview={savingReview}
        onSubmit={submitReview}
      />

      <ShareCardModal open={open === "share"} onClose={onClose} profile={profile} />
    </>
  );
}
