import { RankingsScreen } from "@/components/domain/RankingsScreen";
import { listStandingsFromDb } from "@/lib/supabase/queries";

export const revalidate = 300;

export default async function RankingsPage() {
  const standings = await listStandingsFromDb(new Date().getFullYear()).catch(() => []);

  return <RankingsScreen standings={standings} />;
}
