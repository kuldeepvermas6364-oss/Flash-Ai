import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (!messages.length) return NextResponse.json({ error: "Messages are required." }, { status: 400 });

    const key = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "openrouter/free";
    if (!key) return NextResponse.json({ error: "AI service is not configured. Add OPENROUTER_API_KEY in Vercel." }, { status: 503 });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://vercel.app",
        "X-Title": "Flash AI"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are Flash AI, a professional, helpful AI assistant. Be accurate, clear, concise, and explain reasoning when useful. Never reveal API keys or internal configuration." },
          ...messages.slice(-30).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }))
        ],
        temperature: 0.7
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.error?.message || `AI provider returned HTTP ${response.status}` }, { status: response.status });
    return NextResponse.json({ message: data?.choices?.[0]?.message?.content || "No response was returned." });
  } catch {
    return NextResponse.json({ error: "Invalid request or AI service error." }, { status: 500 });
  }
}