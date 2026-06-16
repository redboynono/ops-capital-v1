import { unsubscribeByToken } from "@/lib/email-subscribers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(message: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OPS Alpha</title></head>
<body style="font-family:-apple-system,'PingFang SC',Arial,sans-serif;background:#0a0a0d;color:#e5e5e5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
  <div style="text-align:center;padding:32px">
    <h1 style="font-size:20px;color:#ff9900;margin:0 0 8px">OPS Alpha</h1>
    <p style="font-size:14px;color:#bdbdbd">${message}</p>
    <p style="margin-top:16px"><a href="https://opscapital.com" style="color:#ff9900;font-size:13px">← opscapital.com</a></p>
  </div>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const ok = await unsubscribeByToken(token);
  return html(ok ? "You've been unsubscribed. 已成功退订。" : "Invalid or expired link. 链接无效或已过期。");
}
