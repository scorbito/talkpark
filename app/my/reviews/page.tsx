import { unstable_noStore as noStore } from "next/cache";
import { MyReviewsScreen } from "@/components/domain/MyReviewsScreen";
import { listReviewsFromDb } from "@/lib/supabase/queries";

export default async function MyReviewsPage() {
  noStore();
  const dbReviews = await listReviewsFromDb({ onlyMine: true }).catch(() => []);

  return <MyReviewsScreen dbReviews={dbReviews} />;
}
