import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getAgent } from "@/lib/agents/registry";
import { runAgent } from "@/lib/agents/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RunPayload = {
  agentId?: string;
  /** ticker 模式 */
  symbol?: string;
  /** post 模式 */
  slug?: string;
  /** freeform 模式 */
  query?: string;
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录后使用 Agent" }, { status: 401 });
  }

  let body: RunPayload;
  try {
    body = (await req.json()) as RunPayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const agentId = (body.agentId ?? "").trim();
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const agent = getAgent(agentId);
  if (!agent) {
    return NextResponse.json({ error: `unknown agent: ${agentId}` }, { status: 404 });
  }

  // 根据 agent 期望的 input kind 组装 input
  if (agent.inputKind === "ticker") {
    const sym = (body.symbol ?? "").trim().toUpperCase();
    if (!sym) {
      return NextResponse.json(
        { error: "symbol is required for this agent" },
        { status: 400 },
      );
    }
    return runAgent({
      agent,
      input: { kind: "ticker", symbol: sym },
      userId: user.id,
    });
  }

  if (agent.inputKind === "post") {
    const slug = (body.slug ?? "").trim();
    if (!slug) {
      return NextResponse.json(
        { error: "slug is required for this agent" },
        { status: 400 },
      );
    }
    return runAgent({
      agent,
      input: { kind: "post", slug },
      userId: user.id,
    });
  }

  if (agent.inputKind === "freeform") {
    const q = (body.query ?? "").trim();
    if (!q) {
      return NextResponse.json(
        { error: "query is required for this agent" },
        { status: 400 },
      );
    }
    if (q.length > 500) {
      return NextResponse.json({ error: "query too long (max 500)" }, { status: 400 });
    }
    return runAgent({
      agent,
      input: { kind: "freeform", query: q },
      userId: user.id,
    });
  }

  return NextResponse.json({ error: "unsupported agent input kind" }, { status: 400 });
}
