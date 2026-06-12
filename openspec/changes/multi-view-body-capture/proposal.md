## Why

Single-photo try-on produces inaccurate results for lower body garments (pants, skirts) and structured fits because the model can't infer the user's depth, hip width, or side profile from one frontal image. A 360° turn video gives us 4 calibrated views (front, left, right, back) that dramatically improve garment placement and draping accuracy — especially the failure cases.

## What Changes

- New camera capture flow: user records a slow 360° turn (~10 seconds) via phone camera
- Server-side frame extraction: 4 key frames extracted from video at 0°, 90°, 180°, 270°
- Body profile stored per-user: replaces single `userPhotoUrl` with `bodyProfile` (4 image URLs)
- Try-on API updated: passes the most relevant view(s) to FASHN.ai based on garment category
  - Tops → front frame
  - Bottoms → front + side frames
  - Full body → front + back frames
- Wardrobe page: replaces "Your photo" upload with "Capture body profile" flow

## Capabilities

### New Capabilities
- `body-profile-capture`: Video capture UI, frame extraction API, and storage of multi-view body profile
- `multi-view-tryon`: Logic for selecting and passing the optimal view(s) per garment category to the FASHN API

### Modified Capabilities
- `wardrobe`: Body profile replaces single photo — storage schema and try-on trigger change

## Impact

- `src/app/wardrobe/page.tsx` — replaces PhotoUpload with BodyCapture component
- `src/app/api/upload/route.ts` — new `/api/body-capture` route for video frame extraction
- `src/lib/wardrobe-store.ts` — `userPhotoUrl: string | null` → `bodyProfile: BodyProfile | null`
- `src/types/index.ts` — new `BodyProfile` type
- `src/lib/fashn.ts` — `startTryOn` receives array of model images, selects by category
- New dependency: browser MediaRecorder API (no new npm packages needed for MVP)
- FASHN.ai API: still single `model_image` per call — we select the best frame, not multi-image
