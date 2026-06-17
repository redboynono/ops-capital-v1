import { randomBytes } from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";
import { logEvent } from "@/lib/observability";
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

function codeFromRef(refKey: string, lang?: "zh" | "en"): string {
  const cleaned = refKey.toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = cleaned.length >= 4 ? cleaned.slice(0, 7) : randomCode().slice(0, 7);
  // 中英各一条独立短链，code 末位区分（z/e），避免 target_url 不同但 code 冲突
  return lang ? `${base}${lang === "zh" ? "z" : "e"}` : base.slice(0, 8);
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
  lang?: "zh" | "en";
}): Promise<{ code: string; url: string; targetUrl: string }> {
  const targetUrl = withUtm(opts.path, { source: opts.source, campaign: opts.campaign, lang: opts.lang });

  const existing = await mysqlQuery<Pick<ShortLinkRow, "code">[]>(
    "select code from short_links where target_url = ? limit 1",
    [targetUrl],
  );
  if (existing[0]) {
    const code = existing[0].code;
    return { code, url: siteUrl(`/s/${code}`), targetUrl };
  }

  let code = opts.refKey ? codeFromRef(opts.refKey, opts.lang) : randomCode();
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

/** X 短链落地页：尊重 target_url 中显式 lang；仅对无 lang 的存量 X 链接兜底英文 */
export function ensureEnglishLandingForX(targetUrl: string): string {
  try {
    const u = new URL(targetUrl);
    if (u.searchParams.get("utm_source") !== "x") return targetUrl;
    if (u.searchParams.get("lang")) return u.toString();
    u.searchParams.set("lang", "en");
    return u.toString();
  } catch {
    return targetUrl;
  }
}

export async function resolveShortLink(code: string): Promise<string | null> {
  const rows = await mysqlQuery<
    Pick<ShortLinkRow, "target_url" | "ref_key" | "utm_campaign" | "utm_source">[]
  >(
    "select target_url, ref_key, utm_campaign, utm_source from short_links where code = ? limit 1",
    [code],
  );
  if (!rows[0]) return null;
  await mysqlQuery("update short_links set clicks = clicks + 1 where code = ?", [code]);
  const row = rows[0];
  logEvent("short_link_click", {
    meta: {
      code,
      ref_key: row.ref_key,
      utm_campaign: row.utm_campaign,
      utm_source: row.utm_source,
      content_bucket: row.ref_key?.startsWith("chokepoint-")
        ? "chokepoint"
        : row.ref_key?.startsWith("daily-")
          ? "daily"
          : row.ref_key?.startsWith("track_record_")
            ? "track_record"
            : row.ref_key,
    },
  });
  return ensureEnglishLandingForX(row.target_url);
}
