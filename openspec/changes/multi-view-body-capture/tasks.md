## 1. Types and Store

- [ ] 1.1 Add `BodyProfile` interface to `src/types/index.ts` (`front`, `left`, `back`, `right: string`, `capturedAt: number`)
- [ ] 1.2 Update `WardrobeStore` in `src/lib/wardrobe-store.ts`: add optional `bodyProfile?: BodyProfile`, keep `userPhotoUrl` as legacy fallback
- [ ] 1.3 Update `loadStore()` default to include `bodyProfile: undefined`

## 2. View Selection Logic

- [ ] 2.1 Add `selectModelImage(profile: BodyProfile | null, fallback: string | null, category: GarmentCategory): string | null` to `src/lib/fashn.ts`
- [ ] 2.2 Update `tryOn()` in wardrobe page to use `selectModelImage` instead of reading `store.userPhotoUrl` directly

## 3. BodyCapture Component

- [ ] 3.1 Create `src/components/BodyCapture.tsx` — camera permission request, MediaRecorder setup, 10s countdown UI with 4 position indicators (Front / Left / Back / Right)
- [ ] 3.2 Implement `extractFrames(videoBlob: Blob): Promise<Blob[]>` — draw video onto canvas at t=0, 2.5, 5, 7.5s, export as JPEG
- [ ] 3.3 Implement frame upload: 4 parallel `/api/upload` calls, return `{ front, left, back, right }` URLs
- [ ] 3.4 Add MediaRecorder feature-detect: if unsupported, render 4 `PhotoUpload` inputs labeled Front / Left / Back / Right as fallback
- [ ] 3.5 Handle early stop (< 2 good frames): show "Retake" prompt instead of saving

## 4. Wardrobe Page Integration

- [ ] 4.1 Replace `PhotoUpload` for body reference with `BodyCapture` in `src/app/wardrobe/page.tsx`
- [ ] 4.2 Show "Upgrade your body profile" banner when `userPhotoUrl` is set but `bodyProfile` is null
- [ ] 4.3 Disable try-on button and show prompt when neither `bodyProfile` nor `userPhotoUrl` is available

## 5. Try-On Page

- [ ] 5.1 Update `TryOnPanel.tsx` to accept a `bodyProfile` prop as optional; use `front` frame if provided, else existing single-photo upload

## 6. Deploy and Verify

- [ ] 6.1 Build passes (`npm run build`)
- [ ] 6.2 Manual test: capture flow works on mobile browser (Safari iOS + Chrome Android)
- [ ] 6.3 Manual test: fallback single-photo users still work without errors
- [ ] 6.4 Commit on branch `exp/multi-view-body-capture`, push, verify Vercel preview URL
