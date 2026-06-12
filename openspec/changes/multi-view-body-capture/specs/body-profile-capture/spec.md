## ADDED Requirements

### Requirement: Video capture via device camera
The system SHALL allow users to record a 360° body turn using their device camera directly in the browser. No app install is required. The capture flow SHALL use the MediaRecorder API with the device's rear or front camera.

#### Scenario: Successful capture start
- **WHEN** user clicks "Capture body profile"
- **THEN** browser requests camera permission and begins recording

#### Scenario: Camera permission denied
- **WHEN** user denies camera permission
- **THEN** system displays an error message and offers the manual 4-photo fallback

#### Scenario: MediaRecorder unsupported
- **WHEN** browser does not support MediaRecorder API
- **THEN** system automatically shows the manual 4-photo upload flow instead

### Requirement: Guided 10-second turn countdown
The system SHALL display a guided countdown UI during recording. The UI SHALL show 4 position indicators (Front, Left, Back, Right) and highlight the current target position based on elapsed time. Recording SHALL automatically stop after 10 seconds.

#### Scenario: Countdown completes normally
- **WHEN** 10 seconds elapse after recording starts
- **THEN** recording stops automatically and frame extraction begins

#### Scenario: User stops recording early
- **WHEN** user taps "Stop" before 10 seconds
- **THEN** system attempts frame extraction with whatever footage is available; if fewer than 2 usable frames, prompts user to retake

### Requirement: Client-side frame extraction at 4 timestamps
The system SHALL extract exactly 4 frames from the recorded video using canvas rendering at timestamps t=0s, t=2.5s, t=5s, t=7.5s. Frames SHALL be exported as JPEG at the video's native resolution. Each frame SHALL be uploaded to Vercel Blob storage and return a public URL.

#### Scenario: All 4 frames extracted successfully
- **WHEN** video recording completes
- **THEN** system extracts frames at t=0, t=2.5, t=5, t=7.5 seconds and uploads all 4 to storage

#### Scenario: Upload failure for one frame
- **WHEN** one of the 4 frame uploads fails
- **THEN** system retries once; if still failing, shows an error and allows full retake

### Requirement: Body profile stored in wardrobe
The system SHALL save the 4 frame URLs as a `BodyProfile` object in the wardrobe store with fields: `front`, `left`, `back`, `right`, and `capturedAt` timestamp. An existing `BodyProfile` SHALL be replaced when a new capture is completed.

#### Scenario: Profile saved after capture
- **WHEN** all 4 frames are uploaded successfully
- **THEN** `bodyProfile` is written to the wardrobe store and persisted to localStorage

#### Scenario: User retakes profile
- **WHEN** user initiates a new capture after a profile already exists
- **THEN** old profile URLs are replaced with new ones after successful capture
