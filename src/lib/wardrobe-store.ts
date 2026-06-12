import type { GarmentItem, TryOnResult } from "@/types";

const KEY = "ai-tryon-wardrobe";

export interface WardrobeStore {
  userPhotoUrl: string | null;
  garments: GarmentItem[];
  results: Record<string, TryOnResult>;
}

const empty: WardrobeStore = { userPhotoUrl: null, garments: [], results: {} };

export function loadStore(): WardrobeStore {
  if (typeof window === "undefined") return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return empty;
  }
}

export function saveStore(store: WardrobeStore): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}
