import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE_URL = "https://gen.pollinations.ai";
const DEFAULT_MODEL = "flux";
const TIMEOUT_MS = 120000;

function getErrorMessage(data, status) {
  return (
    data?.error?.message ||
    (typeof data?.error === "string" ? data.error : "") ||
    data?.message ||
    `Pollinations returned HTTP ${status}`
  );
}

function normalizeImage(data, model) {
  const item = data?.data?.[0];
  if (!item) return null;

  if (item.b64_json) {
    return { b64_json: item.b64_json, mimeType: item.mime_type || item.mimeType || "image/png" };
  }

  if (item.url) return { url: item.url };

  // Some compatible providers may return the image under image/data fields.
  if (typeof item.image === "string") {
    if (item.image.startsWith("data:image/")) return { dataUrl: item.image };
    if (/^https?:\/\//i.test(item.image)) return { url: item.image };
  }

  return null;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.POLLINATIONS_API_KEY),
    imageModel: process.env.POLLINATIONS_IMAGE_MODEL || DEFAULT_MODEL
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const prompt = String(body?.prompt || "").trim();
    const model = String(body?.model || process.env.POLLINATIONS_IMAGE_MODEL || DEFAULT_MODEL).trim();

    if (!prompt) {
      return NextResponse.json({ error: "Image prompt is required." }, { status: 400 });
    }

    const key = process.env.POLLINATIONS_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Pollinations is not configured. Add POLLINATIONS_API_KEY in Vercel." },
        { status: 503 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${BASE_URL}/v1/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          // b64_json works for the full Pollinations image catalog,
          // including community models where URL responses are not supported.
          response_format: "b64_json"
        }),
        signal: controller.signal,
        cache: "no-store"
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: getErrorMessage(data, response.status), model },
        { status: response.status }
      );
    }

    const image = normalizeImage(data, model);

    if (!image) {
      return NextResponse.json(
        { error: "The selected image model returned no usable image data.", model },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, model, image });
  } catch (error) {
    if (error?.name === "AbortError") {
      return NextResponse.json(
        { error: "Image generation timed out. Please try again." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Invalid request or Pollinations image service error." },
      { status: 500 }
    );
  }
}
