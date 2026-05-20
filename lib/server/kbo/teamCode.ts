// Maps KBO API/Naver team display names to our internal team IDs.
// Our team IDs (lib/constants/teams.ts): doosan, lg, kt, ssg, nc, kiwoom, samsung, lotte, kia, hanwha

export function parseTeamCode(name: string): string | null {
  if (!name) return null;
  const up = name.toUpperCase();
  if (up.includes("LG")) return "lg";
  if (up.includes("KT")) return "kt";
  if (up.includes("SSG") || up.includes("SK")) return "ssg";
  if (up.includes("NC")) return "nc";
  if (up.includes("두산") || up.includes("DOO") || up.includes("OB")) return "doosan";
  if (up.includes("KIA") || up.includes("기아") || up.includes("타이거즈")) return "kia";
  if (up.includes("롯데") || up.includes("LOT")) return "lotte";
  if (up.includes("삼성") || up.includes("SAM")) return "samsung";
  if (up.includes("한화") || up.includes("HAN")) return "hanwha";
  if (up.includes("키움") || up.includes("히어로즈") || up.includes("KIW")) return "kiwoom";
  return null;
}
