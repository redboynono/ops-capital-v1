import { NextResponse } from "next/server";
import { clearUserSession } from "@/lib/auth";

/**
 * 登出 endpoint。
 * 站内 SIGN OUT / LOGOUT 按钮通过 <form method="post"> 提交。
 * GET 走兜底（地址栏直接访问也能登出）。
 *
 * Note：用相对路径 `Location: /` 而非绝对 URL —— 容器内 req.url 是 http://localhost:3000，
 * 反向代理后 NextResponse.redirect(new URL("/", req.url)) 会让浏览器跳到 localhost。
 * RFC 7231 允许 Location 用相对引用，浏览器按其访问 URL 解析（即 https://opscapital.com/）。
 *
 * 303 强制浏览器把 form-POST 改写成 GET 不重放。
 */
async function signOutAndRedirect() {
  await clearUserSession();
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/" },
  });
}

export async function POST() {
  return signOutAndRedirect();
}

export async function GET() {
  return signOutAndRedirect();
}
