# Phase 2 – Cat Skeleton & Geometry Integration (Create `catV1.3.2.zip`)

## Phase Goal

Transform the bootstrapped Cat (currently Elephant-shaped) into a **cat-shaped, skeleton-accurate creature** using:

- The canonical Cat skeleton (`CatDefinition.js`).
- The generic body-part generators from `bodyPartsv1.3`.

At the end of this phase, the Cat should:

- Use the correct Cat bone hierarchy and naming.
- Have a **lithe, feline torso, legs, tail, and head**, distinct from the Elephant.
- Still use the same basic skin/shading as Elephant (Cat-specific material comes in Phase 3).
- Be packaged as **`catV1.3.2.zip`**.


## Inputs

- **From Phase 1**: `catV1.3.1.zip` (bootstrapped Cat copied from Elephant).
- `bodyPartsv1.3` body-part modules (already integrated but unchanged).
- Canonical Cat skeleton specification and constraints, e.g.:
  - Bone names and parent relationships (must remain unchanged).
  - Expected proportions: body length, shoulder height, tail length, leg proportions, etc.
- The Zoo project or a minimal test harness to load and inspect the Cat in the studio.


## Outputs / Deliverables

- Updated archive: **`catV1.3.2.zip`** containing, at minimum, updated versions of:
  - `CatDefinition.js`
  - `CatGenerator.js`
  - Any Cat files that required changes for skeleton or geometry wiring.
- A Cat that:
  - Stands correctly on the pad.
  - Has a clearly cat-like silhouette: slender torso, long tail, proportionally correct legs, smaller head.
  - Uses body-part radii and segment counts appropriate for a feline, not a barrel-shaped Elephant.
- No behavior or material changes beyond what is necessary to support the new geometry.


## Expected Agents (from `agents_cat.zip`)

- `CAT_GEOMETRY_AGENT` – designs and applies skeleton + body-part mapping for Cat.
- `CAT_BOOTSTRAP_AGENT` – may assist with refactors/renames if new helper functions are needed.
- `CAT_QA_AGENT` – runs visual and log-based checks to validate geometry and weights.


## Detailed Steps

### 1. Unpack `catV1.3.1.zip`

1. Create a new working folder, e.g. `cat_phase2_work/`.
2. Copy `catV1.3.1.zip` into it and unzip to `catV1.3.1/`.
3. Confirm that all Cat files and the shared bodyParts + `GeometryBuilder` are present.

### 2. Establish the canonical Cat skeleton

Use `CAT_GEOMETRY_AGENT` for this section.

1. Open `CatDefinition.js` from the Cat archive.
2. Replace or update the bones definition to match the canonical Cat skeleton:
   - Keep **bone names** and **parent relationships** exactly as specified by the user’s canonical CatDefinition (or design them now if no prior spec exists).
   - Ensure there is a clear root bone (e.g. `spine_base` or similar) that sits near the animal’s center of mass.
   - Define a spine chain from hips to neck/head, e.g.:
     - `spine_base` → `spine_mid` → `spine_neck` → `head`
   - Define a tail chain, e.g.:
     - `tail_base` → `tail_mid` → `tail_tip` (more segments if you have them).
   - Define each leg chain with clear naming:
     - Front left: `front_left_hip`/`front_left_shoulder` → `front_left_upper` → `front_left_lower` → `front_left_paw`
     - Front right: analogous
     - Rear left / right: `rear_left_hip` → `rear_left_upper` → etc.

3. If `CatDefinition.js` uses size or scale metadata (e.g. `sizes` object):
   - Define approximate feline metrics:
     - `bodyLength`
     - `heightAtShoulder`
     - `tailLength`
     - `headRadius` or `headLength`

4. Ensure that all bone names expected by the generative code exist and are spelled identically.

> **Constraint:** If the user has provided an existing canonical CatDefinition, **do not change any bone names or parent-child relationships** beyond what that spec allows.


### 3. Plan bone chains for each body part

1. Decide which bones feed into each body-part generator. For example:

   - **Torso:**
     - Bones: `[spine_base, spine_mid, spine_neck, head]`
   - **Neck:**
     - Bones: `[spine_neck, head]` or `[spine_mid, spine_neck, head]` if more detail is desired.
   - **Tail:**
     - Bones: `[tail_base, tail_mid, tail_tip]` (or a longer chain if available).
   - **Front legs:**
     - Front left: `[front_left_hip_or_shoulder, front_left_upper, front_left_lower, front_left_paw]`
     - Front right: analogous.
   - **Rear legs:**
     - Rear left & right: similar chain lengths matching Cat bones.
   - **Head & ears:**
     - Head root bone: `head`
     - Ear bases: `ear_left`, `ear_right` if present, or treat ears as head-attached geometry segments.

2. Sketch approximate radii along each chain to create a lithe, faceted cat shape:
   - Torso radii (for each spine node, from hips to neck):
     - Example: `[0.35, 0.40, 0.33, 0.28]`
   - Neck:
     - Example: `[0.25, 0.20]` (tapering toward head).
   - Tail:
     - Example: `[0.10, 0.07, 0.04]` (thin, flexible).
   - Legs:
     - Example for each leg chain: `[0.18, 0.16, 0.13, 0.11, 0.12]` where the last value might represent paw padding.
   - Head:
     - Slightly egg-shaped, smaller than Elephant head.

Keep these notes as comments or documentation in `CatGenerator.js` for future tuning.


### 4. Update `CatGenerator.js` to use Cat skeleton + body parts

Use `CAT_GEOMETRY_AGENT` to edit `CatGenerator.js` and related Cat files.

1. In `CatGenerator.generate(skeleton, options)`, ensure the generator:

   - Derives bone references from the **Cat skeleton**, not Elephant:
     - Build a `boneMap` keyed by Cat bone names.
   - Passes the planned bone chains and radii to the respective body-part generators:
     - `TorsoGenerator.generateTorsoGeometry(...)`
     - `NeckGenerator.generateNeckGeometry(...)`
     - `TailGenerator.generateTailGeometry(...)`
     - `LimbGenerator.generateLimbGeometry(...)`
     - `HeadGenerator.generateHeadGeometry(...)`

2. For each body part:
   - Replace Elephant-specific chains and radii with the cat-specific ones defined above.
   - Adjust `sides` (facet count) for a lighter, more agile look:
     - Torso: ~8–10 sides.
     - Legs: ~6–8 sides.
     - Tail: ~5–6 sides.
   - Ensure that the geometry segments extend slightly beyond bone joints so they wrap shoulders/hips instead of leaving gaps.

3. Merge geometries:
   - After generating all parts, use the same `GeometryBuilder` utilities that Elephant uses to merge into a single geometry.
   - Confirm that skin indices and weights are assigned correctly along the chains.

4. Root transform & scaling:
   - Ensure the root bone (`spine_base` or similar) is positioned so that the cat’s feet rest on the pad:
     - Adjust any initial offsets if necessary.
   - Confirm the overall cat scale is visually appropriate in the shared studio with Elephant.


### 5. Quick logging & debug helpers

1. Add temporary debug logging in `CatGenerator.js` to verify:
   - Number of torso vertices and faces.
   - Bone positions used for tail and legs.
   - Radii arrays for each body part.
2. Optionally enable a `SkeletonHelper` (similar to Elephant) to visually inspect bone alignments relative to geometry.
3. Use these logs + visuals to tweak radii and segment counts so the cat feels balanced visually:

   - Torso should clearly wrap the spine, hips, and shoulders.
   - Legs should connect cleanly to the torso and reach the floor without distortions.
   - Tail should start thick at the base and taper naturally.


### 6. Visual inspection & tuning

Use `CAT_QA_AGENT` to assist with this section.

1. Run the Zoo app (or test harness) and load the Cat pen.
2. Rotate the camera to view the Cat from multiple angles in the studio:
   - Side profile: verify feline proportions.
   - Top view: check torso width and hip/shoulder definition.
   - Rear and front views: ensure legs and torso join smoothly.
3. Perform iterative tweaks in `CatGenerator.js`:
   - Adjust radii, segment counts, and optional curvature parameters to avoid:
     - Overly barrel-shaped torsos.
     - Disconnected limbs.
     - “Inverted” facets due to strange radius ratios (e.g., tiny mid-radius between big neighbors).

4. Confirm that no Elephant-specific geometry references remain:
   - Search for `Elephant` within `CatGenerator.js` and cat geometry-related code paths. There should be no occurrences.


## Validation & Phase Exit Criteria

Before packaging `catV1.3.2.zip`, verify:

1. **Skeleton correctness**:
   - `CatDefinition.js` reflects the canonical Cat bone structure and naming.
   - Parent-child relationships form valid chains for spine, legs, tail, head, and ears.
2. **Geometry correctness**:
   - All body-part generators are driven by Cat bone chains.
   - Radii and segment counts result in a clearly cat-like silhouette.
3. **No major visual artifacts**:
   - No obvious gaps at limb-torso joints.
   - No wildly stretched vertices or inverted faces.
4. **Runtime stability**:
   - The Cat loads and renders without runtime errors.
   - Existing Elephant and other animals remain unaffected.
5. **Code hygiene**:
   - Cat geometry code is readable, commented, and free from leftover Elephant names or comments.

If any acceptance criterion fails, iterate within this phase until it passes.


## Packaging Instructions

1. Stage the updated Cat files in a new folder, e.g. `catV1.3.2/`, including:
   - Updated `CatDefinition.js`
   - Updated `CatGenerator.js`
   - Any additional Cat files touched during this phase.
2. Ensure that shared modules (bodyParts, `GeometryBuilder`) are present and unchanged from the golden set.
3. Zip the folder into **`catV1.3.2.zip`**.
4. Save `catV1.3.2.zip` for use in Phase 3.
