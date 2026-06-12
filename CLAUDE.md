# ai-tryon

Virtual try-on + AI wardrobe. Upload photo + garment → photorealistic wearing result.
Portfolio project. NC-licensed models (CatVTON) are fine — no commercial use intended.

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS
- CatVTON (CC BY-NC-SA) self-hosted on Modal for try-on
- rembg on Modal for garment background removal
- Vercel Blob for image storage
- Vercel for frontend deployment

## Live
https://ai-tryon-dusky.vercel.app

## Local dev
```bash
cp .env.local.example .env.local
# Fill in BLOB_READ_WRITE_TOKEN and Modal URLs (see below)
npm run dev
```

## Env vars
| Var | How to get |
|-----|-----------|
| `BLOB_READ_WRITE_TOKEN` | `vercel env pull` or Vercel dashboard → Storage → Blob |
| `MODAL_TRYON_START_URL` | `modal deploy modal_inference/app.py` (printed after deploy) |
| `MODAL_TRYON_STATUS_URL` | same |
| `MODAL_BGREMOVE_URL` | same |

## Modal setup (one-time)
```bash
pip install modal
modal token new
# Store Vercel Blob token as a Modal secret so inference containers can upload results:
modal secret create vercel-blob BLOB_READ_WRITE_TOKEN=<your-token>
modal deploy modal_inference/app.py
```

## Key files
- `modal_inference/app.py` — CatVTON GPU inference + rembg bg-removal on Modal
- `src/lib/vton.ts` — Next.js client for Modal endpoints
- `src/app/api/tryon/route.ts` — start job + poll endpoint
- `src/app/api/upload/route.ts` — Vercel Blob upload proxy
- `src/components/TryOnPanel.tsx` — main try-on UI
- `src/app/wardrobe/page.tsx` — wardrobe management (localStorage)

## Branch convention
- `main` — production
- `exp/<name>` — experiments (deployed as preview URLs on Vercel)

## How inference works
1. User uploads person photo + garment image → both stored in Vercel Blob
2. POST `/api/tryon` → calls Modal `start_tryon` → returns `job_id`
3. Modal spawns A10G container → runs CatVTON:
   - DensePose + SCHP auto-mask removes existing clothes from person image
   - SD inpainting diffusion generates garment on person
   - Result uploaded to Vercel Blob
4. Frontend polls GET `/api/tryon?id=` every 2s until `status === "completed"`
5. Result URL displayed

## Research
- All open-source VTON models (CatVTON, IDM-VTON) are CC BY-NC-SA — portfolio use only
- CatVTON uses DensePose + SCHP for automatic clothes removal — fixes bleed-through problem
- Modal A10G (~16s inference, ~$0.015/run) vs FASHN.ai ($0.075/run, external API)
- Stored in gbrain: `research/ai-tryon-landscape`
