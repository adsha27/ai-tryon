import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  console.log("[upload] request received");
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      console.error("[upload] no file in form data");
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    console.log("[upload] file:", file.name, "size:", file.size, "type:", file.type);

    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log("[upload] done:", blob.url);
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[upload] failed:", msg);
    if (stack) console.error("[upload] stack:", stack);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
