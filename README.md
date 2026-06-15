# ai-tryon

Upload a photo of yourself and a garment image — flat-lay, screenshot, or on-model — and get back a photorealistic image of you wearing it.

**Live:** https://ai-tryon-dusky.vercel.app

---

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind
- **[CatVTON](https://github.com/Zheng-Chong/CatVTON)** — SD inpainting fine-tuned for virtual try-on (CC BY-NC-SA, portfolio use only)
- **[SegFormer B2 Clothes](https://huggingface.co/mattmdjaga/segformer_b2_clothes)** — clothing segmentation
- **Modal** — serverless A10G GPU (~35s warm, ~90s cold start)
- **Vercel Blob** — image storage
- **Vercel** — hosting

---

## How it works

1. User uploads a person photo + garment → both go to Vercel Blob
2. `/api/tryon` fires a job on Modal, returns a `job_id`
3. Modal spins up an A10G, runs:
   - SegFormer segments clothing → generates inpainting mask (dilated, face excluded)
   - CatVTON (SD inpainting) generates the person wearing the new garment
   - Result uploads to Vercel Blob
4. Frontend polls every 2s until `status === "completed"`

---

## Running locally

```bash
npm install
cp .env.local.example .env.local
# fill in env vars below
npm run dev
```

| Var | Where to get it |
|-----|----------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard → Storage → Blob store → Quickstart |
| `MODAL_TRYON_START_URL` | Printed after `modal deploy modal_inference/app.py` |
| `MODAL_TRYON_STATUS_URL` | Same |
| `MODAL_BGREMOVE_URL` | Same |

### Modal setup (one-time)

```bash
pip install modal
modal token new
modal secret create vercel-blob BLOB_READ_WRITE_TOKEN=<your-token>
modal deploy modal_inference/app.py
```

> The Vercel Blob store must be **Public**. Private stores require signed URLs which break direct `<img>` display.

---

## Branches

| Branch | What |
|--------|------|
| `main` | Working end-to-end: CatVTON + SegFormer clothing mask |
| `exp/face-restore` | Post-diffusion face paste-back to fix SD distortion. Also fixes SegFormer mask shape mismatch. |

---

## Problems solved

**detectron2 is effectively dead on modern Python/CUDA**
CatVTON's original masking uses detectron2, which stopped publishing prebuilt wheels after CUDA 11.7. Building from source fails on CUDA 12.x in every combination. Replaced it with SegFormer — pure pip, no C++ compilation, same semantic result.

**Vercel Blob returning "Access denied" with a valid token**
`@vercel/blob` SDK prioritizes `VERCEL_OIDC_TOKEN` over `BLOB_READ_WRITE_TOKEN` when both are present. `vercel env pull` injects a short-lived OIDC token (12h expiry) that silently takes precedence. Fix: pass `token: process.env.BLOB_READ_WRITE_TOKEN` explicitly in every `put()` call.

**Modal secrets don't reload in warm containers**
After rotating the Blob token, the warm GPU container kept using the old one — secrets are baked in at container init, not read dynamically. Fix: always `modal deploy` after changing a secret.

**SegFormer returns masks at its own resolution, not input size**
The HuggingFace segmentation pipeline runs at the model's training resolution internally. Accumulating masks with `np.maximum` threw a shape mismatch. Fix: resize every segment mask to `person_img` dimensions before any numpy ops.

**SD inpainting distorts the face**
Even with face excluded from the mask, diffusion warps pixels near the boundary. Fix (`exp/face-restore`): let diffusion run, then composite the original face back with a feathered alpha blend using SegFormer's face mask.
