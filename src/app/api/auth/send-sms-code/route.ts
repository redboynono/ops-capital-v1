import { NextResponse } from "next/server";
import { sendSmsCode } from "@/lib/sms";

/**
 * 发送短信验证码
 * - 真实发送通过 src/lib/sms.ts（Twilio Verify API）
 * - Twilio 未配置时自动退化为 dev stub（控制台打印 + 响应里返回 devCode）
 */

const rateLimit = new Map<string, number>();
const MIN_INTERVAL_MS = 55 * 1000;

export async function POST(req: Request) {
  try {
    const { phone, countryCode } = (await req.json()) as {
      phone?: string;
      countryCode?: string;
    };
    const cc = (countryCode ?? "").trim();
    const p = (phone ?? "").replace(/\D/g, "");
    if (!cc || !p) {
      return NextResponse.json({ error: "手机号不能为空" }, { status: 400 });
    }
    if (cc === "+86" && !/^1\d{10}$/.test(p)) {
      return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
    }
    if (cc !== "+86" && (p.length < 6 || p.length > 15)) {
      return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
    }

    const k = `${cc}-${p}`;
    const now = Date.now();
    const last = rateLimit.get(k);
    if (last && now - last < MIN_INTERVAL_MS) {
      return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }
    rateLimit.set(k, now);

    const result = await sendSmsCode(cc, p);
    if (!result.ok) {
      rateLimit.delete(k); // 失败不占用速率窗口
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, ...(result.devCode ? { devCode: result.devCode } : {}) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
