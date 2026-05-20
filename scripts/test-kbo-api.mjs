// 단일 날짜에 대해 KBO API가 응답하는지 검증.
// Usage: node scripts/test-kbo-api.mjs 2025-04-05

const dateArg = process.argv[2] ?? "2025-04-05";
const [yyyy, mm, dd] = dateArg.split("-");
const yyyymmdd = `${yyyy}${mm}${dd}`;

const url = `https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList?leId=1&srId=0&date=${yyyymmdd}&_t=${Date.now()}`;
console.log("URL:", url);

const response = await fetch(url, {
  cache: "no-store",
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
  }
});

console.log("Status:", response.status);
const text = await response.text();
console.log("Response length:", text.length);

try {
  const data = JSON.parse(text);
  console.log("Game count:", data?.game?.length ?? 0);
  if (data?.game?.[0]) {
    console.log("Sample:", JSON.stringify(data.game[0], null, 2).slice(0, 800));
  }
} catch {
  console.log("Body (first 500):", text.slice(0, 500));
}
