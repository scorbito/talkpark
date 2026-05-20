import { unstable_noStore as noStore } from "next/cache";
import { ReviewDetailScreen } from "@/components/domain/ReviewDetailScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReviewByIdFromDb, listCommentsByReviewId } from "@/lib/supabase/queries";

export default async function ReviewDetailPage({ params }: { params: { id: string } }) {
  noStore();

  const ssr = createSupabaseServerClient();
  const { data: authData } = await ssr.auth.getUser();
  const currentUserId = authData?.user?.id ?? null;

  const [review, comments] = await Promise.all([
    getReviewByIdFromDb(params.id).catch(() => null),
    listCommentsByReviewId(params.id).catch(() => [])
  ]);

  return (
    <ReviewDetailScreen
      id={params.id}
      dbReview={review}
      initialComments={comments}
      currentUserId={currentUserId}
    />
  );
}
