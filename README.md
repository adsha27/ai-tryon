# ai-tryon

Virtual try-on that actually works. Upload your photo and any garment image — a flat-lay, a screenshot, a product photo — and get back a photorealistic image of you wearing it. No subscription, no paid API. The whole inference stack runs on a GPU we spin up ourselves.

**Live:** https://ai-tryon-dusky.vercel.app

---

## How it works

1. You upload a photo of yourself + a garment image → both go to Vercel Blob
2. The frontend calls `/api/tryon` which fires a job on Modal (GPU cloud)
3. Modal spins up an A10G GPU and runs CatVTON:
   - **SegFormer** segments your clothing and generates an inpainting mask
   - The mask is dilated to cover the full garment region; face/hair are explicitly excluded
   - **Stable Diffusion inpainting** (CatVTON) generates you wearing the new garment
   - Your original face is composited back with a feathered alpha blend to prevent SD from distorting it
4. Result uploads to Vercel Blob; frontend polls until done (~35s warm, ~90s cold start)

---

## Stack

| Layer | What |
|-------|------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Inference | [CatVTON](https://github.com/Zheng-Chong/CatVTON) (CC BY-NC-SA) — SD inpainting fine-tuned for virtual try-on |
| Segmentation | [SegFormer B2 Clothes](https://huggingface.co/mattmdjaga/segformer_b2_clothes) — clothing + face masks |
| GPU cloud | Modal (A10G, serverless) |
| Storage | Vercel Blob (public store) |
| Hosting | Vercel |

> **License note:** CatVTON is CC BY-NC-SA. This is a portfolio project — not for commercial use.

---

## Key files

```
modal_inference/
  app.py                 The entire GPU backend. Defines:
                           - TryOnModel cls — loads CatVTON pipeline + SegFormer on GPU startup
                           - _segformer_mask() — clothing mask with dilation + face/hair exclusion
                           - _restore_face() — pastes original face back post-diffusion
                           - start_tryon, get_status, remove_bg — HTTP endpoints
                           - _upload_blob() — uploads result from the container to Vercel Blob

src/
  app/
    page.tsx             Home — mounts TryOnPanel
    layout.tsx           Root layout
    wardrobe/page.tsx    Save and manage garments in localStorage

    api/
      tryon/route.ts     POST starts a Modal job and returns job_id
                         GET polls Modal for status + result URL
      upload/route.ts    Proxies uploads to Vercel Blob; passes token explicitly
                         to bypass OIDC expiry issues (see Problems below)
      bgremove/route.ts  Calls Modal remove_bg endpoint (rembg, ONNX-based)

  components/
    TryOnPanel.tsx       Main try-on UI. Manages upload state, fires the job,
                         polls for the result, shows result with original photo overlay
    PhotoUpload.tsx      Reusable drag-and-drop upload with loading state

  lib/
    vton.ts              Client for all Modal endpoints — startTryOn(), pollTryOn(), removeBg()
    poll.ts              Polling helper used by the API route
    wardrobe-store.ts    localStorage wardrobe persistence
    utils.ts             cn() — Tailwind class merger

next.config.js           Minimal Next.js config
```

---

## Running locally

```bash
npm install
cp .env.local.example .env.local
# fill in the vars below, then:
npm run dev -- -p 3001
```

### Env vars

| Var | Where to get it |
|-----|----------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard → Storage → your blob store → Quickstart |
| `MODAL_TRYON_START_URL` | Printed after `modal deploy modal_inference/app.py` |
| `MODAL_TRYON_STATUS_URL` | Same |
| `MODAL_BGREMOVE_URL` | Same |

### Modal setup (one-time)

```bash
pip install modal
modal token new

# Store the Vercel Blob token as a Modal secret so the GPU container can upload results
modal secret create vercel-blob BLOB_READ_WRITE_TOKEN=<your-token>

# Deploy
modal deploy modal_inference/app.py
```

**The Vercel Blob store must be Public** (not Private). Private stores require signed URLs, which breaks direct `<img>` display in the browser.

---

## Branches

| Branch | What |
|--------|------|
| `main` | Working end-to-end: CatVTON + SegFormer mask + face protection zone |
| `exp/face-restore` | Post-diffusion face paste-back to fix SD distortion on the face. Also fixes SegFormer mask shape mismatch. Active development. |

---

## Problems we hit (and how we fixed them)

### detectron2 is effectively dead on modern Python/CUDA

CatVTON's original `AutoMasker` uses detectron2 (Facebook Research) for DensePose + SCHP clothing segmentation. Facebook stopped publishing prebuilt wheels after CUDA 11.7 / PyTorch 1.x. On CUDA 12.x / PyTorch 2.x, building from source failed in every combination — missing `clang++`, missing `ninja`, `metadata-generation-failed`, wheel build errors. We spent a while on this before giving up.

**Fix:** Dropped detectron2 entirely. Replaced AutoMasker with [SegFormer B2 Clothes](https://huggingface.co/mattmdjaga/segformer_b2_clothes) — a transformer-based clothing segmentation model that installs from pip with zero C++ compilation. Same semantic result, runs on the same GPU, and it's a cleaner dependency.

---

### Vercel Blob returning "Access denied" with a perfectly valid token

The `@vercel/blob` SDK has an OIDC auth path that takes priority over `BLOB_READ_WRITE_TOKEN` when `VERCEL_OIDC_TOKEN` is present in the environment. `vercel env pull` injects a short-lived OIDC token (12-hour expiry). Once it expired, every upload failed with "Access denied" — even though the long-lived read-write token sitting right next to it in `.env.local` was fine.

**Fix:** Pass `token: process.env.BLOB_READ_WRITE_TOKEN` explicitly in every `put()` call. This bypasses OIDC entirely and goes straight to the token you actually control.

---

### Modal secrets don't hot-reload in warm containers

After we switched Vercel Blob stores (old store was Private, new one Public), we updated the Modal secret with `modal secret create --force`. The next job still failed on upload — the warm GPU container had the old token baked in from when it started. Inference ran fine for 50 steps, then died at the very last line trying to upload.

**Fix:** Always run `modal deploy` after changing a secret. Containers pick up secrets at init time only, not dynamically.

---

### SegFormer returns masks at its own internal resolution, not the input size

The HuggingFace `image-segmentation` pipeline for SegFormer runs the model at its training resolution internally and returns masks at that resolution — not the size of the image you passed in. When we called `np.maximum(mask_arr, seg_mask)` to accumulate clothing regions, numpy threw a broadcast error because the shapes didn't match.

**Fix:** Resize every segment mask back to `person_img` dimensions before any numpy operations:

```python
seg_mask = np.array(
    seg["mask"].convert("L").resize((pw, ph), Image.NEAREST)
)
```

---

### Stable Diffusion inpainting distorts the face

Even when the face is excluded from the inpainting mask, SD warps pixels near the mask boundary. The model can "see" the edge of the excluded region and distorts the adjacent skin. The first version of the result had a noticeably uncanny face.

**Fix:** Let diffusion do whatever it wants, then composite the original face back on top as a post-processing step. We use SegFormer's face mask, dilate it slightly (5px), apply a Gaussian blur as an alpha channel, and blend: `original * alpha + result * (1 - alpha)`. The garment changes, the face doesn't.

---

### `package.json` had `next@9.3.3` while the project used App Router

The project was built with Next.js 16 but `package.json` had `"next": "^9.3.3"` — a bad value that survived from the initial scaffold. `npm install` installed Next.js 9, which predates the App Router by about 4 years and threw `"Couldn't find a pages directory"` on every run.

**Fix:** Pinned `"next": "16.2.9"` to match `eslint-config-next` which was already correctly set to `16.2.9`.

---

## What's next

- **Multi-view body capture** — spec drafted in `openspec/changes/`. Record a slow 360° turn on your phone, extract front/left/right/back frames, store as a body profile. Future try-ons use all 4 views for much better garment fit on lower body items.
- Better garment category auto-detection (currently defaults to "upper body")
- Collar/neckline blending — the turtleneck→V-neck transition is still the weakest point in the result quality
