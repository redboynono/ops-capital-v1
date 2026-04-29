import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 图形验证码（无状态）
 * --------------------------------------------------------------
 * 服务端生成 4 位字符 + HMAC 签名 token。前端拿 SVG 显示，提交时
 * 把 token 一起回传，后端用同 secret 验签 + 检查过期 + 比对。
 *
 * 没有任何服务端存储 → 重启即失效，但同时也不需要 Redis。
 */

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉容易混淆的 0/O/1/I
const TTL_MS = 5 * 60 * 1000;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Missing SESSION_SECRET");
  return s + "::captcha";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

// 把 code 摘要为不可逆的 hash（同输入恒定输出，但 token 不暴露明文）
function hashCode(code: string): string {
  return createHmac("sha256", getSecret())
    .update("code::" + code.toUpperCase())
    .digest("base64url");
}

export type Captcha = { token: string; svg: string };

export function generateCaptcha(): Captcha {
  const code = Array.from(
    { length: 4 },
    () => CHARS[Math.floor(Math.random() * CHARS.length)],
  ).join("");
  const exp = Date.now() + TTL_MS;
  // 注意：payload 里只放 hash，不放明文 code
  const payload = Buffer.from(JSON.stringify({ h: hashCode(code), e: exp })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  return { token, svg: renderSvg(code) };
}

export function verifyCaptcha(
  token: string | undefined | null,
  input: string | undefined | null,
): { ok: true } | { ok: false; error: string } {
  if (!token || !input) return { ok: false, error: "请填写图形验证码" };
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { ok: false, error: "验证码已失效，请刷新" };

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "验证码已失效，请刷新" };
  }

  try {
    const { h, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      h: string;
      e: number;
    };
    if (Date.now() > e) return { ok: false, error: "验证码已过期，请刷新" };

    const inputHash = hashCode(input.trim());
    const ha = Buffer.from(inputHash);
    const hb = Buffer.from(h);
    if (ha.length !== hb.length || !timingSafeEqual(ha, hb)) {
      return { ok: false, error: "验证码错误" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "验证码已失效，请刷新" };
  }
}

/* ---------------------------- SVG render ---------------------------- */

function renderSvg(code: string): string {
  const W = 140;
  const H = 44;
  const palette = ["#ff9900", "#ffb84d", "#e8e8ea"]; // 与 terminal 主题统一

  // 干扰线
  const lines = Array.from({ length: 5 }, () => {
    const x1 = rand(0, W);
    const y1 = rand(0, H);
    const x2 = rand(0, W);
    const y2 = rand(0, H);
    const c = palette[Math.floor(Math.random() * palette.length)];
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-opacity="0.35" stroke-width="1"/>`;
  }).join("");

  // 干扰点
  const dots = Array.from({ length: 28 }, () => {
    const x = rand(0, W);
    const y = rand(0, H);
    const r = rand(0.4, 1.6);
    const c = palette[Math.floor(Math.random() * palette.length)];
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity="0.45"/>`;
  }).join("");

  // 字符
  const chars = code
    .split("")
    .map((ch, i) => {
      const x = (14 + i * 28 + rand(-3, 3)).toFixed(1);
      const y = (30 + rand(-3, 3)).toFixed(1);
      const rot = rand(-18, 18).toFixed(1);
      const c = palette[i % palette.length];
      return `<text x="${x}" y="${y}" font-family="Menlo,Consolas,monospace" font-size="22" font-weight="700" fill="${c}" transform="rotate(${rot} ${x} ${y})">${ch}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#141418"/>${lines}${dots}${chars}</svg>`;
}

function rand(min: number, max: number): number {
  return +(Math.random() * (max - min) + min).toFixed(1);
}
