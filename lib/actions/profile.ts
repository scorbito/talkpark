"use server";

import { revalidatePath } from "next/cache";
import type { UpdateProfileInput } from "@/lib/types/api-contracts";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

function isSameKoreanDate(left: Date, right: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(left) === new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(right);
}

export async function updateProfileAction(input: UpdateProfileInput) {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from("profiles")
    .select("main_team_id,main_team_changed_at")
    .eq("id", authData.user.id)
    .single();

  if (currentError) {
    throw new Error(`프로필을 불러오지 못했습니다: ${currentError.message}`);
  }

  const next: {
    nickname?: string;
    main_team_id?: string;
    main_team_changed_at?: string;
    interest_team_ids?: string[];
    notifications_enabled?: boolean;
    default_public_scope?: UpdateProfileInput["defaultPublicScope"];
    bio?: string | null;
  } = {};

  if (input.nickname !== undefined) next.nickname = input.nickname;
  if (input.interestTeamIds !== undefined) {
    if (input.interestTeamIds.length > 5) {
      throw new Error("관심팀은 최대 5개까지 선택할 수 있습니다.");
    }
    next.interest_team_ids = input.interestTeamIds;
  }
  if (input.notificationsEnabled !== undefined) next.notifications_enabled = input.notificationsEnabled;
  if (input.defaultPublicScope !== undefined) next.default_public_scope = input.defaultPublicScope;
  if (input.bio !== undefined) {
    // 자기소개: 150자 제한 + 줄바꿈 제거 + 빈 문자열은 null로 저장
    const sanitized = (input.bio ?? "")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, 150);
    next.bio = sanitized.length > 0 ? sanitized : null;
  }

  if (input.mainTeamId !== undefined && input.mainTeamId !== current.main_team_id) {
    // MVP/테스트 단계: 하루 1회 제한 일시 해제 (실서비스 출시 전 다시 활성화)
    next.main_team_id = input.mainTeamId;
    next.main_team_changed_at = new Date().toISOString();
  }

  if (Object.keys(next).length === 0) {
    return; // 변경사항 없음
  }

  const { error } = await admin
    .from("profiles")
    .update(next)
    .eq("id", authData.user.id);

  if (error) {
    throw new Error(`프로필 저장에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/my");
  revalidatePath("/my/settings");
  revalidatePath("/community");
  revalidatePath("/rankings");
}

/** profile-images 공개 URL에서 storage 내부 경로 추출 */
function extractAvatarPath(url: string): string | null {
  const marker = "/storage/v1/object/public/profile-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

/**
 * 프로필 사진 업데이트.
 * - newAvatarUrl: 클라이언트에서 storage에 업로드한 새 사진의 public URL
 * - profiles.avatar_image_url 갱신 후 이전 사진은 storage에서 제거
 */
export async function updateAvatarAction(newAvatarUrl: string) {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from("profiles")
    .select("avatar_image_url")
    .eq("id", authData.user.id)
    .single();

  if (currentError) {
    throw new Error(`프로필을 불러오지 못했습니다: ${currentError.message}`);
  }

  const previousUrl = current.avatar_image_url ?? null;

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_image_url: newAvatarUrl })
    .eq("id", authData.user.id);

  if (updateError) {
    throw new Error(`프로필 사진 저장에 실패했습니다: ${updateError.message}`);
  }

  // 이전 사진 정리 (실패해도 무시)
  if (previousUrl && previousUrl !== newAvatarUrl) {
    const path = extractAvatarPath(previousUrl);
    if (path) {
      const { error: removeError } = await admin.storage.from("profile-images").remove([path]);
      if (removeError) {
        console.warn("[updateAvatarAction] previous avatar cleanup failed:", removeError.message);
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/my");
  revalidatePath("/community");

  return { avatarUrl: newAvatarUrl };
}

