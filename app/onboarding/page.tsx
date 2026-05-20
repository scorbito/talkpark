import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/domain/OnboardingForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OnboardingPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login?error=auth-required");
  }

  // 익명 가입 시 이미 부여된 디폴트 닉네임("불꽃홈런왕xxxxxx")을 미리 가져와
  // 사용자가 그대로 갈 수 있게 함. OAuth(구글/카카오)도 동일하게 동작.
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, main_team_id")
    .eq("id", data.user.id)
    .maybeSingle();

  return (
    <main className="app-backdrop">
      <section className="phone-frame phone-frame-dark onboarding-frame" aria-label="온보딩">
        <div className="app-scroll">
          <div className="onboarding-bg-area" aria-hidden="true" />
          <OnboardingForm
            error={searchParams?.error}
            initialNickname={profile?.nickname}
            initialTeamId={profile?.main_team_id}
          />
        </div>
      </section>
    </main>
  );
}
