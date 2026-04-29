import { NextResponse } from "next/server";
import { mysqlQuery } from "@/lib/mysql";
import { verifyPassword } from "@/lib/password";
import { setUserSession } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";

type Payload = {
  identifier?: string; // 邮箱 或 用户名
  email?: string; // 兼容老前端
  password?: string;
  captcha?: string;
  captchaToken?: string;
};

type DbUser = {
  id: string;
  email: string;
  password_hash: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    const captcha = verifyCaptcha(body.captchaToken, body.captcha);
    if (!captcha.ok) return NextResponse.json({ error: captcha.error }, { status: 400 });

    const identifier = (body.identifier ?? body.email ?? "").trim();
    const password = body.password ?? "";
    if (!identifier || !password) {
      return NextResponse.json({ error: "请填写账号和密码" }, { status: 400 });
    }

    // 邮箱（含 @）走 email；其他都按 username 查
    const isEmail = identifier.includes("@");
    const users = await mysqlQuery<DbUser[]>(
      isEmail
        ? "select id, email, password_hash from users where email = ? limit 1"
        : "select id, email, password_hash from users where username = ? limit 1",
      [isEmail ? identifier.toLowerCase() : identifier],
    );

    const user = users[0];
    if (!user || !user.password_hash) {
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
    }

    await setUserSession(user.id, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
