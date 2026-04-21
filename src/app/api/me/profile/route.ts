import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { mysqlQuery } from "@/lib/mysql";
import { hashPassword, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

type UpdateBody = {
  fullName?: string;
  currentPassword?: string;
  newPassword?: string;
};

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as UpdateBody | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { fullName, currentPassword, newPassword } = body;

  if (typeof fullName === "string") {
    const trimmed = fullName.trim().slice(0, 120);
    await mysqlQuery("update users set full_name = ? where id = ?", [trimmed || null, user.id]);
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "请输入当前密码" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "新密码至少 6 位" }, { status: 400 });
    }

    const rows = await mysqlQuery<{ password_hash: string }[]>(
      "select password_hash from users where id = ? limit 1",
      [user.id],
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

    const ok = await verifyPassword(currentPassword, current.password_hash);
    if (!ok) return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });

    const hashed = await hashPassword(newPassword);
    await mysqlQuery("update users set password_hash = ? where id = ?", [hashed, user.id]);
  }

  return NextResponse.json({ ok: true });
}
