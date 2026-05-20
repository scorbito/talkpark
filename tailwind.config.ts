import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-pretendard)", "Pretendard", "system-ui", "sans-serif"]
      },
      colors: {
        primary: "#FF6B35",
        surface: "#FFFFFF",
        ink: "#1A1A1A",
        subtle: "#6B7280",
        win: "#16A34A",
        lose: "#DC2626",
        draw: "#6B7280",
        verified: "#FFD700"
      }
    }
  },
  plugins: []
};

export default config;
