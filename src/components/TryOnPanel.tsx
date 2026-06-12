"use client";

import { useState, useCallback } from "react";
import { PhotoUpload } from "./PhotoUpload";
import { Sparkles, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GarmentCategory, TryOnMode } from "@/lib/fashn";

type Stage = "idle" | "queued" | "processing" | "done" | "error";

export function TryOnPanel() {
  const [personUrl, setPersonUrl] = useState<string | null>(null);
  const [garmentUrl, setGarmentUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<GarmentCategory>("auto");
  const [mode, setMode] = useState<TryOnMode>("balanced");
  const [stage, setStage] = useState<Stage>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const run = useCallback(async () => {
    if (!personUrl || !garmentUrl) return;
    setStage("queued");
    setResultUrl(null);
    setErrorMsg(null);

    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);

    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_image: personUrl, garment_image: garmentUrl, category, mode }),
      });
      const { id, error } = await res.json();
      if (error) throw new Error(error);

      setStage("processing");

      // Poll until done
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await fetch(`/api/tryon?id=${id}`);
        const job = await poll.json();

        if (job.status === "completed" && job.output?.[0]) {
          setResultUrl(job.output[0]);
          setStage("done");
          return;
        }
        if (job.status === "failed") throw new Error(job.error ?? "Try-on failed");
      }
      throw new Error("Timed out after 2 minutes");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStage("error");
    } finally {
      clearInterval(timer);
    }
  }, [personUrl, garmentUrl, category, mode]);

  const canRun = personUrl && garmentUrl && stage !== "queued" && stage !== "processing";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mx-auto">
      {/* Inputs column */}
      <div className="flex flex-col gap-6">
        <PhotoUpload
          label="Your photo"
          hint="Front-facing, full body works best"
          value={personUrl}
          onChange={setPersonUrl}
        />
        <PhotoUpload
          label="Garment"
          hint="Flat-lay, screenshot, or on-model"
          value={garmentUrl}
          onChange={setGarmentUrl}
        />

        {/* Options */}
        <div className="flex flex-col gap-3">
          <label className="text-xs text-zinc-500 uppercase tracking-wider">Category</label>
          <div className="grid grid-cols-2 gap-2">
            {(["auto", "tops", "bottoms", "full-body"] as GarmentCategory[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "text-xs py-1.5 rounded-lg border transition-colors capitalize",
                  category === c
                    ? "border-zinc-400 bg-zinc-800 text-zinc-100"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <label className="text-xs text-zinc-500 uppercase tracking-wider mt-1">Quality</label>
          <div className="grid grid-cols-3 gap-2">
            {(["performance", "balanced", "quality"] as TryOnMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "text-xs py-1.5 rounded-lg border transition-colors capitalize",
                  mode === m
                    ? "border-zinc-400 bg-zinc-800 text-zinc-100"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={run}
          disabled={!canRun}
          className={cn(
            "w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all",
            canRun
              ? "bg-zinc-100 text-zinc-900 hover:bg-white"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          )}
        >
          {stage === "queued" || stage === "processing" ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-700 border-t-zinc-200 rounded-full animate-spin" />
              {stage === "queued" ? "Queued…" : `Processing… ${elapsed}s`}
            </>
          ) : (
            <>
              <Sparkles size={15} />
              Try it on
            </>
          )}
        </button>
      </div>

      {/* Result column — spans 2 */}
      <div className="md:col-span-2 flex flex-col gap-3">
        <div
          className={cn(
            "w-full aspect-[3/4] rounded-2xl border border-zinc-800 flex items-center justify-center overflow-hidden bg-zinc-950 relative",
          )}
        >
          {resultUrl ? (
            <img src={resultUrl} alt="Try-on result" className="w-full h-full object-cover" />
          ) : stage === "processing" ? (
            <div className="flex flex-col items-center gap-3 text-zinc-600">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
              <span className="text-sm">Generating… {elapsed}s</span>
              <span className="text-xs text-zinc-700">Usually 5–17 seconds</span>
            </div>
          ) : stage === "error" ? (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <span className="text-red-400 text-sm">Error</span>
              <span className="text-xs text-zinc-600">{errorMsg}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-700">
              <Sparkles size={28} />
              <span className="text-sm">Result appears here</span>
            </div>
          )}
        </div>

        {resultUrl && (
          <a
            href={resultUrl}
            download="ai-tryon-result.jpg"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 text-center transition-colors"
          >
            Download full resolution ↓
          </a>
        )}

        {resultUrl && (
          <div className="flex items-center gap-2 text-xs text-zinc-700">
            <Clock size={11} />
            <span>Generated in {elapsed}s via FASHN.ai</span>
          </div>
        )}
      </div>
    </div>
  );
}
