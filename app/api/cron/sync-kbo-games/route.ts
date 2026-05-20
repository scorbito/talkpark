import { NextResponse, type NextRequest } from "next/server";
import { syncGamesInRange } from "@/lib/server/kbo/syncGames";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "today";

  let from: string;
  let to: string;

  if (scope === "range") {
    from = url.searchParams.get("from") ?? "";
    to = url.searchParams.get("to") ?? "";
    if (!from || !to) {
      return NextResponse.json({ ok: false, error: "from and to required for scope=range" }, { status: 400 });
    }
  } else {
    const today = kstNow();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 1);
    const toDate = new Date(today);
    if (scope === "week") {
      toDate.setDate(today.getDate() + 30);
    }
    from = formatDate(fromDate);
    to = formatDate(toDate);
  }

  try {
    const results = await syncGamesInRange(from, to, { delayMs: 200 });
    const totals = results.reduce(
      (acc, r) => ({ inserted: acc.inserted + r.inserted, updated: acc.updated + r.updated }),
      { inserted: 0, updated: 0 }
    );
    return NextResponse.json({ ok: true, scope, totals, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
