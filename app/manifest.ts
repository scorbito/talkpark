import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "오늘은 승요",
    short_name: "승요",
    description: "KBO 직관 기록, 승률 통계, 커뮤니티 웹앱",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06101e",
    theme_color: "#06101e",
    lang: "ko",
    icons: [
      {
        src: "/assets/mascot-default.png",
        sizes: "500x500",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/assets/mascot-default.png",
        sizes: "500x500",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
