import { NextResponse } from "next/server";
import { mysqlQuery } from "@/lib/mysql";
import { hashPassword } from "@/lib/password";
import { hashResetToken } from "@/lib/reset-token";

type ResetPasswordPayload = {
  token?: string;
  password?: string;
};

type ResetTarget = {
  id: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ResetPasswordPayload;
    const token = body.token?.trim();
    const password = body.password ?? "";

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const tokenHash = hashResetToken(token);

    const targets = await mysqlQuery<ResetTarget[]>(
      "select id from users where password_reset_token_hash = ? and password_reset_expires_at > utc_timestamp() limit 1",
      [tokenHash],
    );

    const target = targets[0];
    if (!target) {
      return NextResponse.json({ error: "Reset token is invalid or expired" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    await mysqlQuery(
      "update users set password_hash = ?, password_reset_token_hash = null, password_reset_expires_at = null where id = ?",
      [passwordHash, target.id],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
