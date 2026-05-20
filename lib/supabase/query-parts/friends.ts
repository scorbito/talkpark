import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FriendListItem = {
  userId: string;
  nickname: string;
  mainTeamId: string;
  avatarUrl: string | null;
};

export type IncomingFriendRequest = {
  requestId: string;
  createdAt: string;
  fromUser: FriendListItem;
};

export async function listIncomingFriendRequestsFromDb(): Promise<IncomingFriendRequest[]> {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return [];

  const { data: requests, error } = await supabase
    .from("friend_requests")
    .select("id, from_user_id, created_at")
    .eq("to_user_id", authData.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !requests || requests.length === 0) return [];

  const fromIds = Array.from(new Set(requests.map((r) => r.from_user_id)));
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, nickname, main_team_id, avatar_image_url")
    .in("id", fromIds);

  if (pErr || !profiles) return [];

  const byId = new Map(profiles.map((p) => [p.id, p]));

  return requests
    .map((r): IncomingFriendRequest | null => {
      const p = byId.get(r.from_user_id);
      if (!p) return null;
      return {
        requestId: r.id,
        createdAt: r.created_at,
        fromUser: {
          userId: p.id,
          nickname: p.nickname,
          mainTeamId: p.main_team_id,
          avatarUrl: p.avatar_image_url ?? null
        }
      };
    })
    .filter((x): x is IncomingFriendRequest => x !== null);
}

export async function listAcceptedFriendsFromDb(): Promise<FriendListItem[]> {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return [];
  const me = authData.user.id;

  const { data: rows, error } = await supabase
    .from("friends")
    .select("user_a_id, user_b_id, created_at")
    .or(`user_a_id.eq.${me},user_b_id.eq.${me}`)
    .order("created_at", { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const otherIds = Array.from(
    new Set(rows.map((row) => (row.user_a_id === me ? row.user_b_id : row.user_a_id)))
  );

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, nickname, main_team_id, avatar_image_url")
    .in("id", otherIds);

  if (pErr || !profiles) return [];

  const byId = new Map(profiles.map((p) => [p.id, p]));

  return otherIds
    .map((id): FriendListItem | null => {
      const p = byId.get(id);
      if (!p) return null;
      return {
        userId: p.id,
        nickname: p.nickname,
        mainTeamId: p.main_team_id,
        avatarUrl: p.avatar_image_url ?? null
      };
    })
    .filter((x): x is FriendListItem => x !== null);
}
