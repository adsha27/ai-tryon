import { NextRequest, NextResponse } from "next/server";
import { removeBg } from "@/lib/vton";

export async function POST(req: NextRequest) {
  const { image_url } = await req.json();
  if (!image_url) return NextResponse.json({ error: "image_url required" }, { status: 400 });

  console.log("[bgremove] processing:", image_url.slice(0, 60));

  try {
    const resultUrl = await removeBg(image_url);
    console.log("[bgremove] done:", resultUrl.slice(0, 60));
    return NextResponse.json({ url: resultUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bgremove] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
