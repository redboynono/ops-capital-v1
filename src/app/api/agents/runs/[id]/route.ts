import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getUserRun } from "@/lib/agents/run";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const run = await getUserRun(user.id, id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ run });
}
