import { NextResponse } from "next/server";

import { createAlert, isAlertType, listAlertsForUser } from "@/lib/alerts";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const alerts = await listAlertsForUser(user.id);
  return NextResponse.json({ alerts });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: {
    symbol?: string;
    ruleType?: string;
    threshold?: number;
    cooldownMinutes?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const symbol = (body.symbol ?? "").trim().toUpperCase();
  const ruleType = body.ruleType ?? "";
  const threshold = Number(body.threshold);
  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  if (!isAlertType(ruleType))
    return NextResponse.json({ error: "rule_type 必须是 price_above/price_below/move_above/move_below" }, { status: 400 });
  if (!Number.isFinite(threshold))
    return NextResponse.json({ error: "threshold 必须为数字" }, { status: 400 });

  try {
    const id = await createAlert({
      userId: user.id,
      symbol,
      ruleType,
      threshold,
      cooldownMinutes: body.cooldownMinutes ?? 60,
    });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 400 },
    );
  }
}
