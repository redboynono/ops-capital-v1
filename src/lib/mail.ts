type SendPasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  expiresMinutes?: number;
};

function buildResetHtml(resetUrl: string, expiresMinutes: number) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
  <h2 style="margin:0 0 12px">Reset your Ops Capital password</h2>
  <p style="margin:0 0 12px">We received a request to reset your password.</p>
  <p style="margin:0 0 12px">This link expires in ${expiresMinutes} minutes.</p>
  <p style="margin:0 0 16px"><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#10b981;color:#111827;text-decoration:none;border-radius:8px;font-weight:600">Reset password</a></p>
  <p style="margin:0 0 8px">If the button does not work, copy this URL into your browser:</p>
  <p style="margin:0;word-break:break-all">${resetUrl}</p>
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
      subject: "Reset your Ops Capital password",
      html: buildResetHtml(resetUrl, expiresMinutes),
      text: [
        "We received a request to reset your Ops Capital password.",
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
