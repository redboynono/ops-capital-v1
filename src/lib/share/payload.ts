import type { PickPoster, PostPoster } from "@/components/share/share-slides";

export type ShareInput = Omit<PostPoster, "url"> | Omit<PickPoster, "url">;

export type ShareBundle = {
  url: string;
  title: string;
  subtitle: string;
  /** 复制 / 系统分享用 */
  plainText: string;
  /** 小红书粘贴用：标题 + 摘要 + 链接 + 话题 */
  xiaohongshuText: string;
  /** 微信好友分享文案（较短） */
  wechatText: string;
  hashtags: string[];
};

const DEFAULT_TAGS = ["OPS Alpha", "投研", "美股"];

function kindLabel(data: ShareInput): string {
  if (data.type === "pick") return "OPS 精选";
  return data.kind === "analysis" ? "深度研报" : "市场快讯";
}

function pickTags(data: ShareInput): string[] {
  if (data.type === "pick") return [data.symbol, "OPS Alpha", "精选"];
  const tickers = data.tickers?.slice(0, 3) ?? [];
  const base = data.kind === "analysis" ? ["深度研报", "OPS Alpha"] : ["市场快讯", "OPS Alpha"];
  return [...new Set([...tickers, ...base])];
}

export function buildShareBundle(data: ShareInput, url: string): ShareBundle {
  const label = kindLabel(data);
  const tags = pickTags(data);
  const tagLine = tags.map((t) => (t.startsWith("#") ? t : `#${t.replace(/\s+/g, "")}`)).join(" ");

  if (data.type === "pick") {
    const title = `${data.symbol} · ${data.title}`;
    const subtitle = data.subtitle?.trim() || `${label} · ${data.status === "open" ? "持仓中" : "已平仓"}`;
    const plainText = `${title}\n${subtitle}\n\n${url}`;
    const xiaohongshuText = `${title}\n${subtitle}\n\n${url}\n\n${tagLine}`;
    const wechatText = `${title}\n${url}`;
    return { url, title, subtitle, plainText, xiaohongshuText, wechatText, hashtags: tags };
  }

  const title = data.title;
  const excerpt = data.excerpt?.trim() || "";
  const subtitle = excerpt || label;
  const plainText = excerpt
    ? `${title}\n\n${excerpt}\n\n${url}`
    : `${title}\n\n${url}`;
  const xiaohongshuText = excerpt
    ? `${title}\n\n${excerpt}\n\n${url}\n\n${tagLine}`
    : `${title}\n\n${url}\n\n${tagLine}`;
  const wechatText = excerpt ? `${title}\n${excerpt.slice(0, 80)}…\n${url}` : `${title}\n${url}`;

  return { url, title, subtitle, plainText, xiaohongshuText, wechatText, hashtags: tags };
}

export function isWeChatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
