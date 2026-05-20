import { unstable_noStore as noStore } from "next/cache";
import { NoticesListScreen } from "@/components/domain/NoticesListScreen";
import { listNoticesFromDb } from "@/lib/supabase/queries";

export default async function NoticesPage() {
  noStore();
  const notices = await listNoticesFromDb().catch(() => []);
  return <NoticesListScreen notices={notices} />;
}
