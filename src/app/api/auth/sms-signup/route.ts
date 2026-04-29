import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { mysqlQuery } from "@/lib/mysql";
import { setUserSession } from "@/lib/auth";
import { verifySmsCode } from "@/lib/sms";

type Payload = {
  countryCode?: string;
  phone?: string;
  smsCode?: string;
  email?: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type ExistingRow = { id: string; field: string };

const USERNAME_RE = /^[A-Za-z0-9_-]{3,32}$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const cc = (body.countryCode ?? "").trim();
    const phone = (body.phone ?? "").replace(/\D/g, "");
    const smsCode = (body.smsCode ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const username = body.username ? String(body.username).trim() : null;
    const firstName = body.firstName ? String(body.firstName).trim().slice(0, 64) : null;
    const lastName = body.lastName ? String(body.lastName).trim().slice(0, 64) : null;

    if (!cc || !phone) return NextResponse.json({ error: "手机号不能为空" }, { status: 400 });
    if (!email) return NextResponse.json({ error: "邮箱不能为空" }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
    }
    if (!/^\d{4,8}$/.test(smsCode)) {
      return NextResponse.json({ error: "验证码格式不正确" }, { status: 400 });
    }
    if (username && !USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "用户名仅允许 3-32 位字母、数字、_ 或 -" },
        { status: 400 },
      );
    }

    // 校验验证码
    const v = await verifySmsCode(cc, phone, smsCode);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    // 唯一性预检
    const params: (string | null)[] = [email, cc, phone];
    let usernameClause = "";
    if (username) {
      usernameClause = " union all select id, 'username' as field from users where username = ?";
      params.push(username);
    }
    const conflicts = await mysqlQuery<ExistingRow[]>(
      `select id, 'email' as field from users where email = ?
       union all
       select id, 'phone' as field from users where country_code = ? and phone = ?
       ${usernameClause}`,
      params,
    );
    if (conflicts.length > 0) {
      const f = conflicts[0].field;
      const msg =
        f === "email" ? "该邮箱已注册" : f === "phone" ? "该手机号已注册" : "用户名已被占用";
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    const fullName = [lastName, firstName].filter(Boolean).join(" ") || null;
    const userId = randomUUID();
    await mysqlQuery(
      `insert into users (
         id, email, username, first_name, last_name, country_code, phone,
         password_hash, full_name, subscription_status
       ) values (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'inactive')`,
      [userId, email, username, firstName, lastName, cc, phone, fullName],
    );

    await setUserSession(userId, email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
