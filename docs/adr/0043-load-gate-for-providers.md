# 43. One load gate for the data providers, applied where a test shows a fault

Date: 2026-10-25

Scope: `src/data/loadGate.ts` (new), `src/data/Scene3DDataProvider.tsx`, `src/data/MapDrapeProvider.tsx`, `src/data/RouteDataProvider.tsx`

## Status

Proposed

## Context

Each provider takes one `delayRender` hold for its whole life. Its `.catch(cancelRender)` sits outside the `cancelled` check, so a failure after unmount still cancels the render. A changed input keeps the old data on screen and no hold is re-taken. Drape errors do not name the section.

In the reel a section never changes its input, but Studio prop edits do. The goal allows changes only where a test or an inspection shows a problem.

## Decision

`createLoadGate`, a pure state machine with `delayRender`, `continueRender` and `cancelRender` injected, takes one hold per input generation and passes an `AbortSignal` to each load. It ignores results from a generation that is no longer current, and calls `cancelRender` only for the current, mounted generation. It clears the data when the input changes, and releases the hold after the children mount (RN5c unchanged).

Failures are `AssetLoadError`s: `section <id>: <path>: <reason>`. `useLoadGate` wraps it for React. A provider moves onto it only after a test reproduces its fault.

## Consequences

- One implementation of the readiness rules, instead of three copies.
- The gate is tested without a React renderer.
- The static tests RN5a, RN5c and RN5d follow the gate.

## Verification

Spec RD3–RD5 and RD7; design D39.

## Relations

Related to: [4. Pass data into the canvas as props, not context](0004-props-into-canvas.md), [33. Aerial scenes drape the cached map tiles on the corridor terrain](0033-aerial-map-tile-drape.md)
