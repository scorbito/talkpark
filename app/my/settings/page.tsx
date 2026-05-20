import { SettingsScreen } from "@/components/domain/SettingsScreen";
import { getCurrentAuthAccountInfo } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const accountInfo = await getCurrentAuthAccountInfo().catch(() => null);
  return <SettingsScreen accountInfo={accountInfo} />;
}
