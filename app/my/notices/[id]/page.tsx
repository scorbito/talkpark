import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { NoticeDetailScreen } from "@/components/domain/NoticeDetailScreen";
import { getNoticeByIdFromDb } from "@/lib/supabase/queries";

export default async function NoticeDetailPage({ params }: { params: { id: string } }) {
  noStore();
  const notice = await getNoticeByIdFromDb(params.id).catch(() => null);
  if (!notice) notFound();
  return <NoticeDetailScreen notice={notice} />;
}
