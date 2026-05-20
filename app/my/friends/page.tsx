import { FriendsScreen } from "@/components/domain/FriendsScreen";
import {
  listAcceptedFriendsFromDb,
  listIncomingFriendRequestsFromDb
} from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const [incomingRequests, friends] = await Promise.all([
    listIncomingFriendRequestsFromDb().catch(() => []),
    listAcceptedFriendsFromDb().catch(() => [])
  ]);
  return <FriendsScreen initialIncomingRequests={incomingRequests} initialFriends={friends} />;
}
