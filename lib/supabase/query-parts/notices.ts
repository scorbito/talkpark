import type { Notice } from "@/lib/types/domain";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function toNotice(row: {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
}): Notice {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    isPinned: row.is_pinned,
    publishedAt: row.published_at
  };
}

export async function listNoticesFromDb(): Promise<Notice[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notices")
    .select("id, title, body, is_pinned, published_at")
    .lte("published_at", new Date().toISOString())
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) throw new Error(`공지 조회 실패: ${error.message}`);
  return (data ?? []).map(toNotice);
}

export async function getNoticeByIdFromDb(id: string): Promise<Notice | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notices")
    .select("id, title, body, is_pinned, published_at")
    .eq("id", id)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`공지 조회 실패: ${error.message}`);
  return data ? toNotice(data) : null;
}
