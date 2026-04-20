import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { mysqlQuery } from "@/lib/mysql";

type CreatePostPayload = {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  is_premium?: boolean;
  is_published?: boolean;
};

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admins = getAdminEmails();
    if (admins.length > 0 && !admins.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as CreatePostPayload;

    if (!body.title || !body.slug || !body.excerpt || !body.content) {
      return NextResponse.json({ error: "title, slug, excerpt, content are required" }, { status: 400 });
    }

    const id = randomUUID();

    await mysqlQuery(
      "insert into posts (id, title, slug, excerpt, content, is_premium, is_published, author_id) values (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        body.title,
        body.slug,
        body.excerpt,
        body.content,
        body.is_premium ?? true,
        body.is_published ?? false,
        user.id,
      ],
    );

    return NextResponse.json({ ok: true, post: { id, slug: body.slug } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
