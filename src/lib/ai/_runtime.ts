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
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set on server");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const chatPath = process.env.OPENAI_CHAT_PATH ?? "/chat/completions";

  const res = await fetch(`${baseUrl}${chatPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? Number(process.env.OPENAI_MAX_TOKENS ?? 4096),
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
  return content;
}

export function extractJson(raw: string): Record<string, unknown> {
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("no JSON object in model output");
  }
  return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}
