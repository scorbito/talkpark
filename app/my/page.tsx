import { MyScreen } from "@/components/domain/MyScreen";
import { listAcceptedFriendsFromDb } from "@/lib/supabase/queries";
import { getCurrentUserSeasonLevel } from "@/lib/season-level/queries";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const [friends, seasonLevel] = await Promise.all([
    listAcceptedFriendsFromDb().catch(() => []),
    getCurrentUserSeasonLevel().catch(() => null)
  ]);
  return <MyScreen friendsCount={friends.length} seasonLevel={seasonLevel} />;
}
