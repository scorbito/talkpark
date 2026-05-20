import { redirect } from "next/navigation";

// 경기 상세 페이지는 추후 버전에서 추가 — 현재는 일정으로 리다이렉트
export default function GameDetailPage() {
  redirect("/schedule");
}
