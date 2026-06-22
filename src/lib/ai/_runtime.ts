/**
 * Shared AI runtime: model invocation + JSON extraction.
 *
 * Both `generateRating` and `generatePick` go through these helpers to
 * keep the model pluggable (OpenAI / MiniMax / etc.) and the JSON parsing
 * tolerant of common quirks (markdown fences, <think> tags, leading text).
 */

export async function callModel(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {},
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set on server");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const chatPath = process.env.OPENAI_CHAT_PATH ?? "/chat/completions";
  const defaultMax = Number(process.env.OPENAI_MAX_TOKENS ?? 4096);

  const res = await fetch(`${baseUrl}${chatPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? defaultMax,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upstream ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`Upstream err ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty model output");
  return stripModelNoise(content);
}

/** Strip reasoning / markdown noise from model output (Gemini thinking, MiniMax, etc.). */
export function stripModelNoise(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?(?:<\/redacted_thinking>|<\/think>)/gi, "")
    .replace(/<\/?think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

export function extractJson(raw: string): Record<string, unknown> {
  const stripped = stripModelNoise(raw);
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("no JSON object in model output");
  }
  return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}

/** Parse model JSON; tolerates truncated Gemini output when reply_draft string is complete. */
export function parseModelJsonField(raw: string, field: string): string {
  const trimmed = raw.trim();
  try {
    const j = extractJson(trimmed);
    const val = String(j[field] ?? "").trim();
    if (val) return val;
  } catch {
    /* fall through */
  }
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "s");
  const m = trimmed.match(re);
  if (m?.[1]) {
    try {
      return JSON.parse(`"${m[1]}"`).trim();
    } catch {
      return m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
    }
  }
  throw new Error(`no ${field} in model output`);
}
