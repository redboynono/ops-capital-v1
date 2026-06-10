import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { mysqlQuery } from "@/lib/mysql";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { enabled?: boolean };
  try {
    body = (await req.json()) as { enabled?: boolean };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const enabled = body.enabled ? 1 : 0;
  await mysqlQuery("update users set email_briefing_enabled = ? where id = ?", [enabled, user.id]);
  return NextResponse.json({ enabled: enabled === 1 });
}
