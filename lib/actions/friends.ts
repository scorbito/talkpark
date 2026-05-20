"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function sortFriendPair(userAId: string, userBId: string) {
  return userAId < userBId
    ? { user_a_id: userAId, user_b_id: userBId }
    : { user_a_id: userBId, user_b_id: userAId };
}

export type FriendCandidate = {
  userId: string;
  nickname: string;
  mainTeamId: string;
  avatarUrl: string | null;
  relationship: "none" | "friend" | "requested" | "incoming";
};

export async function searchProfilesByNicknameAction(rawQuery: string): Promise<FriendCandidate[]> {
  const query = rawQuery.trim();
  if (query.length < 1) return [];

  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    throw new Error("로그인이 필요합니다.");
  }
  const me = authData.user.id;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, nickname, main_team_id, avatar_image_url")
    .ilike("nickname", `%${query}%`)
    .neq("id", me)
    .limit(20);

  if (error || !profiles || profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);

  // 친구 양측 조회 (or + nested in 보다 두 번 query 가 안전)
  const [friendsA, friendsB, outgoing, incoming] = await Promise.all([
    supabase.from("friends").select("user_b_id").eq("user_a_id", me).in("user_b_id", ids),
    supabase.from("friends").select("user_a_id").eq("user_b_id", me).in("user_a_id", ids),
    supabase.from("friend_requests").select("to_user_id").eq("from_user_id", me).eq("status", "pending").in("to_user_id", ids),
    supabase.from("friend_requests").select("from_user_id").eq("to_user_id", me).eq("status", "pending").in("from_user_id", ids)
  ]);

  const friendIds = new Set<string>([
    ...(friendsA.data ?? []).map((r) => r.user_b_id),
    ...(friendsB.data ?? []).map((r) => r.user_a_id)
  ]);
  const outgoingIds = new Set<string>((outgoing.data ?? []).map((r) => r.to_user_id));
  const incomingIds = new Set<string>((incoming.data ?? []).map((r) => r.from_user_id));

  return profiles.map((p) => {
    let relationship: FriendCandidate["relationship"] = "none";
    if (friendIds.has(p.id)) relationship = "friend";
    else if (outgoingIds.has(p.id)) relationship = "requested";
    else if (incomingIds.has(p.id)) relationship = "incoming";
    return {
      userId: p.id,
      nickname: p.nickname,
      mainTeamId: p.main_team_id,
      avatarUrl: p.avatar_image_url ?? null,
      relationship
    };
  });
}

export async function sendFriendRequestAction(toUserId: string) {
  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const { error } = await supabase.from("friend_requests").insert({
    from_user_id: authData.user.id,
    to_user_id: toUserId
  });

  if (error) {
    throw new Error(`친구 요청에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/my/friends");
}

export async function respondFriendRequestAction(requestId: string, status: "accepted" | "rejected") {
  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const { data: request, error: requestError } = await supabase
    .from("friend_requests")
    .select("from_user_id,to_user_id,status")
    .eq("id", requestId)
    .eq("to_user_id", authData.user.id)
    .single();

  if (requestError) {
    throw new Error(`친구 요청을 찾을 수 없습니다: ${requestError.message}`);
  }

  if (request.status !== "pending") {
    throw new Error("이미 처리된 친구 요청입니다.");
  }

  const { error: updateError } = await supabase
    .from("friend_requests")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updateError) {
    throw new Error(`친구 요청 처리에 실패했습니다: ${updateError.message}`);
  }

  if (status === "accepted") {
    const { error: friendError } = await supabase
      .from("friends")
      .upsert(sortFriendPair(request.from_user_id, request.to_user_id));

    if (friendError) {
      throw new Error(`친구 추가에 실패했습니다: ${friendError.message}`);
    }
  }

  revalidatePath("/my/friends");
  revalidatePath("/community");
}

export async function deleteFriendAction(friendUserId: string) {
  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const pair = sortFriendPair(authData.user.id, friendUserId);
  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("user_a_id", pair.user_a_id)
    .eq("user_b_id", pair.user_b_id);

  if (error) {
    throw new Error(`친구 삭제에 실패했습니다: ${error.message}`);
  }

  revalidatePath("/my/friends");
  revalidatePath("/community");
}
