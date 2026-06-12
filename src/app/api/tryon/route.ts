import { NextRequest, NextResponse } from "next/server";
import { startTryOn, pollTryOn, type TryOnMode, type GarmentCategory } from "@/lib/fashn";

export async function POST(req: NextRequest) {
  const { model_image, garment_image, category, mode } = await req.json();

  if (!model_image || !garment_image) {
    return NextResponse.json({ error: "model_image and garment_image required" }, { status: 400 });
  }

  const { id } = await startTryOn({
    model_image,
    garment_image,
    category: category as GarmentCategory,
    mode: mode as TryOnMode,
  });

  return NextResponse.json({ id });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const job = await pollTryOn(id);
  return NextResponse.json(job);
}
