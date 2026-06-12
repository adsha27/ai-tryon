export type GarmentCategory = "auto" | "tops" | "bottoms" | "full-body";

export interface TryOnRequest {
  model_image: string;
  garment_image: string;
  category?: GarmentCategory;
}

export interface TryOnJob {
  id: string;
  status: "starting" | "in_queue" | "processing" | "completed" | "failed";
  output?: string[];
  error?: string;
}

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} not set`);
  return val;
}

export async function startTryOn(req: TryOnRequest): Promise<{ id: string }> {
  const url = getEnv("MODAL_TRYON_START_URL");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      person_url: req.model_image,
      garment_url: req.garment_image,
      category: req.category ?? "auto",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Modal start failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  return { id: data.job_id };
}

export async function pollTryOn(id: string): Promise<TryOnJob> {
  const url = getEnv("MODAL_TRYON_STATUS_URL");

  const res = await fetch(`${url}?job_id=${encodeURIComponent(id)}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Modal status failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    id,
    status: data.status,
    output: data.output,
    error: data.error,
  };
}

export async function removeBg(imageUrl: string): Promise<string> {
  const url = getEnv("MODAL_BGREMOVE_URL");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl }),
  });

  if (!res.ok) throw new Error(`Modal bgremove failed ${res.status}`);
  const data = await res.json();
  return data.url;
}
