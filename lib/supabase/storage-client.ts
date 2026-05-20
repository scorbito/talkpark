"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UploadBucket = "ticket-images" | "review-photos" | "profile-images";

function sanitizeFileName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "jpg";
  return `${crypto.randomUUID()}.${extension.replace(/[^a-z0-9]/g, "") || "jpg"}`;
}

export async function uploadUserFile(bucket: UploadBucket, file: File, folder: string) {
  const supabase = createSupabaseBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("로그인이 필요합니다.");
  }

  const path = `${authData.user.id}/${folder}/${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false
  });

  if (error) {
    throw new Error(`이미지 업로드에 실패했습니다: ${error.message}`);
  }

  if (bucket === "ticket-images") {
    return path;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

