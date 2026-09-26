import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch("https://gen.pollinations.ai/v1/models", { cache: "no-store", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: "Could not load Pollinations model catalog." }, { status: response.status });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Pollinations model catalog unavailable." }, { status: 503 });
  }
}
