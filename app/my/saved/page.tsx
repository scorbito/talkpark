import { SavedReviewsScreen } from "@/components/domain/SavedReviewsScreen";
import { listSavedReviewsFromDb } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function SavedReviewsPage() {
  const reviews = await listSavedReviewsFromDb().catch(() => []);
  return <SavedReviewsScreen reviews={reviews} />;
}
