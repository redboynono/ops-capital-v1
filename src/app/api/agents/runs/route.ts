import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { listUserRuns } from "@/lib/agents/run";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const limitStr = url.searchParams.get("limit");
  const symbol = url.searchParams.get("symbol");
  const limit = limitStr ? Math.max(1, Math.min(50, Number(limitStr))) : 20;

  const runs = await listUserRuns(user.id, { limit, symbol: symbol || null });
  return NextResponse.json({ runs });
}
