import { randomBytes } from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";
import { siteUrl } from "@/lib/seo";
import { withUtm } from "@/lib/social/utm";

export type ShortLinkRow = {
  code: string;
  target_url: string;
  utm_source: string | null;
  utm_campaign: string | null;
  ref_key: string | null;
  clicks: number;
};

function randomCode(): string {
  return randomBytes(4).toString("base64url").replace(/[^a-zA-Z0-9]/g, "x").slice(0, 6);
}

function codeFromRef(refKey: string): string {
  const cleaned = refKey.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cleaned.length >= 4) return cleaned.slice(0, 8);
  return randomCode();
}

function isDuplicate(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /duplicate|ER_DUP_ENTRY/i.test(msg);
}

export async function getOrCreateShortLink(opts: {
  path: string;
  source: "x" | "xhs";
  campaign?: string;
  refKey?: string;
}): Promise<{ code: string; url: string; targetUrl: string }> {
  const targetUrl = withUtm(opts.path, { source: opts.source, campaign: opts.campaign });

  const existing = await mysqlQuery<Pick<ShortLinkRow, "code">[]>(
    "select code from short_links where target_url = ? limit 1",
    [targetUrl],
  );
  if (existing[0]) {
    const code = existing[0].code;
    return { code, url: siteUrl(`/s/${code}`), targetUrl };
  }

  let code = opts.refKey ? codeFromRef(opts.refKey) : randomCode();
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await mysqlQuery(
        `insert into short_links (code, target_url, utm_source, utm_medium, utm_campaign, ref_key)
         values (?, ?, ?, 'social', ?, ?)`,
        [code, targetUrl, opts.source, opts.campaign ?? null, opts.refKey ?? null],
      );
      return { code, url: siteUrl(`/s/${code}`), targetUrl };
    } catch (err) {
      if (!isDuplicate(err)) throw err;
      code = randomCode();
    }
  }
  throw new Error("short link code collision");
}

/** X 短链落地页强制英文（兼容存量 target_url 无 lang 参数） */
export function ensureEnglishLandingForX(targetUrl: string): string {
  try {
    const u = new URL(targetUrl);
    if (u.searchParams.get("utm_source") !== "x") return targetUrl;
    u.searchParams.set("lang", "en");
    return u.toString();
  } catch {
    return targetUrl;
  }
}

export async function resolveShortLink(code: string): Promise<string | null> {
  const rows = await mysqlQuery<Pick<ShortLinkRow, "target_url">[]>(
    "select target_url from short_links where code = ? limit 1",
    [code],
  );
  if (!rows[0]) return null;
  await mysqlQuery("update short_links set clicks = clicks + 1 where code = ?", [code]);
  return ensureEnglishLandingForX(rows[0].target_url);
}
