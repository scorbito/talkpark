import { AppStateProvider } from "@/lib/state/AppState";
import {
  getCurrentProfileFromDb,
  getCurrentProfileStatsFromDb,
  listCurrentAttendancesFromDb
} from "@/lib/supabase/queries";

type Props = {
  isAnonymous: boolean;
  children: React.ReactNode;
};

/** AppState 초기 데이터를 서버에서 페치하는 컴포넌트.
 *  layout.tsx에서 Suspense로 감싸 사용 → 데이터 페치 중에도 초기 셸(initial-loader)이 즉시 노출됨.
 *
 *  reviews / reactions는 홈 첫 화면에 즉시 필요하지 않으므로 layout에서 빼고
 *  AppStateProvider 마운트 후 클라에서 별도 페치 (~270ms 단축). */
export async function AppStateLoader({ isAnonymous, children }: Props) {
  const [profile, stats, attendances] = await Promise.all([
    getCurrentProfileFromDb().catch(() => null),
    getCurrentProfileStatsFromDb().catch(() => null),
    listCurrentAttendancesFromDb().catch(() => [])
  ]);

  return (
    <AppStateProvider
      initialProfile={profile}
      initialStats={stats}
      initialAttendances={attendances}
      initialIsAnonymous={isAnonymous}
    >
      {children}
    </AppStateProvider>
  );
}
