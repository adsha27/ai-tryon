"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import type { GarmentItem } from "@/types";

interface Props {
  garments: GarmentItem[];
  personUrl: string | null;
  onAdd: (file: File) => Promise<void>;
  onDelete: (id: string) => void;
  onTryOn: (garment: GarmentItem) => Promise<void>;
  tryingOnId: string | null;
}

export function WardrobeGrid({ garments, personUrl, onAdd, onDelete, onTryOn, tryingOnId }: Props) {
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdding(true);
    await onAdd(file);
    setAdding(false);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">Wardrobe</span>
        <label className={cn(
          "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors",
          adding
            ? "border-zinc-700 text-zinc-600"
            : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
        )}>
          {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add item
          <input type="file" accept="image/*" className="hidden" onChange={handleAdd} disabled={adding} />
        </label>
      </div>

      {garments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-700 border border-dashed border-zinc-800 rounded-xl gap-2">
          <span className="text-sm">No garments yet</span>
          <span className="text-xs">Add items to your wardrobe to try them on</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {garments.map((item) => (
            <div key={item.id} className="group relative">
              <div className="aspect-[3/4] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                <img
                  src={item.cleanImageUrl ?? item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="absolute inset-0 rounded-xl bg-zinc-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                {personUrl && (
                  <button
                    onClick={() => onTryOn(item)}
                    disabled={tryingOnId === item.id}
                    className="flex items-center gap-1.5 text-xs bg-zinc-100 text-zinc-900 px-3 py-1.5 rounded-lg font-medium hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {tryingOnId === item.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Sparkles size={11} />
                    )}
                    Try on
                  </button>
                )}
                <button
                  onClick={() => onDelete(item.id)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={11} />
                  Remove
                </button>
              </div>

              <div className="mt-1.5 px-0.5">
                <span className="text-xs text-zinc-500 truncate block">{item.name}</span>
                <span className="text-xs text-zinc-700 capitalize">{item.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
