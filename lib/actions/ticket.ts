"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTicketWithGemini } from "@/lib/server/vision/parseTicket";
import { grantXpEvent, XP_VALUES } from "@/lib/season-level/events";

export type TicketRegisterInput = {
  /** browser에서 base64로 인코딩한 이미지 (data: 접두사 없이 순수 base64) */
  imageBase64: string;
  mimeType: string;
  /** 사용자가 응원팀을 직접 선택한 경우 (재호출 시) */
  supportTeamId?: string;
  memo?: string;
};

export type TicketRegisterResult =
  | {
      ok: true;
      attendanceId: string;
      gameLabel: string;
    }
  | {
      ok: false;
      reason: string;
    }
  | {
      /** Vision 매칭은 됐는데 응원팀을 결정할 수 없어 사용자 선택 필요 */
      ok: false;
      needsSupportTeam: true;
      reason: "support-team-required";
      gameId: string;
      gameDate: string;
      homeTeamId: string;
      awayTeamId: string;
    };

function sha256Base64(base64: string): string {
  const buffer = Buffer.from(base64, "base64");
  return createHash("sha256").update(buffer).digest("hex");
}

export type TicketParsePreview =
  | {
      ok: true;
      hash: string;
      gameId: string;
      gameDate: string;        // YYYY-MM-DD
      homeTeamId: string;
      awayTeamId: string;
      stadium: string;
      /** 사용자 mainTeamId가 경기에 있으면 자동 결정된 응원팀 (없으면 undefined → UI에서 직접 선택) */
      suggestedSupportTeamId?: string;
    }
  | { ok: false; reason: string };

/**
 * 티켓 사진을 분석하기만 함 (DB 쓰기 없음). 모달 자동 채우기 용도.
 * 실제 등록은 사용자가 등록 버튼을 누를 때 createAttendanceAction을 호출.
 */
export async function previewTicket(input: { imageBase64: string; mimeType: string }): Promise<TicketParsePreview> {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, reason: "로그인이 필요합니다." };
  }
  const admin = createSupabaseAdminClient();
  const userId = authData.user.id;

  // hash dedup만 미리 알려주기 (사용자가 등록 시도하기 전에 차단)
  const hash = sha256Base64(input.imageBase64);
  const { data: existing } = await admin
    .from("attendances")
    .select("id, user_id")
    .eq("ticket_image_hash", hash)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      reason: existing.user_id === userId
        ? "이미 등록된 티켓이에요."
        : "다른 사용자가 이미 인증한 티켓이에요."
    };
  }

  const visionResult = await parseTicketWithGemini(input.imageBase64, input.mimeType);
  if (!visionResult.ok) {
    return { ok: false, reason: visionResult.reason };
  }

  const { data: game } = await admin
    .from("games")
    .select("id, game_date, home_team_id, away_team_id, stadium")
    .eq("game_date", visionResult.gameDate)
    .or(
      `and(home_team_id.eq.${visionResult.homeTeamId},away_team_id.eq.${visionResult.awayTeamId}),` +
      `and(home_team_id.eq.${visionResult.awayTeamId},away_team_id.eq.${visionResult.homeTeamId})`
    )
    .limit(1)
    .maybeSingle();
  if (!game) {
    return {
      ok: false,
      reason: `${visionResult.gameDate} ${visionResult.homeTeamId.toUpperCase()} vs ${visionResult.awayTeamId.toUpperCase()} 경기를 찾지 못했어요.`
    };
  }

  // 응원팀 추천: 사용자 mainTeamId가 경기에 있으면 그것
  const { data: profile } = await admin
    .from("profiles")
    .select("main_team_id")
    .eq("id", userId)
    .maybeSingle();
  const mainTeamId = profile?.main_team_id;
  const suggestedSupportTeamId =
    mainTeamId && (game.home_team_id === mainTeamId || game.away_team_id === mainTeamId)
      ? mainTeamId
      : undefined;

  return {
    ok: true,
    hash,
    gameId: game.id,
    gameDate: game.game_date,
    homeTeamId: game.home_team_id,
    awayTeamId: game.away_team_id,
    stadium: game.stadium,
    suggestedSupportTeamId
  };
}

export async function registerAttendanceFromTicket(input: TicketRegisterInput): Promise<TicketRegisterResult> {
  // 1. 인증
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, reason: "로그인이 필요합니다." };
  }

  const admin = createSupabaseAdminClient();
  const userId = authData.user.id;

  // 2. 해시 dedup (가장 빠르고 비용 안 드는 차단)
  const hash = sha256Base64(input.imageBase64);
  const { data: existing, error: dupErr } = await admin
    .from("attendances")
    .select("id, user_id")
    .eq("ticket_image_hash", hash)
    .maybeSingle();
  if (dupErr) {
    return { ok: false, reason: `중복 검사 실패: ${dupErr.message}` };
  }
  if (existing) {
    if (existing.user_id === userId) {
      return { ok: false, reason: "이미 등록된 티켓이에요." };
    }
    return { ok: false, reason: "다른 사용자가 이미 인증한 티켓이에요." };
  }

  // 3. Vision 파싱
  const visionResult = await parseTicketWithGemini(input.imageBase64, input.mimeType);
  if (!visionResult.ok) {
    return { ok: false, reason: visionResult.reason };
  }

  // 4. 매칭 게임 찾기 (홈/원정 어느 쪽이든 잡히도록)
  const { data: game, error: gameErr } = await admin
    .from("games")
    .select("id, game_date, game_time, stadium, home_team_id, away_team_id")
    .eq("game_date", visionResult.gameDate)
    .or(
      `and(home_team_id.eq.${visionResult.homeTeamId},away_team_id.eq.${visionResult.awayTeamId}),` +
      `and(home_team_id.eq.${visionResult.awayTeamId},away_team_id.eq.${visionResult.homeTeamId})`
    )
    .limit(1)
    .maybeSingle();
  if (gameErr) {
    return { ok: false, reason: `경기 조회 실패: ${gameErr.message}` };
  }
  if (!game) {
    return {
      ok: false,
      reason: `${visionResult.gameDate} ${visionResult.homeTeamId.toUpperCase()} vs ${visionResult.awayTeamId.toUpperCase()} 경기를 DB에서 찾지 못했어요.`
    };
  }

  // 5. 응원팀 결정
  // 5-1. 사용자가 명시 선택했으면 사용
  // 5-2. 그 외엔 사용자 mainTeamId가 경기에 있으면 자동
  // 5-3. 없으면 사용자에게 물어봄
  let supportTeamId = input.supportTeamId;
  if (!supportTeamId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("main_team_id")
      .eq("id", userId)
      .maybeSingle();
    const mainTeamId = profile?.main_team_id;
    if (mainTeamId && (game.home_team_id === mainTeamId || game.away_team_id === mainTeamId)) {
      supportTeamId = mainTeamId;
    } else {
      return {
        ok: false,
        needsSupportTeam: true,
        reason: "support-team-required",
        gameId: game.id,
        gameDate: game.game_date,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id
      };
    }
  } else {
    // 사용자가 보낸 응원팀이 진짜 그 경기 팀 중 하나인지 검증
    if (supportTeamId !== game.home_team_id && supportTeamId !== game.away_team_id) {
      return { ok: false, reason: "응원팀이 경기 팀과 일치하지 않아요." };
    }
  }

  // 6. 같은 사용자의 같은 경기 중복 체크
  const { data: dupAttendance } = await admin
    .from("attendances")
    .select("id")
    .eq("user_id", userId)
    .eq("game_id", game.id)
    .maybeSingle();
  if (dupAttendance) {
    return { ok: false, reason: "이 경기는 이미 직관 기록에 있어요." };
  }

  // 6-2. 1일 1직관 사전 체크 — 같은 사용자가 같은 날짜에 이미 다른 경기 직관이 있는지.
  // DB trigger가 막아주지만, 사용자에겐 친절한 안내를 먼저 제공.
  const { data: sameDay } = await admin
    .from("attendances")
    .select("id, games!inner(game_date)")
    .eq("user_id", userId)
    .eq("games.game_date", game.game_date)
    .limit(1)
    .maybeSingle();
  if (sameDay) {
    return {
      ok: false,
      reason: "이미 이 날짜에 등록한 직관이 있어요. 기존 기록을 수정해 주세요."
    };
  }

  // 7. 이미지를 ticket-images 버킷에 업로드 (서버에서 직접)
  const ext = input.mimeType.split("/")[1] || "jpg";
  const path = `${userId}/ticket-${Date.now()}/${hash.slice(0, 12)}.${ext}`;
  const buffer = Buffer.from(input.imageBase64, "base64");
  const { error: uploadErr } = await admin.storage.from("ticket-images").upload(path, buffer, {
    contentType: input.mimeType,
    upsert: false
  });
  if (uploadErr) {
    return { ok: false, reason: `티켓 업로드 실패: ${uploadErr.message}` };
  }

  // 8. attendance 행 생성 (verified=true)
  const { data: created, error: insertErr } = await admin
    .from("attendances")
    .insert({
      user_id: userId,
      game_id: game.id,
      support_team_id: supportTeamId,
      ticket_image_url: path,
      ticket_image_hash: hash,
      verified: true,
      verified_at: new Date().toISOString(),
      verified_method: "ticket_image_vision",
      vision_payload: {
        gameDate: visionResult.gameDate,
        homeTeamId: visionResult.homeTeamId,
        awayTeamId: visionResult.awayTeamId,
        stadium: visionResult.stadium
      },
      memo: input.memo || null
    })
    .select("id")
    .single();
  if (insertErr || !created) {
    // 업로드한 이미지 정리
    await admin.storage.from("ticket-images").remove([path]).catch(() => {});

    // 1일 1직관 trigger 위반은 사용자에게 친절한 메시지로 안내.
    // (race condition으로 사전 체크를 지나간 경우 마지막 방어선.)
    if (insertErr?.code === "23505" && insertErr.message?.includes("하루에 하나")) {
      return { ok: false, reason: "하루에 하나의 직관만 기록할 수 있어요. 기존 기록을 수정해 주세요." };
    }
    return { ok: false, reason: `직관 저장 실패: ${insertErr?.message ?? "unknown"}` };
  }

  // 티켓 인증 성공 시 시즌 XP +100 (멱등). 실패해도 등록은 그대로 OK.
  try {
    const season = new Date(game.game_date).getFullYear();
    await grantXpEvent({
      userId,
      season,
      type: "ticket_verified",
      sourceId: created.id,
      xp: XP_VALUES.ticket_verified
    });
  } catch (xpErr) {
    console.warn("[registerAttendanceFromTicket] XP grant failed:", xpErr);
  }

  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/my/attendances");
  revalidatePath("/my/tickets");

  return {
    ok: true,
    attendanceId: created.id,
    gameLabel: `${game.game_date} ${game.home_team_id.toUpperCase()} vs ${game.away_team_id.toUpperCase()}`
  };
}

// ============================================================
// verifyAttendanceWithTicket
// 이미 등록된 미인증 직관(수동 등록 등)에 티켓 사진을 추가하여 인증 처리.
// 기존 attendance 행을 UPDATE — 새 행 생성하지 않음.
// ============================================================

export type VerifyExistingTicketInput = {
  attendanceId: string;
  imageBase64: string;
  mimeType: string;
};

export type VerifyExistingTicketResult =
  | { ok: true; verifiedAt: string; gameLabel: string }
  | { ok: false; reason: string };

export async function verifyAttendanceWithTicket(
  input: VerifyExistingTicketInput
): Promise<VerifyExistingTicketResult> {
  try {
  // 1. 인증
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, reason: "로그인이 필요합니다." };
  }
  const admin = createSupabaseAdminClient();
  const userId = authData.user.id;

  // 2. attendance 조회 + 소유 확인
  const { data: attendance, error: attErr } = await admin
    .from("attendances")
    .select("id, user_id, game_id, verified")
    .eq("id", input.attendanceId)
    .maybeSingle();
  if (attErr) {
    return { ok: false, reason: `직관 조회 실패: ${attErr.message}` };
  }
  if (!attendance) {
    return { ok: false, reason: "해당 직관 기록을 찾을 수 없어요." };
  }
  if (attendance.user_id !== userId) {
    return { ok: false, reason: "본인 직관만 인증할 수 있어요." };
  }
  if (attendance.verified) {
    return { ok: false, reason: "이미 인증된 직관이에요." };
  }

  // 3. 해시 dedup — 같은 티켓이 다른 직관에 이미 사용됐는지
  const hash = sha256Base64(input.imageBase64);
  const { data: existingByHash } = await admin
    .from("attendances")
    .select("id, user_id")
    .eq("ticket_image_hash", hash)
    .maybeSingle();
  if (existingByHash) {
    if (existingByHash.user_id === userId) {
      return { ok: false, reason: "이미 다른 직관에 사용한 티켓이에요." };
    }
    return { ok: false, reason: "다른 사용자가 이미 인증한 티켓이에요." };
  }

  // 4. Vision 파싱
  const visionResult = await parseTicketWithGemini(input.imageBase64, input.mimeType);
  if (!visionResult.ok) {
    return { ok: false, reason: visionResult.reason };
  }

  // 5. 등록된 attendance.game 정보 가져오기
  const { data: game, error: gameErr } = await admin
    .from("games")
    .select("id, game_date, home_team_id, away_team_id, stadium")
    .eq("id", attendance.game_id)
    .maybeSingle();
  if (gameErr || !game) {
    return { ok: false, reason: "직관에 연결된 경기 정보를 찾을 수 없어요." };
  }

  // 6. 🔑 핵심 검증 — 티켓의 경기가 등록된 직관과 일치하는지
  const dateMatches = visionResult.gameDate === game.game_date;
  const dbTeams = [game.home_team_id, game.away_team_id];
  const ticketTeams = [visionResult.homeTeamId, visionResult.awayTeamId];
  const teamsMatch =
    dbTeams.every((t) => ticketTeams.includes(t)) &&
    ticketTeams.every((t) => dbTeams.includes(t));

  if (!dateMatches || !teamsMatch) {
    return {
      ok: false,
      reason: `티켓의 경기(${visionResult.gameDate} ${visionResult.homeTeamId.toUpperCase()} vs ${visionResult.awayTeamId.toUpperCase()})가 등록된 직관과 달라요. 다른 직관에 인증해주세요.`
    };
  }

  // 7. Storage 업로드
  const ext = input.mimeType.split("/")[1] || "jpg";
  const path = `${userId}/ticket-${Date.now()}/${hash.slice(0, 12)}.${ext}`;
  const buffer = Buffer.from(input.imageBase64, "base64");
  const { error: uploadErr } = await admin.storage.from("ticket-images").upload(path, buffer, {
    contentType: input.mimeType,
    upsert: false
  });
  if (uploadErr) {
    return { ok: false, reason: `티켓 업로드 실패: ${uploadErr.message}` };
  }

  // 8. attendance UPDATE
  const verifiedAt = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("attendances")
    .update({
      ticket_image_url: path,
      ticket_image_hash: hash,
      verified: true,
      verified_at: verifiedAt,
      verified_method: "ticket_image_vision",
      vision_payload: {
        gameDate: visionResult.gameDate,
        homeTeamId: visionResult.homeTeamId,
        awayTeamId: visionResult.awayTeamId,
        stadium: visionResult.stadium
      }
    })
    .eq("id", input.attendanceId);
  if (updateErr) {
    // 업로드 정리
    await admin.storage.from("ticket-images").remove([path]).catch(() => {});
    return { ok: false, reason: `인증 저장 실패: ${updateErr.message}` };
  }

  // 사후 티켓 인증 성공 시 시즌 XP +100 (멱등). 같은 attendanceId에 대해 이미 지급됐다면 자동 스킵.
  try {
    const season = new Date(game.game_date).getFullYear();
    await grantXpEvent({
      userId,
      season,
      type: "ticket_verified",
      sourceId: input.attendanceId,
      xp: XP_VALUES.ticket_verified
    });
  } catch (xpErr) {
    console.warn("[verifyAttendanceWithTicket] XP grant failed:", xpErr);
  }

  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/my/attendances");
  revalidatePath("/my/tickets");

  return {
    ok: true,
    verifiedAt,
    gameLabel: `${game.game_date} ${game.home_team_id.toUpperCase()} vs ${game.away_team_id.toUpperCase()}`
  };
  } catch (error) {
    console.error("verifyAttendanceWithTicket failed:", error);
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "티켓 인증 중 알 수 없는 오류가 발생했어요."
    };
  }
}
