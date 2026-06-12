import { NextRequest, NextResponse } from "next/server";

// Uploads to Cloudinary and returns a permanent public URL.
// CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET must be set.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloud || !preset) {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
  }

  const upload = new FormData();
  upload.append("file", file);
  upload.append("upload_preset", preset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: upload,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Upload failed: ${text}` }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ url: data.secure_url });
}
