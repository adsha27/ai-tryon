import { NextRequest, NextResponse } from "next/server";
import { removeBg } from "@/lib/fashn";

export async function POST(req: NextRequest) {
  const { image_url } = await req.json();
  if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 });

  const resultUrl = await removeBg(image_url);
  return NextResponse.json({ url: resultUrl });
}
