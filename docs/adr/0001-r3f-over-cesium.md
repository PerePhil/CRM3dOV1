# ADR-0001: React Three Fiber for the OV-1 scene, not CesiumJS

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Project team
- **SPEC sections affected:** §3.1, §8

## Context
The app renders a DoDAF OV-1: a stylized, non-to-scale operational concept graphic (SPEC §8.1).
It needs flat-shaded platforms, labeled links, callouts, and a legend. It does not need geodetic
accuracy, terrain, or a globe. Several people's coding agents will write scene code, so ecosystem
familiarity matters.

## Decision
Use three.js through React Three Fiber + drei. The OV-1 is a compressed "diorama" in arbitrary
units, and the sim stays in SI meters with a render-time mapping (SPEC §3.2).

## Alternatives considered
| Option | Pros | Cons |
|---|---|---|
| CesiumJS | Real globe, terrain, geodetic math | Wrong aesthetic for an OV-1; heavy bundle; ion tokens; harder to stylize |
| Babylon.js | Capable engine, good tooling | Less React-native; less agent/team fluency |
| **R3F + drei** | Declarative scene graph, huge example corpus, drei Html/Line/Edges map directly onto OV-1 needs | We hand-build any geospatial feel |

## Consequences
Easy to stylize and to let agents iterate on visuals. If we ever want real geography, a Cesium
view would be a separate mode, not a rewrite.
