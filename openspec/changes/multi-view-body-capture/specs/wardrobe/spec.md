## MODIFIED Requirements

### Requirement: User body reference for try-on
The system SHALL accept either a `BodyProfile` (4-view capture) or a single `userPhotoUrl` as the body reference for try-on. `BodyProfile` is the preferred primary; `userPhotoUrl` is the legacy fallback. The wardrobe store SHALL hold both fields: `bodyProfile?: BodyProfile` and `userPhotoUrl?: string`.

#### Scenario: Body profile used as primary reference
- **WHEN** `bodyProfile` is set in the wardrobe store
- **THEN** all try-ons use the profile's `front` frame as `model_image`

#### Scenario: Single photo used as fallback
- **WHEN** `bodyProfile` is null and `userPhotoUrl` is set
- **THEN** try-ons use `userPhotoUrl` as `model_image`

#### Scenario: Upgrade prompt shown
- **WHEN** user has `userPhotoUrl` but no `bodyProfile`
- **THEN** wardrobe page displays an "Upgrade your body profile" banner above the garment grid
