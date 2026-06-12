# ai-tryon

Virtual try-on + AI wardrobe. Upload photo + garment → photorealistic wearing result.

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS
- FASHN.ai API for try-on + background removal
- Cloudinary for image hosting/CDN
- Vercel for deployment

## Live
https://ai-tryon-dusky.vercel.app

## Local dev
```bash
cp .env.local.example .env.local
# Fill in FASHN_API_KEY and Cloudinary creds
npm run dev
```

## Env vars (required)
| Var | Where to get |
|-----|-------------|
| FASHN_API_KEY | https://fashn.ai/dashboard |
| CLOUDINARY_CLOUD_NAME | https://cloudinary.com dashboard |
| CLOUDINARY_UPLOAD_PRESET | Cloudinary → Settings → Upload → Add preset (unsigned) |

## Key files
- `src/lib/fashn.ts` — FASHN.ai client (try-on, background removal)
- `src/app/api/tryon/route.ts` — start job + poll endpoint
- `src/app/api/upload/route.ts` — Cloudinary upload proxy
- `src/components/TryOnPanel.tsx` — main try-on UI
- `src/app/wardrobe/page.tsx` — wardrobe management (localStorage)

## Branch convention
- `main` — production
- `exp/<name>` — experiments (deployed as preview URLs on Vercel)

## Research
Stored in gbrain: `research/ai-tryon-landscape`
- All open-source VTON models (CatVTON, IDM-VTON) are CC BY-NC-SA — no commercial use
- FASHN.ai is the only commercially licensed option with managed inference
- Clothes removal problem: traditional human-parser approach fails 10-30% → FASHN handles internally
- Target: AI wardrobe product (own clothes + new clothes, single photo)
