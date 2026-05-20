export function getSupabaseBrowserEnv() {
  // 주의: Next.js는 `process.env.NEXT_PUBLIC_*` 직접 참조만 빌드 시 치환한다.
  // `process.env[key]` 같은 동적 접근은 브라우저 번들에서 undefined가 되므로 사용 금지.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing Supabase environment variables: ${missing.join(", ")}`);
  }

  return { url: url!, anonKey: anonKey! };
}

export function getSupabaseServiceRoleEnv() {
  const { url } = getSupabaseBrowserEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing Supabase environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  return { url, serviceRoleKey };
}

