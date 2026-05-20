import { unstable_noStore as noStore } from "next/cache";
import { MyAttendancesScreen } from "@/components/domain/MyAttendancesScreen";
import { listCurrentAttendancesFromDb } from "@/lib/supabase/queries";

export default async function MyAttendancesPage() {
  noStore();
  const dbAttendances = await listCurrentAttendancesFromDb().catch(() => []);

  return <MyAttendancesScreen dbAttendances={dbAttendances} />;
}
