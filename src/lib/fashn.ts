const FASHN_API_URL = "https://api.fashn.ai/v1";

export type TryOnMode = "performance" | "balanced" | "quality";
export type GarmentCategory = "auto" | "tops" | "bottoms" | "full-body";

export interface TryOnRequest {
  model_image: string;
  garment_image: string;
  category?: GarmentCategory;
  mode?: TryOnMode;
}

export interface TryOnJob {
  id: string;
  status: "starting" | "in_queue" | "processing" | "completed" | "failed";
  output?: string[];
  error?: string;
}

async function fashnFetch(path: string, body: object) {
  const key = process.env.FASHN_API_KEY;
  if (!key) throw new Error("FASHN_API_KEY not set");

  const res = await fetch(`${FASHN_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FASHN API ${res.status}: ${text}`);
  }

  return res.json();
}

export async function startTryOn(req: TryOnRequest): Promise<{ id: string }> {
  return fashnFetch("/run", {
    model_name: "tryon-v1.6",
    inputs: {
      model_image: req.model_image,
      garment_image: req.garment_image,
      category: req.category ?? "auto",
      mode: req.mode ?? "balanced",
    },
  });
}

export async function pollTryOn(id: string): Promise<TryOnJob> {
  const key = process.env.FASHN_API_KEY;
  if (!key) throw new Error("FASHN_API_KEY not set");

  const res = await fetch(`${FASHN_API_URL}/status/${id}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
  return res.json();
}

export async function removeBg(imageUrl: string): Promise<string> {
  const data = await fashnFetch("/run", {
    model_name: "background-remove",
    inputs: { image: imageUrl },
  });
  const jobId = data.id;

  // Poll for result (bg removal is fast, ~3s)
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const status = await pollTryOn(jobId);
    if (status.status === "completed" && status.output?.[0]) {
      return status.output[0];
    }
    if (status.status === "failed") throw new Error(status.error ?? "BG removal failed");
  }
  throw new Error("BG removal timed out");
}
