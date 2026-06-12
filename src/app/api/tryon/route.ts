import { NextRequest, NextResponse } from "next/server";
import { startTryOn, pollTryOn, type TryOnMode, type GarmentCategory } from "@/lib/fashn";

export async function POST(req: NextRequest) {
  const { model_image, garment_image, category, mode } = await req.json();

  if (!model_image || !garment_image) {
    return NextResponse.json({ error: "model_image and garment_image required" }, { status: 400 });
  }

  console.log("[tryon] starting job", { category, mode });

  try {
    const { id } = await startTryOn({
      model_image,
      garment_image,
      category: category as GarmentCategory,
      mode: mode as TryOnMode,
    });
    console.log("[tryon] job started:", id);
    return NextResponse.json({ id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tryon] startTryOn failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const job = await pollTryOn(id);
    if (job.status === "completed") console.log("[tryon] done:", id);
    if (job.status === "failed") console.error("[tryon] failed:", id, job.error);
    return NextResponse.json(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tryon] poll error:", id, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
