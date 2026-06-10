import { NextResponse } from "next/server";
import { generateCaptcha } from "@/lib/captcha";

/**
 * GET /api/auth/captcha
 * 返回 { token, svg }
 *   token —— 后续提交表单时回传
 *   svg   —— 直接 dangerouslySetInnerHTML 渲染
 */
export async function GET() {
  const { token, svg } = generateCaptcha();
  return NextResponse.json(
    { token, svg },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}
