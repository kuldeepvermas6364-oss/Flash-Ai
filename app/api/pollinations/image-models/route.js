import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CATALOG_URL = "https://gen.pollinations.ai/image/models";
const FALLBACK_MODELS = [{ id: "flux", name: "Flux", type: "image", category: "image" }];

function getModelId(model) {
  if (typeof model === "string") return model;
  return String(model?.id || model?.name || model?.model || "").trim();
}

function isImageCapable(model) {
  if (typeof model === "string") return Boolean(model);

  const outputs =
    model?.outputModalities ||
    model?.output_modalities ||
    model?.modalities?.output ||
    model?.capabilities?.outputModalities ||
    model?.capabilities?.output_modalities;

  if (Array.isArray(outputs) && outputs.length) {
    const normalized = outputs.map((value) => String(value).toLowerCase());
    if (normalized.includes("image")) return true;
    if (normalized.includes("video")) return false;
  }

  const category = String(model?.category || model?.type || model?.family || "").toLowerCase();
  if (category === "video") return false;
  if (category === "image") return true;

  const id = getModelId(model).toLowerCase();
  return Boolean(id);
}

function normalizeModels(payload) {
  const source =
    Array.isArray(payload?.data) ? payload.data :
    Array.isArray(payload?.models) ? payload.models :
    Array.isArray(payload?.imageModels) ? payload.imageModels :
    Array.isArray(payload) ? payload :
    [];

  const seen = new Set();
  return source
    .filter(isImageCapable)
    .map((model) => {
      const id = getModelId(model);
      if (typeof model === "string") return { id, name: id };
      return { ...model, id };
    })
    .filter((model) => {
      if (!model.id || seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    });
}

async function fetchCatalog(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  try {
    let { response, data } = await fetchCatalog(`${CATALOG_URL}?reliability=reliable`);
    let models = normalizeModels(data);

    if (!response.ok || !models.length) {
      const retry = await fetchCatalog(`${CATALOG_URL}?reliability=all`);
      if (retry.response.ok) {
        response = retry.response;
        data = retry.data;
        models = normalizeModels(data);
      }
    }

    if (!response.ok && !models.length) {
      return NextResponse.json(
        { error: "Could not load image models.", details: data?.error || null },
        { status: response.status }
      );
    }

    return NextResponse.json(
      { object: "list", data: models.length ? models : FALLBACK_MODELS },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      return NextResponse.json({ object: "list", data: FALLBACK_MODELS, warning: "Live image catalog timed out." });
    }
    return NextResponse.json(
      { object: "list", data: FALLBACK_MODELS, warning: "Live image catalog unavailable; using the built-in Flux fallback." },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
