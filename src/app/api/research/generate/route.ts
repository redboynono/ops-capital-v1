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

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing on server" },
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
          { role: "user", content: buildResearchUserPrompt(target, body.focus) },
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
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Empty model response" }, { status: 502 });
    }

    return NextResponse.json({ content });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: "Failed to generate report", detail }, { status: 500 });
  }
}
