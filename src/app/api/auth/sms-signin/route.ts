import { NextResponse } from "next/server";
import { mysqlQuery } from "@/lib/mysql";
import { setUserSession } from "@/lib/auth";
import { verifySmsCode } from "@/lib/sms";

type Payload = {
  countryCode?: string;
  phone?: string;
  smsCode?: string;
};

type DbUser = { id: string; email: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const cc = (body.countryCode ?? "").trim();
    const phone = (body.phone ?? "").replace(/\D/g, "");
    const smsCode = (body.smsCode ?? "").trim();

    if (!cc || !phone) return NextResponse.json({ error: "手机号不能为空" }, { status: 400 });
    if (!/^\d{4,8}$/.test(smsCode)) {
      return NextResponse.json({ error: "验证码格式不正确" }, { status: 400 });
    }

    const v = await verifySmsCode(cc, phone, smsCode);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const rows = await mysqlQuery<DbUser[]>(
      "select id, email from users where country_code = ? and phone = ? limit 1",
      [cc, phone],
    );
    const user = rows[0];
    if (!user) {
      return NextResponse.json(
        { error: "该手机号未注册，请先完成注册" },
        { status: 404 },
      );
    }

    await setUserSession(user.id, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
