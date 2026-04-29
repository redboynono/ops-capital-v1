/**
 * Twilio Verify API 封装
 * --------------------------------------------------------------
 * 没有配置 TWILIO_VERIFY_SERVICE_SID 时，自动退化为进程内 dev stub。
 *
 * 生产环境环境变量：
 *   TWILIO_ACCOUNT_SID       AC...（必填）
 *   TWILIO_VERIFY_SERVICE_SID VA...（必填，开启 Twilio 模式）
 *   TWILIO_API_KEY_SID       SK...（推荐，最小权限）
 *   TWILIO_API_KEY_SECRET    与 SK 配对
 *   —— 或者 ——
 *   TWILIO_AUTH_TOKEN        AC 主账号 token（不推荐，权限大）
 */

type Entry = { code: string; expiresAt: number; tries: number };
const g = globalThis as unknown as { __smsStore?: Map<string, Entry> };
const store: Map<string, Entry> = g.__smsStore ?? new Map();
g.__smsStore = store;

const TTL_MS = 5 * 60 * 1000;

function key(countryCode: string, phone: string) {
  return `${countryCode}-${phone}`;
}

function e164(countryCode: string, phone: string) {
  const cc = countryCode.replace(/\D/g, "");
  const p = phone.replace(/\D/g, "");
  return `+${cc}${p}`;
}

function isTwilioConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_VERIFY_SERVICE_SID);
}

function twilioAuthHeader(): string {
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (apiKeySid && apiKeySecret) {
    return "Basic " + Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64");
  }
  if (authToken) {
    return "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  }
  throw new Error("Twilio credentials missing: set TWILIO_API_KEY_SID/SECRET or TWILIO_AUTH_TOKEN");
}

/* ============================================================ */
/*  Send                                                          */
/* ============================================================ */

export type SendResult = { ok: true; devCode?: string } | { ok: false; error: string };

export async function sendSmsCode(countryCode: string, phone: string): Promise<SendResult> {
  if (isTwilioConfigured()) {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID!;
    const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;
    const body = new URLSearchParams({ To: e164(countryCode, phone), Channel: "sms" });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: twilioAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        code?: number;
      };
      if (!res.ok) {
        return { ok: false, error: data.message ?? `Twilio HTTP ${res.status}` };
      }
      if (data.status !== "pending") {
        return { ok: false, error: `Twilio unexpected status: ${data.status ?? "unknown"}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Twilio request failed" };
    }
  }

  // -------- dev stub --------
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.set(key(countryCode, phone), { code, expiresAt: Date.now() + TTL_MS, tries: 0 });
  console.log(`[sms-stub] ${countryCode} ${phone} → ${code}`);
  return { ok: true, devCode: process.env.NODE_ENV !== "production" ? code : undefined };
}

/* ============================================================ */
/*  Verify                                                        */
/* ============================================================ */

export type VerifyResult = { ok: true } | { ok: false; error: string };

export async function verifySmsCode(
  countryCode: string,
  phone: string,
  code: string,
): Promise<VerifyResult> {
  if (isTwilioConfigured()) {
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID!;
    const url = `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`;
    const body = new URLSearchParams({ To: e164(countryCode, phone), Code: code });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: twilioAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        valid?: boolean;
        message?: string;
      };
      if (!res.ok) {
        // Twilio 在尝试次数耗尽 / 找不到 verification 时会 404
        if (res.status === 404) return { ok: false, error: "验证码不存在或已过期" };
        return { ok: false, error: data.message ?? `Twilio HTTP ${res.status}` };
      }
      if (data.status === "approved") return { ok: true };
      return { ok: false, error: "验证码错误" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Twilio request failed" };
    }
  }

  // -------- dev stub --------
  const k = key(countryCode, phone);
  const entry = store.get(k);
  if (!entry) return { ok: false, error: "验证码不存在或已过期" };
  if (Date.now() > entry.expiresAt) {
    store.delete(k);
    return { ok: false, error: "验证码已过期" };
  }
  if (entry.tries >= 5) {
    store.delete(k);
    return { ok: false, error: "尝试次数过多，请重新获取" };
  }
  if (entry.code !== code) {
    entry.tries += 1;
    return { ok: false, error: "验证码错误" };
  }
  store.delete(k);
  return { ok: true };
}
