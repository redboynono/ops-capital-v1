/**
 * 共享的 OpenAI-兼容流式 helper（Gemini / MiniMax 都走这个端点）。
 *
 * 双角色：
 *   1. proxyChatCompletionStream() — 把上游 SSE chunk 透传成 plain-text Response
 *      （用于 /api/research/ask, /api/agents/run）
 *   2. collectChatCompletion() — 服务端自己消费 stream，得到完整 markdown
 *      （理论上不会用到，但留个出口）
 *
 * 共享：
 *   - <think>...</think> 跨 chunk 过滤
 *   - 错误 / 空响应处理
 *   - tap 回调，让调用方在每个增量发生时拿到一份（用来累计、计 tokens 等）
 */

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type ChatRequestOptions = {
  apiKey: string;
  baseUrl: string; // 不带 trailing /
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

function buildPayload(opts: ChatRequestOptions, stream: boolean) {
  return {
    model: opts.model,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 12000,
    stream,
    messages: opts.messages,
  };
}

async function callUpstream(opts: ChatRequestOptions, stream: boolean): Promise<Response> {
  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(buildPayload(opts, stream)),
  });
}

/**
 * 解析一个上游 SSE chunk 中的所有完整 `data:` 行，返回新的 buffer 余量 + 解出的 delta 数组。
 * <think>...</think> 在 caller 侧用 ThinkFilter 处理。
 */
function parseSseLines(buf: string): { remainder: string; deltas: string[] } {
  const lines = buf.split("\n");
  const remainder = lines.pop() ?? "";
  const deltas: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const json = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[];
      };
      const delta = json.choices?.[0]?.delta?.content ?? "";
      if (delta) deltas.push(delta);
    } catch {
      // malformed chunk — 跳过
    }
  }
  return { remainder, deltas };
}

/**
 * 跨 chunk 安全的 <think>...</think> 过滤器。
 * 用法：feed 每个增量进去，得到过滤后的输出片段。
 */
class ThinkFilter {
  private inThink = false;

  feed(delta: string): string {
    let out = delta;
    if (this.inThink) {
      const end = out.indexOf("</think>");
      if (end === -1) return "";
      out = out.slice(end + 8);
      this.inThink = false;
    }
    while (true) {
      const start = out.indexOf("<think>");
      if (start === -1) break;
      const end = out.indexOf("</think>", start);
      if (end === -1) {
        out = out.slice(0, start);
        this.inThink = true;
        break;
      }
      out = out.slice(0, start) + out.slice(end + 8);
    }
    return out;
  }
}

export type ProxyOptions = ChatRequestOptions & {
  /** 每次有过滤后的增量 emit 时回调（用于落库 / 计数） */
  onDelta?: (delta: string) => void;
  /** stream 全部读完时回调（含完整文本） */
  onComplete?: (full: string) => Promise<void> | void;
  /** 出错时回调（不影响 stream 关闭） */
  onError?: (err: Error) => Promise<void> | void;
};

/**
 * 把上游 SSE 流代理为 plain-text 增量 Response。失败时返回 JSON Response。
 */
export async function proxyChatCompletionStream(
  opts: ProxyOptions,
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await callUpstream(opts, true);
  } catch (err) {
    return Response.json(
      { error: "AI request failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      { error: "AI upstream error", detail: detail.slice(0, 300) },
      { status: 502 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = upstream.body!.getReader();
      const filter = new ThinkFilter();
      let buf = "";
      let full = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const { remainder, deltas } = parseSseLines(buf);
          buf = remainder;
          for (const raw of deltas) {
            const piece = filter.feed(raw);
            if (!piece) continue;
            full += piece;
            opts.onDelta?.(piece);
            controller.enqueue(encoder.encode(piece));
          }
        }

        if (full.length === 0) {
          const fallback = "（AI 返回为空，请重试）";
          controller.enqueue(encoder.encode(fallback));
          full = fallback;
        }

        try {
          await opts.onComplete?.(full);
        } catch (err) {
          await opts.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        try {
          await opts.onError?.(err instanceof Error ? err : new Error(message));
        } catch {
          /* swallow */
        }
        controller.enqueue(encoder.encode(`\n\n[stream error: ${message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * 服务端非流式调用（少用，主要用于 cron 内部生成）。
 * 若需要流式落库 / 计数，优先用 proxyChatCompletionStream + onDelta/onComplete。
 */
export async function collectChatCompletion(opts: ChatRequestOptions): Promise<string> {
  const upstream = await callUpstream(opts, false);
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`upstream ${upstream.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await upstream.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  // 后过滤 <think>
  const filter = new ThinkFilter();
  return filter.feed(content);
}

/**
 * 从 env 读取标准的 OpenAI-兼容三件套。
 */
export function getAIConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gemini-3.1-pro-preview",
    baseUrl:
      process.env.OPENAI_BASE_URL ??
      "https://generativelanguage.googleapis.com/v1beta/openai",
  };
}
