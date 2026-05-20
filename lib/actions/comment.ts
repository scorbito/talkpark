"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function createCommentAction(input: { reviewId: string; body: string }) {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const body = input.body.trim();
  if (body.length === 0) {
    throw new Error("댓글 내용을 입력해주세요.");
  }
  if (body.length > 500) {
    throw new Error("댓글은 500자 이내로 작성해주세요.");
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("review_comments")
    .insert({
      review_id: input.reviewId,
      user_id: authData.user.id,
      body
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`댓글 저장에 실패했습니다: ${error?.message ?? "unknown"}`);
  }

  revalidatePath(`/reviews/${input.reviewId}`);
  revalidatePath("/community");

  return { id: data.id };
}

export async function deleteCommentAction(commentId: string) {
  const ssr = createSupabaseServerClient();
  const { data: authData, error: authError } = await ssr.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const admin = createSupabaseAdminClient();

  // 본인 댓글 또는 후기 작성자만 삭제 가능
  const { data: comment, error: fetchErr } = await admin
    .from("review_comments")
    .select("id, user_id, review_id")
    .eq("id", commentId)
    .maybeSingle();
  if (fetchErr) {
    throw new Error(`댓글 조회 실패: ${fetchErr.message}`);
  }
  if (!comment) {
    throw new Error("댓글을 찾을 수 없습니다.");
  }

  let canDelete = comment.user_id === authData.user.id;
  if (!canDelete) {
    const { data: review } = await admin
      .from("reviews")
      .select("user_id")
      .eq("id", comment.review_id)
      .maybeSingle();
    canDelete = review?.user_id === authData.user.id;
  }
  if (!canDelete) {
    throw new Error("본인이 작성한 댓글이거나 본인 후기의 댓글만 삭제할 수 있어요.");
  }

  const { error: deleteErr } = await admin
    .from("review_comments")
    .delete()
    .eq("id", commentId);
  if (deleteErr) {
    throw new Error(`댓글 삭제 실패: ${deleteErr.message}`);
  }

  revalidatePath(`/reviews/${comment.review_id}`);
  revalidatePath("/community");
}
