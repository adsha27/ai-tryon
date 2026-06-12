## ADDED Requirements

### Requirement: View selection by garment category
The system SHALL select the most appropriate body profile frame as `model_image` for FASHN.ai based on the garment's category. Selection rules: `tops` → `front`, `bottoms` → `front`, `full-body` → `front`, `auto` → `front`. All categories use front for now; architecture allows future per-category overrides.

#### Scenario: Tops try-on with body profile
- **WHEN** user triggers try-on on a top garment and a body profile exists
- **THEN** `front` frame is sent as `model_image` to FASHN.ai

#### Scenario: Bottoms try-on with body profile
- **WHEN** user triggers try-on on a bottoms garment and a body profile exists
- **THEN** `front` frame is sent as `model_image` to FASHN.ai

### Requirement: Fallback to single photo when no body profile
The system SHALL fall back to `userPhotoUrl` as `model_image` if `bodyProfile` is null. This ensures backwards compatibility for existing wardrobe users.

#### Scenario: No body profile, single photo exists
- **WHEN** user triggers try-on and `bodyProfile` is null but `userPhotoUrl` is set
- **THEN** `userPhotoUrl` is used as `model_image` without error

#### Scenario: Neither profile nor photo
- **WHEN** user triggers try-on and both `bodyProfile` and `userPhotoUrl` are null
- **THEN** try-on button is disabled; UI prompts user to add a photo or capture body profile
