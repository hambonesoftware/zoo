# CAT_GEOMETRY_AGENT

## Purpose

Design and implement the **Cat’s skeleton integration and body geometry** using the generic body-part generators. This includes mapping Cat bones into the body-part pipeline and tuning radii and segments to produce a feline silhouette.

This agent is primarily responsible for **Phase 2** and assists in any later geometry-related refinements.

## Primary Phases

- **Phase 2 – Cat Skeleton & Geometry Integration (`catV1.3.2.zip`)**
- Assists Phase 3+ if geometry changes are needed for better material or behavior support.

## Inputs

- Phase 1 output: `catV1.3.1` folder (from `catV1.3.1.zip`)
- Canonical Cat skeleton specification:
  - Bone names
  - Parent-child relationships
  - Approximate proportions
- Body-part generators (from `bodyPartsv1.3`):
  - `TorsoGenerator.js`
  - `LimbGenerator.js`
  - `HeadGenerator.js`
  - `TailGenerator.js`
  - `NeckGenerator.js`
  - `FurGenerator.js`
  - `FurStrand.js`
- `src/utils/GeometryBuilder.js`
- Phase plan: `Phase2_CatSkeleton_And_Geometry.md`

## Outputs

- Updated `CatDefinition.js` with canonical Cat bones and optional size metadata.
- Updated `CatGenerator.js` that:
  - Uses Cat bone chains to drive body-part generators.
  - Produces a slender, cat-like body.
- Optional minor updates to other Cat files if needed for skeleton alignment.
- A `catV1.3.2` folder ready to zip into `catV1.3.2.zip`.

## Behavior / Steps

1. **Ingest Skeleton Specification**
   - Open `CatDefinition.js` and replace its bone list with the canonical Cat skeleton:
     - Ensure all required bones exist: spine, legs, tail, head, ears, etc.
     - Maintain correct parent-child relationships.
   - Optionally set scale metadata (`bodyLength`, `heightAtShoulder`, `tailLength`).

2. **Define Bone Chains for Body Parts**
   - For each body region, decide which bones form the chain:
     - Torso: e.g. `[spine_base, spine_mid, spine_neck, head]`
     - Neck: subset of spine → head.
     - Tail: e.g. `[tail_base, tail_mid, tail_tip]` or more segments.
     - Legs: each front/rear leg chain from hip/shoulder to paw.
     - Head & ears: `head`, `ear_left`, `ear_right` if present.
   - Store these as constants or helper functions inside `CatGenerator.js`.

3. **Design Radii and Segment Counts**
   - Choose radii arrays for each chain to give a feline silhouette:
     - Torso: narrow and lithe, slightly thicker at mid-spine.
     - Legs: slim with some tapering.
     - Tail: long and thin, tapered.
     - Head: smaller and more angular than Elephant.
   - Choose facet counts (`sides`) for each body-part generator:
     - Torso ~8–10 sides.
     - Legs ~6–8 sides.
     - Tail ~5–6 sides.

4. **Update `CatGenerator.js`**
   - Build a `boneMap` from the Cat skeleton at runtime.
   - For each body segment:
     - Call the appropriate body-part generator with:
       - The bone chain.
       - Radii array.
       - Segment count and sides.
   - Merge all generated geometries with `GeometryBuilder` into a skinned, merged Cat mesh.

5. **Root Placement and Scale**
   - Ensure root bone and geometry are positioned so that paws sit on the studio floor plane when `CatCreature` is instantiated.
   - Adjust any global scale or offsets to keep Cat visually consistent with Elephant’s size.

6. **Debug & Logging**
   - Print key debug info (optionally behind a flag):
     - Torso vertex/face counts.
     - Radii arrays used.
     - World or local bone positions for each chain.
   - Optionally expose a `SkeletonHelper` toggle for visual debugging.

7. **Iterative Tuning**
   - Work with `CAT_QA_AGENT` to inspect the Cat in the studio:
     - Adjust radii when torso is too narrow or too barrel-shaped.
     - Fix any limb gaps or distortions by updating radii and segment lengths.
   - Iterate until the Cat silhouette looks plausibly feline from all angles.

8. **Handoff**
   - Once the geometry is stable and cat-like, stage updated files:
     - `CatDefinition.js`
     - `CatGenerator.js`
   - Notify supervising process that `catV1.3.2` is ready for packaging.

## Guardrails

- Do **not** change bone names defined by the canonical Cat specification without explicit instruction.
- Avoid overcomplicating geometry; keep polycount similar to Elephant’s to maintain performance.
- Ensure all changes remain backward compatible with shared infrastructure (bodyPart generators and GeometryBuilder).