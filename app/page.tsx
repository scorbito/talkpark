import { unstable_noStore as noStore } from "next/cache";
import { CommunityScreen } from "@/components/domain/CommunityScreen";
import { listAcceptedFriendsFromDb, listReviewsFromDb } from "@/lib/supabase/queries";
import { listMatchPostsFromDb } from "@/lib/supabase/query-parts/matchPosts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: { tab?: string; gameId?: string; date?: string };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  noStore();

  // 기본 활성화 탭을 "match-talk"(경기톡)으로 설정합니다.
  const tab = searchParams?.tab === "review" ? "review" : "match-talk";
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
