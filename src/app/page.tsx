import { TryOnPanel } from "@/components/TryOnPanel";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-10">
      <div className="max-w-5xl mx-auto flex flex-col gap-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ai-tryon</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Upload your photo + any garment. See yourself wearing it in seconds.
            </p>
          </div>
          <Link
            href="/wardrobe"
            className="text-xs text-zinc-500 border border-zinc-800 rounded-lg px-3 py-1.5 hover:border-zinc-600 hover:text-zinc-300 transition-colors"
          >
            My Wardrobe →
          </Link>
        </div>

        <TryOnPanel />

        <p className="text-xs text-zinc-700 text-center">
          Powered by FASHN.ai · Results in 5–17s · Works on any garment type
        </p>
      </div>
    </main>
  );
}
