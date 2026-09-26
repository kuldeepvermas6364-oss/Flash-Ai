import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const response = await fetch("https://gen.pollinations.ai/v1/models", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: "Could not load Pollinations model catalog." }, { status: response.status });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Pollinations model catalog unavailable." }, { status: 503 });
  }
}
