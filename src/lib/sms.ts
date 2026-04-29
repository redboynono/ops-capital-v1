/**
 * 智能短信网关
 * --------------------------------------------------------------
 * 路由策略：
 *   +86         → 阿里云短信（必须，Twilio 在中国大陆需要 use case vetting）
 *   其他全部     → Twilio Verify（一条龙：生成 / 存储 / 校验 / 限频）
 *
 * 任一通道未配置时自动退化为 dev stub（控制台打印 + 返回 devCode）。
 *
 * 阿里云需要我们自己生成 6 位验证码、存到进程内 Map（生产应换 Redis）。
 * Twilio Verify 不需要本地存储，由 Twilio 服务端管理。
 */

import { createHmac, randomUUID } from "node:crypto";

/* ============================================================ */
/*  Local code store (for Aliyun + dev stub)                      */
/* ============================================================ */

type Entry = { code: string; expiresAt: number; tries: number };
const g = globalThis as unknown as { __smsStore?: Map<string, Entry> };
const store: Map<string, Entry> = g.__smsStore ?? new Map();
g.__smsStore = store;

const TTL_MS = 5 * 60 * 1000;
const localKey = (cc: string, p: string) => `${cc}-${p}`;

function setLocalCode(cc: string, p: string, code: string) {
  store.set(localKey(cc, p), { code, expiresAt: Date.now() + TTL_MS, tries: 0 });
}

function checkLocalCode(
  cc: string,
  p: string,
  code: string,
): { ok: true } | { ok: false; error: string } {
  const k = localKey(cc, p);
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

const e164 = (cc: string, phone: string) =>
  `+${cc.replace(/\D/g, "")}${phone.replace(/\D/g, "")}`;

/* ============================================================ */
/*  Provider detection                                            */
/* ============================================================ */

function isAliyunConfigured() {
  return !!(
    process.env.ALIYUN_SMS_ACCESS_KEY_ID &&
    process.env.ALIYUN_SMS_ACCESS_KEY_SECRET &&
    process.env.ALIYUN_SMS_SIGN_NAME &&
    process.env.ALIYUN_SMS_TEMPLATE_CODE
  );
}

function isTwilioConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_VERIFY_SERVICE_SID);
}

function pickProvider(countryCode: string): "aliyun" | "twilio" | "stub" {
  if (countryCode === "+86" && isAliyunConfigured()) return "aliyun";
  if (countryCode !== "+86" && isTwilioConfigured()) return "twilio";
  // 兜底：+86 无阿里云时尝试 Twilio（大概率失败）；其他无 Twilio 时退化 stub
  if (isTwilioConfigured()) return "twilio";
  return "stub";
}

/* ============================================================ */
/*  Aliyun SMS                                                    */
/* ============================================================ */

// RFC 3986 严格 percent-encoding（阿里云签名要求）
function aliyunEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

/**
 * 阿里云短信 SendSms 调用，RPC 风格 + HMAC-SHA1 签名。
 * 文档：https://help.aliyun.com/zh/sms/developer-reference/api-dysmsapi-2017-05-25-sendsms
 */
async function aliyunSend(
  phone: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET!;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME!;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE!;

  const phoneNumber = phone.replace(/\D/g, "");

  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: phoneNumber,
    SignName: signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: randomUUID(),
    SignatureVersion: "1.0",
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  };

  const sortedKeys = Object.keys(params).sort();
  const canonical = sortedKeys
    .map((k) => `${aliyunEncode(k)}=${aliyunEncode(params[k])}`)
    .join("&");
  const stringToSign = `GET&${aliyunEncode("/")}&${aliyunEncode(canonical)}`;
  const signature = createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  const url = `https://dysmsapi.aliyuncs.com/?${canonical}&Signature=${aliyunEncode(signature)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as {
      Code?: string;
      Message?: string;
    };
    if (!res.ok || data.Code !== "OK") {
      return { ok: false, error: data.Message ?? `阿里云 HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "阿里云请求失败" };
  }
}

/* ============================================================ */
/*  Twilio Verify                                                 */
/* ============================================================ */

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
  throw new Error("Twilio credentials missing");
}

async function twilioSend(
  countryCode: string,
  phone: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
    };
    if (!res.ok) return { ok: false, error: data.message ?? `Twilio HTTP ${res.status}` };
    if (data.status !== "pending") {
      return { ok: false, error: `Twilio unexpected status: ${data.status ?? "unknown"}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Twilio 请求失败" };
  }
}

async function twilioCheck(
  countryCode: string,
  phone: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
      message?: string;
    };
    if (!res.ok) {
      if (res.status === 404) return { ok: false, error: "验证码不存在或已过期" };
      return { ok: false, error: data.message ?? `Twilio HTTP ${res.status}` };
    }
    return data.status === "approved" ? { ok: true } : { ok: false, error: "验证码错误" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Twilio 请求失败" };
  }
}

/* ============================================================ */
/*  Public API                                                    */
/* ============================================================ */

export type SendResult = { ok: true; devCode?: string } | { ok: false; error: string };
export type VerifyResult = { ok: true } | { ok: false; error: string };

export async function sendSmsCode(countryCode: string, phone: string): Promise<SendResult> {
  const provider = pickProvider(countryCode);

  if (provider === "twilio") {
    const r = await twilioSend(countryCode, phone);
    return r.ok ? { ok: true } : r;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  setLocalCode(countryCode, phone, code);

  if (provider === "aliyun") {
    const r = await aliyunSend(phone, code);
    return r.ok ? { ok: true } : r;
  }

  console.log(`[sms-stub] ${countryCode} ${phone} → ${code}`);
  return {
    ok: true,
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export async function verifySmsCode(
  countryCode: string,
  phone: string,
  code: string,
): Promise<VerifyResult> {
  const provider = pickProvider(countryCode);
  if (provider === "twilio") return twilioCheck(countryCode, phone, code);
  return checkLocalCode(countryCode, phone, code);
}
