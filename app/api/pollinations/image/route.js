import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://gen.pollinations.ai";

export async function GET() {
  const configured = Boolean(process.env.POLLINATIONS_API_KEY);
  return NextResponse.json({ ok: true, configured, textModel: process.env.POLLINATIONS_TEXT_MODEL || "openai", imageModel: process.env.POLLINATIONS_IMAGE_MODEL || "flux" });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const prompt = String(body?.prompt || "").trim();
    const model = String(body?.model || process.env.POLLINATIONS_IMAGE_MODEL || "flux").trim();
    if (!prompt) return NextResponse.json({ error: "Image prompt is required." }, { status: 400 });
    const key = process.env.POLLINATIONS_API_KEY;
    if (!key) return NextResponse.json({ error: "Pollinations is not configured. Add POLLINATIONS_API_KEY in Vercel." }, { status: 503 });
    const response = await fetch(BASE_URL + "/v1/images/generations", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, n: 1, response_format: "url" })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.error?.message || data?.error || "Pollinations returned HTTP " + response.status }, { status: response.status });
    const image = data?.data?.[0];
    if (!image?.url && !image?.b64_json) return NextResponse.json({ error: "Pollinations returned no image." }, { status: 502 });
    return NextResponse.json({ ok: true, model, image: image.url ? { url: image.url } : { b64_json: image.b64_json } });
  } catch {
    return NextResponse.json({ error: "Invalid request or Pollinations image service error." }, { status: 500 });
  }
}
