# 12. Model only structures that have a cited source

Date: 2026-10-25

Scope: `src/three/BridgeView.tsx`, `data/features-3d.json`

## Status

Proposed

## Context

The brief forbids inventing geographic features, and no structure inventory exists. In the POC section, OSM has one structure: way 159029124 (`bridge=yes`, `layer=1`, source tag OS_OpenData_StreetView), a 19.3 m railway bridge over an unclassified road (OSM way 357873359) at km 9.150–9.169.

## Decision

A structure is modelled only if an OSM way with a structure tag, or a Coflein record, backs it. Bridge 159029124 is a generic deck with parapets on the centreline, with the road draped beneath, registered as approximate: the position is from OSM, the form is generic.

## Consequences

- No invented structures.
- Forms are generic.
- In the POC, cuttings and embankments appear only as DEM-derived earthworks (ADR 13).

## Verification

G6 (see docs/spec-3d.md). Design reference: D10 in docs/design-3d.md.

## Relations

Related to: [9. Take the trail height from the DTM along the centreline](0009-trail-height-from-dtm.md)
Related to: [13. Model the trail as a 3 m ribbon over a flattened corridor](0013-trail-ribbon-corridor.md)
