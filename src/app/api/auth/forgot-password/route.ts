import { NextResponse } from "next/server";
import { mysqlQuery } from "@/lib/mysql";
import {
  generateResetToken,
  hashResetToken,
  resetTokenExpiryDate,
  toMySqlDateTime,
} from "@/lib/reset-token";
import { sendPasswordResetEmail } from "@/lib/mail";

type ForgotPasswordPayload = {
  email?: string;
};

type DbUser = {
  id: string;
  email: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ForgotPasswordPayload;
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const users = await mysqlQuery<DbUser[]>("select id, email from users where email = ? limit 1", [email]);
    const user = users[0];

    let resetUrlForDebug: string | null = null;

    if (user) {
      const token = generateResetToken();
      const tokenHash = hashResetToken(token);
      const expiresAt = resetTokenExpiryDate(30);

      await mysqlQuery(
        "update users set password_reset_token_hash = ?, password_reset_expires_at = ? where id = ?",
        [tokenHash, toMySqlDateTime(expiresAt), user.id],
      );

      const resetPath = `/reset-password?token=${token}`;
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const resetUrl = baseUrl ? `${baseUrl}${resetPath}` : resetPath;

      await sendPasswordResetEmail({
        to: email,
        resetUrl,
      });

      if (baseUrl) {
        resetUrlForDebug = resetUrl;
      } else {
        resetUrlForDebug = resetPath;
      }

      if (process.env.NODE_ENV === "production") {
        resetUrlForDebug = null;
      }

      return NextResponse.json({
        ok: true,
        message: "如果邮箱存在，我们已发送重置指引。",
        resetUrl: resetUrlForDebug,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "如果邮箱存在，我们已发送重置指引。",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
