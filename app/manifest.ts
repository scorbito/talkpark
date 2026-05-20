import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "톡구장",
    short_name: "톡구장",
    description: "KBO 실시간 경기톡 및 야구팬 커뮤니티 웹앱",
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
