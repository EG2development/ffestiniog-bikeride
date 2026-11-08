# 51. Register entries carry status and provenance

Date: 2026-10-25

Scope: `src/three-core/registers.ts`, `data/features-<window>.json`, `tests/registers.test.ts`

## Status

Proposed

## Context

The goal requires, for every building: source URLs, observed and retrieved dates, licence, confidence, and a status of existing, construction, approved or demolished, with approval never counted as built. `Feature` has none of these fields.

## Decision

`Feature` gains `status` (existing, construction, approved or demolished) and `provenance` (`urls`, `observedAt`, `retrievedAt`, `licence`, `confidence` high, medium or low). Both are required when `kind` is `building`, and `building` joins `KINDS`.

The validator enforces:

- existing or construction needs a dated observation, not only a planning record;
- an observation older than 3 years gives confidence at most medium;
- every rendered building id resolves to an entry with a real source.

## Consequences

- Incomplete building entries cannot load.
- Existing kinds are unaffected; the fields are optional for them.

## Verification

Spec BL2–BL4 and BL16; design D47.

## Relations

Amended by: [63. Buildings up to date: every building near the line, checked against the latest OS release and the lidar](0063-buildings-up-to-date.md)

Amends: [20. Keep feature and asset registers as validated JSON](0020-registers-as-json.md)

## As built (t13, 2026-10-26)

The decision above stands; this records how it shipped.

- `provenance` also requires `evidence` (map, imagery, record, photo, lidar or planning), on which the existing/construction rule depends.
- Dates must be calendar dates with `observedAt` no later than `retrievedAt`, and the 3-year cap is a calendar rule (t10). The tests are in `tests/registers-buildings.test.ts`.
