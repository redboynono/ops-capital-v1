import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { mysqlQuery } from "@/lib/mysql";
import { setUserSession } from "@/lib/auth";

type SignUpPayload = {
  email?: string;
  password?: string;
  fullName?: string;
};

type ExistingUser = { id: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SignUpPayload;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const fullName = body.fullName?.trim() || null;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await mysqlQuery<ExistingUser[]>("select id from users where email = ? limit 1", [email]);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    await mysqlQuery(
      "insert into users (id, email, password_hash, full_name, subscription_status) values (?, ?, ?, ?, 'inactive')",
      [userId, email, passwordHash, fullName],
    );

    await setUserSession(userId, email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
