import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 인증 미가입 사용자가 진입 시 /landing으로 리다이렉트해야 하는 보호 경로.
// 서버 컴포넌트의 redirect() 호출이 Next.js App Router의 React #310 버그를 트리거하므로
// (https://github.com/vercel/next.js/issues/78396), 미들웨어에서 HTTP 레벨로 처리.
const PROTECTED_HOME_PATHS = ["/"];

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: "", ...options });
      }
    }
  });

  const { data } = await supabase.auth.getUser();

  // 보호 경로에 비인증 사용자가 진입하면 미들웨어 단에서 /landing으로 리다이렉트.
  // page.tsx의 redirect("/landing") 호출이 일으키던 React #310 회피.
  if (!data?.user && PROTECTED_HOME_PATHS.includes(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/landing";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
