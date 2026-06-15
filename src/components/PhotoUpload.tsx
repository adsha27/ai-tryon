"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Upload, X } from "lucide-react";

interface Props {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
}

export function PhotoUpload({ label, hint, value, onChange, accept = "image/*" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}

      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt={label}
            className="w-full aspect-[3/4] object-cover rounded-xl border border-zinc-800"
          />
          <button
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 bg-zinc-900/80 text-zinc-400 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className={cn(
            "w-full aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors",
            uploading ? "border-zinc-600 bg-zinc-900/40" : "hover:border-zinc-600 hover:bg-zinc-900/30"
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
              <span className="text-xs text-zinc-500">Uploading…</span>
            </div>
          ) : (
            <>
              <Upload size={22} className="text-zinc-600" />
              <span className="text-xs text-zinc-500 text-center px-4">
                Click or drag photo here
              </span>
            </>
          )}
        </div>
      )}

      {error && <span className="text-xs text-red-400">{error}</span>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
