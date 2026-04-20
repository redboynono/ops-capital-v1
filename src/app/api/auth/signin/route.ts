import { NextResponse } from "next/server";
import { mysqlQuery } from "@/lib/mysql";
import { verifyPassword } from "@/lib/password";
import { setUserSession } from "@/lib/auth";

type SignInPayload = {
  email?: string;
  password?: string;
};

type DbUser = {
  id: string;
  email: string;
  password_hash: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SignInPayload;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const users = await mysqlQuery<DbUser[]>(
      "select id, email, password_hash from users where email = ? limit 1",
      [email],
    );

    const user = users[0];
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await setUserSession(user.id, user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
