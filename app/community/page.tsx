import { CommunityScreen } from "@/components/domain/CommunityScreen";
import { listAcceptedFriendsFromDb, listReviewsFromDb } from "@/lib/supabase/queries";
import { listMatchPostsFromDb } from "@/lib/supabase/query-parts/matchPosts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// revalidate 대신 force-dynamic — 친구 목록은 사용자별로 다르므로 캐시 공유 금지
export const dynamic = "force-dynamic";

type CommunityPageProps = {
  searchParams?: { tab?: string; gameId?: string; date?: string };
};

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const tab = searchParams?.tab === "match-talk" ? "match-talk" : "review";
  const matchTalkGameId = searchParams?.gameId;
  const matchTalkDate = searchParams?.date;

  const ssr = createSupabaseServerClient();
  const { data: authData } = await ssr.auth.getUser();
  const currentUserId = authData.user?.id ?? null;

  const [dbReviews, friends, initialMatchPosts] = await Promise.all([
    listReviewsFromDb({ limit: 20 }).catch(() => []),
    listAcceptedFriendsFromDb().catch(() => []),
    listMatchPostsFromDb({ limit: 20, gameId: matchTalkGameId, date: matchTalkDate }).catch(() => [])
  ]);
  const friendIds = friends.map((f) => f.userId);

  return (
    <CommunityScreen
      dbReviews={dbReviews}
      friendIds={friendIds}
      initialMatchPosts={initialMatchPosts}
      currentUserId={currentUserId}
      initialTab={tab}
      initialMatchTalkGameId={matchTalkGameId}
      initialMatchTalkDate={matchTalkDate}
    />
  );
}
