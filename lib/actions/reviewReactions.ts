"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ToggleLikeResult = { liked: boolean; count: number };
export type ToggleSaveResult = { saved: boolean };

export async function toggleReviewLikeAction(reviewId: string): Promise<ToggleLikeResult> {
  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error("로그인이 필요합니다.");
  }
  const me = authData.user.id;

  // 현재 좋아요 여부 확인
  const { data: existing, error: existingError } = await supabase
    .from("review_likes")
    .select("user_id")
    .eq("review_id", reviewId)
    .eq("user_id", me)
    .maybeSingle();

  if (existingError) {
    throw new Error(`좋아요 상태 조회에 실패했어요: ${existingError.message}`);
  }

  if (existing) {
    // 이미 좋아요 → 취소
    const { error } = await supabase
      .from("review_likes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", me);
    if (error) throw new Error(`좋아요 취소에 실패했어요: ${error.message}`);
  } else {
    // 좋아요 추가
    const { error } = await supabase
      .from("review_likes")
      .insert({ review_id: reviewId, user_id: me });
    if (error) throw new Error(`좋아요에 실패했어요: ${error.message}`);
  }

  // 최신 카운트 반환
  const { count, error: countError } = await supabase
    .from("review_likes")
    .select("user_id", { count: "exact", head: true })
    .eq("review_id", reviewId);

  if (countError) {
    throw new Error(`좋아요 카운트 조회에 실패했어요: ${countError.message}`);
  }

  revalidatePath(`/reviews/${reviewId}`);

  return { liked: !existing, count: count ?? 0 };
}

export async function toggleReviewSaveAction(reviewId: string): Promise<ToggleSaveResult> {
  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error("로그인이 필요합니다.");
  }
  const me = authData.user.id;

  const { data: existing, error: existingError } = await supabase
    .from("review_saves")
    .select("user_id")
    .eq("review_id", reviewId)
    .eq("user_id", me)
    .maybeSingle();

  if (existingError) {
    throw new Error(`저장 상태 조회에 실패했어요: ${existingError.message}`);
  }

  if (existing) {
    const { error } = await supabase
      .from("review_saves")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", me);
    if (error) throw new Error(`저장 취소에 실패했어요: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("review_saves")
      .insert({ review_id: reviewId, user_id: me });
    if (error) throw new Error(`저장에 실패했어요: ${error.message}`);
  }

  revalidatePath("/my/saved");

  return { saved: !existing };
}
