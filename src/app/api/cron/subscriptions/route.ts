import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { mysqlQuery } from "@/lib/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(): Promise<boolean> {
  const h = await headers();
  const bearer = h.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && bearer === `Bearer ${expected}`);
}

/** 批量将已过期但仍标记 active 的用户置为 inactive */
export async function POST() {
  if (!(await authorize())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await mysqlQuery<{ affectedRows?: number }>(
    `update users
       set subscription_status = 'inactive'
     where subscription_status = 'active'
       and subscription_end_date is not null
       and subscription_end_date <= now()`,
  );

  const updated =
    typeof result === "object" && result && "affectedRows" in result
      ? Number(result.affectedRows)
      : null;

  return NextResponse.json({ ok: true, updated });
}
