import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CATALOG_URL = "https://gen.pollinations.ai/image/models";

function isImageCapable(model) {
  if (typeof model === "string") return Boolean(model);

  const outputs = model?.outputModalities || model?.output_modalities || model?.modalities?.output || model?.capabilities?.outputModalities;
  if (Array.isArray(outputs) && outputs.length) {
    return outputs.some((value) => String(value).toLowerCase() === "image");
  }

  // If the catalog does not expose modality metadata for an entry,
  // keep it because this endpoint is specifically the image-model catalog.
  const id = String(model?.id || model?.model || "").toLowerCase();
  const type = String(model?.type || model?.family || "").toLowerCase();
  if (type === "video" && !id.includes("image")) return false;
  return Boolean(id);
}

function normalizeModels(payload) {
  const source = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  const seen = new Set();
  return source.filter(isImageCapable).filter((model) => {
    const id = typeof model === "string" ? model : model?.id || model?.model;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(CATALOG_URL, {
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not load image models.", details: data?.error || null },
        { status: response.status }
      );
    }

    return NextResponse.json(
      { object: "list", data: normalizeModels(data) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      return NextResponse.json({ error: "Image model catalog timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: "Image model catalog unavailable." }, { status: 503 });
  }
}
