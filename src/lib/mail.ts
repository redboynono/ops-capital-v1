type SendPasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresMinutes?: number;
};

function buildResetHtml(resetUrl: string, expiresMinutes: number) {
  return `<div style="font-family:-apple-system,'PingFang SC',Arial,sans-serif;line-height:1.7;color:#111827;max-width:520px;margin:0 auto;padding:24px">
  <div style="border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px">
    <h2 style="margin:0;font-size:18px;color:#c2462a">OPS Alpha · 重置密码</h2>
  </div>
  <p style="margin:0 0 12px">您好，</p>
  <p style="margin:0 0 12px">我们收到了您的 OPS Alpha 账号密码重置请求。点击下方按钮设置新密码：</p>
  <p style="margin:16px 0 20px">
    <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#e15a3c;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:600;font-size:14px">重置密码</a>
  </p>
  <p style="margin:0 0 8px;color:#6b7280;font-size:13px">该链接在 ${expiresMinutes} 分钟后失效。</p>
  <p style="margin:0 0 8px;color:#6b7280;font-size:13px">若按钮无法点击，请复制下方链接到浏览器打开：</p>
  <p style="margin:0;word-break:break-all;font-size:12px;color:#9ca3af">${resetUrl}</p>
  <p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px">
    如果您没有发起此请求，请忽略此邮件。<br/>
    — OPS Capital · AI 投研终端
  </p>
</div>`;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  expiresMinutes = 30,
}: SendPasswordResetEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !from) {
    console.log(`Password reset email fallback for ${to}: ${resetUrl}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "OPS Alpha · 重置密码",
      html: buildResetHtml(resetUrl, expiresMinutes),
      text: [
        "We received a request to reset your Ops Alpha password.",
        `This link expires in ${expiresMinutes} minutes.`,
        `Reset URL: ${resetUrl}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send reset email: ${response.status} ${body}`);
  }
}
