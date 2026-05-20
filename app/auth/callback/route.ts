import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfileFromDb } from "@/lib/supabase/queries";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next");
  const isUpgrade = searchParams.get("upgrade") === "1";

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing-code`);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  if (next && next.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // 익명 → 정식 전환 후엔 홈으로 + 성공 토스트
  if (isUpgrade) {
    return NextResponse.redirect(`${origin}/?notice=upgraded`);
  }

  const profile = await getCurrentProfileFromDb().catch(() => null);
  return NextResponse.redirect(`${origin}${profile ? "/" : "/onboarding"}`);
}
