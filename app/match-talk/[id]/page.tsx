import { redirect } from "next/navigation";

// 경기톡은 짧은 글이라 별도 상세 페이지를 두지 않는다.
// 댓글은 목록(/community?tab=match-talk)의 각 카드에서 펼쳐 보는 방식.
// 기존 링크가 외부에 남아있을 수 있으니 라우트만 열어두고 커뮤니티로 보낸다.
export default function MatchPostDetailPage() {
  redirect("/community?tab=match-talk");
}
