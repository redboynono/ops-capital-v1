import { NextResponse } from "next/server";
import { buildResearchUserPrompt, researchSystemPrompt } from "@/lib/ai/researchSystemPrompt";

type GeneratePayload = {
  target?: string;
  focus?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GeneratePayload;
    const target = body.target?.trim();

    if (!target) {
      return NextResponse.json({ error: "target is required" }, { status: 400 });
    }

    const userPrompt = buildResearchUserPrompt(target, body.focus);
    const geminiApiKey = process.env.GEMINI_API_KEY;

    let content: unknown;

    if (geminiApiKey) {
      const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
      const proxyUrl =
        process.env.GEMINI_PROXY_URL ??
        process.env.HTTPS_PROXY ??
        process.env.HTTP_PROXY;

      let dispatcher: unknown;

      if (proxyUrl) {
        const undici = await import("undici");
        dispatcher = new undici.ProxyAgent(proxyUrl);
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: researchSystemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.35,
          },
        }),
        ...(dispatcher ? { dispatcher } : {}),
      } as RequestInit);

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { error: "Gemini API error", detail: errorText },
          { status: 502 },
        );
      }

      const data = await response.json();
      content = data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part?.text ?? "")
        .join("\n");
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

      if (!apiKey) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY or OPENAI_API_KEY is required on server" },
          { status: 500 },
        );
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          messages: [
            { role: "system", content: researchSystemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { error: "Upstream model API error", detail: errorText },
          { status: 502 },
        );
      }

      const data = await response.json();
      content = data?.choices?.[0]?.message?.content;
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }

    return NextResponse.json({ content });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: "Failed to generate report", detail }, { status: 500 });
  }
}
