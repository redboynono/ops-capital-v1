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
/*  Aliyun Dypnsapi (号码认证服务 · OTP 一条龙)                    */
/*  https://next.api.aliyun.com/document/Dypnsapi/2017-05-25/     */
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
 * 阿里云 RPC v1 风格调用（HMAC-SHA1 签名）
 * @param action  Dypnsapi action 名（SendSmsVerifyCode / CheckSmsVerifyCode）
 * @param extra   业务参数（不含公共参数）
 */
async function aliyunCall(
  action: string,
  extra: Record<string, string>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET!;

  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: action,
    Format: "JSON",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
    ...extra,
  };

  const sortedKeys = Object.keys(params).sort();
  const canonical = sortedKeys
    .map((k) => `${aliyunEncode(k)}=${aliyunEncode(params[k])}`)
    .join("&");
  const stringToSign = `GET&${aliyunEncode("/")}&${aliyunEncode(canonical)}`;
  const signature = createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  const url = `https://dypnsapi.aliyuncs.com/?${canonical}&Signature=${aliyunEncode(signature)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as {
      Code?: string;
      Message?: string;
      [k: string]: unknown;
    };
    if (!res.ok || data.Code !== "OK") {
      return { ok: false, error: data.Message ?? `阿里云 HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "阿里云请求失败" };
  }
}

/**
 * SendSmsVerifyCode：阿里云生成验证码、发送短信、服务端存储。
 * 不需要我们自己管 code，校验时直接调 CheckSmsVerifyCode。
 */
async function aliyunSend(
  phone: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const signName = process.env.ALIYUN_SMS_SIGN_NAME!;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE!;
  const schemeName = process.env.ALIYUN_SMS_SCHEME_NAME ?? "";

  const phoneNumber = phone.replace(/\D/g, "");

  const result = await aliyunCall("SendSmsVerifyCode", {
    PhoneNumber: phoneNumber,
    SignName: signName,
    TemplateCode: templateCode,
    CodeType: "1", // 1=纯数字
    CodeLength: "6",
    ValidTime: "300", // 5 分钟
    Interval: "55", // 同号 55s 内不允许重复发送
    ReturnVerifyCode: "false",
    ...(schemeName ? { SchemeName: schemeName } : {}),
  });

  if (!result.ok) return { ok: false, error: result.error };

  // SendSmsVerifyCode 返回 Model.VerifyCodeId，可保存做幂等，但当前流程不需要
  const model = (result.data.Model ?? {}) as { Success?: boolean };
  if (model && "Success" in model && model.Success === false) {
    return { ok: false, error: (result.data.Message as string) ?? "短信发送失败" };
  }
  return { ok: true };
}

/**
 * CheckSmsVerifyCode：阿里云校验。返回 VerifyResult: PASS / NONE / NO_MATCH
 */
async function aliyunCheck(
  phone: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const schemeName = process.env.ALIYUN_SMS_SCHEME_NAME ?? "";
  const phoneNumber = phone.replace(/\D/g, "");

  const result = await aliyunCall("CheckSmsVerifyCode", {
    PhoneNumber: phoneNumber,
    VerifyCode: code,
    ...(schemeName ? { SchemeName: schemeName } : {}),
  });

  if (!result.ok) return { ok: false, error: result.error };

  const model = (result.data.Model ?? {}) as { VerifyResult?: string };
  switch (model.VerifyResult) {
    case "PASS":
      return { ok: true };
    case "NONE":
      return { ok: false, error: "验证码不存在或已过期" };
    case "NO_MATCH":
      return { ok: false, error: "验证码错误" };
    default:
      return { ok: false, error: `校验失败：${model.VerifyResult ?? "unknown"}` };
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

  if (provider === "aliyun") {
    const r = await aliyunSend(phone);
    return r.ok ? { ok: true } : r;
  }

  // stub：本地生成 + 控制台打印
  const code = String(Math.floor(100000 + Math.random() * 900000));
  setLocalCode(countryCode, phone, code);
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
  if (provider === "aliyun") return aliyunCheck(phone, code);
  return checkLocalCode(countryCode, phone, code);
}
