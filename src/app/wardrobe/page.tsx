"use client";

import { useState, useEffect } from "react";
import { WardrobeGrid } from "@/components/WardrobeGrid";
import { PhotoUpload } from "@/components/PhotoUpload";
import type { GarmentItem, TryOnResult } from "@/types";
import { generateId } from "@/lib/utils";
import { loadStore, saveStore, type WardrobeStore } from "@/lib/wardrobe-store";
import Link from "next/link";

export default function WardrobePage() {
  const [store, setStore] = useState<WardrobeStore>({ userPhotoUrl: null, garments: [], results: {} });
  const [tryingOnId, setTryingOnId] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);

  useEffect(() => { setStore(loadStore()); }, []);

  function update(patch: Partial<WardrobeStore>) {
    const next = { ...store, ...patch };
    setStore(next);
    saveStore(next);
  }

  async function addGarment(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");

    // Background removal — best-effort, non-blocking on failure
    let cleanImageUrl: string | undefined;
    try {
      const bg = await fetch("/api/bgremove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: data.url }),
      });
      if (bg.ok) cleanImageUrl = (await bg.json()).url;
    } catch (e) {
      console.warn("[wardrobe] bg removal failed, using original:", e);
    }

    const item: GarmentItem = {
      id: generateId(),
      name: file.name.replace(/\.[^.]+$/, ""),
      category: "auto",
      imageUrl: data.url,
      cleanImageUrl,
      addedAt: Date.now(),
    };

    update({ garments: [...store.garments, item] });
  }

  function deleteGarment(id: string) {
    const results = { ...store.results };
    delete results[id];
    update({ garments: store.garments.filter((g) => g.id !== id), results });
  }

  async function tryOn(garment: GarmentItem) {
    if (!store.userPhotoUrl) return;

    // Cached
    if (store.results[garment.id]) {
      setActiveResultId(garment.id);
      return;
    }

    setTryingOnId(garment.id);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_image: store.userPhotoUrl,
          garment_image: garment.cleanImageUrl ?? garment.imageUrl,
          category: garment.category,
          mode: "balanced",
        }),
      });
      const { id, error } = await res.json();
      if (error) throw new Error(error);

      const start = Date.now();
      while (true) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await fetch(`/api/tryon?id=${id}`);
        const job = await poll.json();

        if (job.status === "completed" && job.output?.[0]) {
          const result: TryOnResult = { garmentId: garment.id, resultUrl: job.output[0], createdAt: Date.now() };
          update({ results: { ...store.results, [garment.id]: result } });
          setActiveResultId(garment.id);
          return;
        }
        if (job.status === "failed") throw new Error(job.error ?? "Try-on failed");
        if (Date.now() - start > 120_000) throw new Error("Timed out");
      }
    } catch (e) {
      console.error("[wardrobe] tryOn failed:", e);
    } finally {
      setTryingOnId(null);
    }
  }

  const activeResult = activeResultId ? store.results[activeResultId] : null;

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
          <div className="flex flex-col gap-6">
            <PhotoUpload
              label="Your photo"
              hint="Used for all try-ons"
              value={store.userPhotoUrl}
              onChange={(url) => update({ userPhotoUrl: url })}
            />
            {activeResult && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Result</span>
                <img src={activeResult.resultUrl} alt="Try-on result"
                  className="w-full aspect-[3/4] object-cover rounded-xl border border-zinc-800" />
                <a href={activeResult.resultUrl} download target="_blank" rel="noopener noreferrer"
                  className="text-xs text-zinc-600 hover:text-zinc-400 text-center transition-colors">
                  Download ↓
                </a>
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            <WardrobeGrid
              garments={store.garments}
              personUrl={store.userPhotoUrl}
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
