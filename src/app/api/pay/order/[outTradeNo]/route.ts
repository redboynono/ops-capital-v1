import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOrderByOutTradeNo } from "@/lib/payments/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ outTradeNo: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { outTradeNo } = await params;
  const order = await getOrderByOutTradeNo(outTradeNo);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 只允许订单拥有者查询
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    out_trade_no: order.out_trade_no,
    status: order.status,
    amount: order.amount,
    duration_months: order.duration_months,
    pay_channel: order.pay_channel,
    plan_id: order.plan_id,
    paid_at: order.paid_at,
  });
}
