"use client";

import { useState, useCallback, useEffect } from "react";
import { WardrobeGrid } from "@/components/WardrobeGrid";
import { PhotoUpload } from "@/components/PhotoUpload";
import type { GarmentItem, TryOnResult } from "@/types";
import { generateId } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "ai-tryon-wardrobe";

function loadWardrobe() {
  if (typeof window === "undefined") return { userPhotoUrl: null, garments: [], results: {} };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export default function WardrobePage() {
  const [personUrl, setPersonUrl] = useState<string | null>(null);
  const [garments, setGarments] = useState<GarmentItem[]>([]);
  const [results, setResults] = useState<Record<string, TryOnResult>>({});
  const [tryingOnId, setTryingOnId] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadWardrobe();
    if (saved.userPhotoUrl) setPersonUrl(saved.userPhotoUrl);
    if (saved.garments) setGarments(saved.garments);
    if (saved.results) setResults(saved.results);
  }, []);

  function persist(next: { userPhotoUrl: string | null; garments: GarmentItem[]; results: Record<string, TryOnResult> }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function updatePersonUrl(url: string | null) {
    setPersonUrl(url);
    persist({ userPhotoUrl: url, garments, results });
  }

  async function addGarment(file: File) {
    // Upload file
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const imageUrl: string = data.url;

    // Background removal
    let cleanImageUrl: string | undefined;
    try {
      const bgRes = await fetch("/api/bgremove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      if (bgRes.ok) {
        const bgData = await bgRes.json();
        cleanImageUrl = bgData.url;
      }
    } catch {
      // bg removal failed — use original
    }

    const item: GarmentItem = {
      id: generateId(),
      name: file.name.replace(/\.[^.]+$/, ""),
      category: "auto",
      imageUrl,
      cleanImageUrl,
      addedAt: Date.now(),
    };

    const next = [...garments, item];
    setGarments(next);
    persist({ userPhotoUrl: personUrl, garments: next, results });
  }

  function deleteGarment(id: string) {
    const next = garments.filter((g) => g.id !== id);
    const nextResults = { ...results };
    delete nextResults[id];
    setGarments(next);
    setResults(nextResults);
    persist({ userPhotoUrl: personUrl, garments: next, results: nextResults });
  }

  async function tryOn(garment: GarmentItem) {
    if (!personUrl) return;

    // Return cached result immediately
    if (results[garment.id]) {
      setActiveResult(garment.id);
      return;
    }

    setTryingOnId(garment.id);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_image: personUrl,
          garment_image: garment.cleanImageUrl ?? garment.imageUrl,
          category: garment.category,
          mode: "balanced",
        }),
      });
      const { id, error } = await res.json();
      if (error) throw new Error(error);

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await fetch(`/api/tryon?id=${id}`);
        const job = await poll.json();
        if (job.status === "completed" && job.output?.[0]) {
          const result: TryOnResult = { garmentId: garment.id, resultUrl: job.output[0], createdAt: Date.now() };
          const nextResults = { ...results, [garment.id]: result };
          setResults(nextResults);
          setActiveResult(garment.id);
          persist({ userPhotoUrl: personUrl, garments, results: nextResults });
          return;
        }
        if (job.status === "failed") throw new Error(job.error ?? "Failed");
      }
    } finally {
      setTryingOnId(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">My Wardrobe</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Add your clothes. Try them on instantly.</p>
          </div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Quick try-on</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar: body photo + active result */}
          <div className="flex flex-col gap-6">
            <PhotoUpload
              label="Your photo"
              hint="Used for all try-ons"
              value={personUrl}
              onChange={updatePersonUrl}
            />
            {activeResult && results[activeResult] && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Result</span>
                <img
                  src={results[activeResult].resultUrl}
                  alt="Try-on result"
                  className="w-full aspect-[3/4] object-cover rounded-xl border border-zinc-800"
                />
                <a
                  href={results[activeResult].resultUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-600 hover:text-zinc-400 text-center transition-colors"
                >
                  Download ↓
                </a>
              </div>
            )}
          </div>

          {/* Wardrobe grid */}
          <div className="lg:col-span-3">
            <WardrobeGrid
              garments={garments}
              personUrl={personUrl}
              onAdd={addGarment}
              onDelete={deleteGarment}
              onTryOn={tryOn}
              tryingOnId={tryingOnId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
