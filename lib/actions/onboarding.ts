"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function completeOnboardingAction(formData: FormData) {
  const nickname = formData.get("nickname")?.toString().trim();
  const mainTeamId = formData.get("mainTeamId")?.toString();

  if (!nickname || nickname.length < 2) {
    redirect("/onboarding?error=nickname");
  }

  if (!mainTeamId) {
    redirect("/onboarding?error=team");
  }

  const supabase = createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/login?error=auth-required");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("profiles").upsert({
    id: authData.user.id,
    nickname,
    main_team_id: mainTeamId,
    main_team_changed_at: new Date().toISOString(),
    interest_team_ids: [],
    notifications_enabled: true,
    default_public_scope: "public"
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

