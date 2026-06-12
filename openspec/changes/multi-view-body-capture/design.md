## Context

Current state: `WardrobeStore.userPhotoUrl` holds a single frontal photo. This is passed directly as `model_image` to FASHN.ai for every try-on. FASHN.ai only accepts one `model_image` per call. The failure mode is most visible with lower-body garments where side/back proportions can't be inferred from a front shot alone.

Constraint: FASHN.ai v1.6 accepts a single model image. We can't pass multiple views in one call. Our strategy is to select the most informative view per garment category rather than try to force multi-image input.

## Goals / Non-Goals

**Goals:**
- Capture 4 body views from a ~10s phone video (no new native app, no special hardware)
- Store as a `BodyProfile` (4 URLs) in the wardrobe store
- Auto-select the best view per try-on based on garment category
- Fully backwards-compatible: existing single-photo users continue to work

**Non-Goals:**
- 3D body reconstruction or mesh generation (Phase 3)
- Real-time AR overlays
- Actual multi-image input to FASHN (not supported by their API)
- Body measurement extraction

## Decisions

**D1: Video capture via browser MediaRecorder, not native app**
MediaRecorder API is supported in all modern mobile browsers (Safari 15+, Chrome 75+). User opens the wardrobe page on their phone, taps "Capture", records a 10s turn. No app install needed.
Alternative considered: QR code → native camera handoff. Rejected: extra friction, no advantage for frame quality.

**D2: Frame extraction server-side via FFmpeg WASM or canvas frame grab**
Two options:
- Client-side: draw video frames onto canvas at timestamps → upload 4 JPEGs
- Server-side: upload raw video → extract frames with ffmpeg

Client-side canvas frame grab is chosen for MVP. Simpler, no ffmpeg dependency, no large video upload (4 JPEGs << 1 video file). Downside: frame quality depends on browser rendering, may vary slightly. Acceptable for now.

**D3: `BodyProfile` replaces `userPhotoUrl` in WardrobeStore with a fallback**
```ts
interface BodyProfile {
  front: string;   // 0° — used for tops
  left: string;    // 90°
  right: string;   // 270°
  back: string;    // 180° — used for bottoms (back view of pants)
  capturedAt: number;
}
```
`WardrobeStore` changes: `userPhotoUrl` becomes optional fallback, `bodyProfile` is the new primary. `startTryOn` selects frame by category:
- `tops` → `front`
- `bottoms` → `front` (FASHN uses front view, side/back informs better masking)
- `full-body` → `front`
- `auto` → `front`

Note: All categories use front for now because FASHN's agnostic masking works best on frontal shots. The real gain is having the other views available for future fine-tuned models.

**D4: Guided capture UX with countdown and frame indicators**
User sees: 4 circle indicators (Front / Left / Back / Right). A 10-second countdown drives them to turn. Client records continuously; we extract the 4 frames at t=0s, t=2.5s, t=5s, t=7.5s.
Alternative: manual tap for each view. Rejected: too many taps, breaks flow.

## Risks / Trade-offs

[Risk: User turns at wrong speed] → Show a real-time rotation guide overlay. If frames are bad, user can retake.

[Risk: MediaRecorder unavailable (old iOS)] → Fall back to 4 manual photo uploads (existing single-photo flow used 4 times).

[Risk: Canvas frame grab quality loss] → Capture at native resolution, compress only on upload. FASHN.ai produces good results from 576px-wide inputs anyway.

[Risk: Blob storage cost for 4 images vs 1] → 4× Vercel Blob usage per user onboarding. Negligible at current scale.

## Migration Plan

1. Add `bodyProfile?: BodyProfile` to `WardrobeStore` and `types/index.ts`
2. `loadStore()` returns `bodyProfile: undefined` for existing users — they continue using `userPhotoUrl`
3. Wardrobe page shows "Upgrade your profile" banner if only `userPhotoUrl` is set
4. No data migration needed — localStorage schema is additive

## Open Questions

- Should we store the video itself for future 3D reconstruction? (Lean no for now — storage cost, no current use)
- FASHN future: if FASHN releases multi-image support, the `BodyProfile` struct maps directly — worth checking their changelog.
