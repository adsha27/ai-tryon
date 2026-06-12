export interface GarmentItem {
  id: string;
  name: string;
  category: "tops" | "bottoms" | "full-body" | "auto";
  imageUrl: string;       // original upload
  cleanImageUrl?: string; // bg-removed version
  addedAt: number;
}

export interface TryOnResult {
  garmentId: string;
  resultUrl: string;
  createdAt: number;
}

export interface WardrobeState {
  userPhotoUrl: string | null;
  garments: GarmentItem[];
  results: Record<string, TryOnResult>; // keyed by garmentId
}
