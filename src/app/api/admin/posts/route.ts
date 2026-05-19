import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { bulkSetPublished, listAllPostsAdmin } from "@/lib/posts";
import { mysqlQuery } from "@/lib/mysql";
import { setPostTickers } from "@/lib/tickers";

export const dynamic = "force-dynamic";

type Payload = {
  id?: string;
  title?: string;
  slug?: string;
  kind?: "analysis" | "news";
  excerpt?: string;
  content?: string;
  is_premium?: boolean;
  is_published?: boolean;
  tickers?: string[];
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const kind = req.nextUrl.searchParams.get("kind");
  const published = req.nextUrl.searchParams.get("published") as "all" | "published" | "draft" | null;
  const posts = await listAllPostsAdmin({
    kind: kind === "news" ? "news" : kind === "analysis" ? "analysis" : undefined,
    published: published ?? "all",
  });
  return NextResponse.json({ posts });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    ids?: string[];
    published?: boolean;
  } | null;
  if (!body?.action || !Array.isArray(body.ids)) {
    return NextResponse.json({ error: "action and ids required" }, { status: 400 });
  }
  if (body.action === "set_published" && typeof body.published === "boolean") {
    await bulkSetPublished(body.ids, body.published);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Payload | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const title = body.title?.trim();
  const slug = body.slug?.trim();
  const excerpt = body.excerpt?.trim() ?? "";
  const content = body.content ?? "";
  const kind = body.kind === "news" ? "news" : "analysis";
  const isPremium = kind === "news" ? false : !!body.is_premium;
  const isPublished = !!body.is_published;
  const tickers = (body.tickers ?? []).map((s) => s.toUpperCase().trim()).filter(Boolean);

  if (!title || !slug || !content) {
    return NextResponse.json({ error: "title/slug/content required" }, { status: 400 });
  }

  // upsert by slug
  const existing = await mysqlQuery<{ id: string }[]>(
    "select id from posts where slug = ? limit 1",
    [slug],
  );

  let id = existing[0]?.id ?? body.id ?? randomUUID();

  if (existing[0]) {
    id = existing[0].id;
    await mysqlQuery(
      `update posts set title = ?, kind = ?, excerpt = ?, content = ?, is_premium = ?, is_published = ?
       where id = ?`,
      [title, kind, excerpt, content, isPremium ? 1 : 0, isPublished ? 1 : 0, id],
    );
  } else {
    await mysqlQuery(
      `insert into posts (id, title, slug, kind, excerpt, content, is_premium, is_published, author_id)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, slug, kind, excerpt, content, isPremium ? 1 : 0, isPublished ? 1 : 0, auth.user.id],
    );
  }

  await setPostTickers(id, tickers);

  return NextResponse.json({ ok: true, post: { id, slug, kind } });
}
