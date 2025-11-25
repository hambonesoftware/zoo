# Phase 5 – Cat Pen, Studio Integration, and Final QA (Create `catV1.3.5.zip`)

## Phase Goal

Finish the Cat integration into the Zoo’s **corner studio** environment by:

- Implementing or refining `CatPen.js` so it matches the production-ready studio style.
- Ensuring the Cat works seamlessly with the Animal Studio / pen selector.
- Performing cross-animal QA to verify nothing broke in Elephant or shared systems.

At the end of this phase, the Cat should:

- Load via the same mechanisms as other animals (e.g., Elephant).
- Render properly in the corner studio: dark walls, floor shadow plane, grids, axis triad, bounding box.
- Be ready for use as a golden Cat implementation for Zoo v1.3.

Deliverable: **`catV1.3.5.zip`**.


## Inputs

- `catV1.3.4.zip` from Phase 4 (Cat geometry, material, behavior, locomotion).
- Golden Elephant studio implementation:
  - `ElephantPen.js` (corner studio with grids, axes, shadows).
- Knowledge of any central registry used to select and display animals/pens.


## Outputs / Deliverables

- A polished `CatPen.js`:
  - Corner studio layout matching Elephant’s.
  - Floor and walls with grids/labels as needed.
  - Correct placement and scaling of the Cat in the studio.
- Any needed updates to central registry or UI to surface the Cat as a selectable animal.
- Final archive **`catV1.3.5.zip`** representing the completed Cat implementation for Zoo v1.3.


## Expected Agents (from `agents_cat.zip`)

- `CAT_PEN_AGENT` – responsible for pen layout, lighting adjustments, and Cat placement.
- `CAT_QA_AGENT` – final integration and regression QA across animals.


## Detailed Steps

### 1. Unpack `catV1.3.4.zip`

1. Create a working folder, e.g. `cat_phase5_work/`.
2. Unzip `catV1.3.4.zip` into `catV1.3.4/`.
3. Confirm presence of:
   - `CatPen.js`
   - `CatCreature.js`
   - All Cat files from previous phases.


### 2. Analyze `ElephantPen.js`

Use `CAT_PEN_AGENT` for this section.

1. Open the golden `ElephantPen.js` and identify:
   - How the platform is created (radius, height, materials).
   - How the two walls are constructed and oriented (XY vs YZ planes).
   - How grids, labels, and axis triads are drawn.
   - How the Elephant is positioned and scaled within the pen.
   - How lighting and shadow configuration is set up (spotlights, ambient lights, etc.).

2. Note any parameters that can/should be shared by CatPen:
   - Floor and wall dimensions, grid spacing, colors.
   - Axis triad size.
   - Bounding box behavior.


### 3. Implement / refine `CatPen.js`

Starting from either the Phase 1 CatPen clone or a fresh copy of `ElephantPen.js`, implement a Cat-specific pen with minimal unique changes.

1. Ensure `CatPen`:

   - Imports `CatCreature` (not ElephantCreature).
   - Accepts the same constructor signature (e.g. `(scene, options = {})`).

2. Studio layout:

   - Create a floor plane large enough for the Cat’s motion range.
   - Create two perpendicular walls forming a corner (as in ElephantPen).
   - Apply grids and labels to walls and floor consistent with the Elephant studio:
     - Grids aligned with world axes.
     - Labels for axes / measurements, if used.

3. Axis triad and origin marker:

   - Include the colored XYZ triad at the world origin.
   - Add an origin marker (e.g., small cylinder or sphere) if used in ElephantPen.

4. Bounding box / debug aids:

   - Add an optional bounding box around the Cat’s typical motion area.
   - Provide toggles (if ElephantPen has them) to enable/disable bounding box and helpers.

5. Cat placement:

   - Instantiate `CatCreature` centered on the platform.
   - Ensure the Cat’s feet are near the floor plane (no floating or sinking).
   - Apply any necessary initial rotation so Cat faces a consistent direction (e.g. toward +Z).


### 4. Lighting and shadows

1. Configure lighting analogous to ElephantPen:

   - Key light(s) that produce readable shading on the Cat.
   - Fill/ambient light to prevent overly dark shadows.
   - Ensure the floor plane receives shadows.

2. Verify that:

   - Shadow casting is enabled for the Cat mesh and relevant lights.
   - The Cat’s silhouette is clean against the walls and floor.
   - No light leaks or odd artifacts appear at the corner seam.


### 5. Integrate CatPen into the central zoo system

1. Find the central registry or code responsible for:

   - Listing available animals/pens.
   - Instantiating a selected pen.

2. Add an entry for Cat:

   - Key: e.g. `'cat'` or `'Cat'`.
   - Value: `CatPen` class or factory function.

3. Ensure any UI (dropdown, buttons, etc.) that lists animals includes Cat.

4. Confirm that selecting Cat from the UI:
   - Cleans up previous pens/animals correctly.
   - Instantiates a new `CatPen` with a fresh CatCreature.


### 6. Cross-animal QA

Use `CAT_QA_AGENT`.

1. Test ElephantPen and other existing pens to ensure they function as before:
   - No regressions from Cat-related changes.
   - All pens still create their animals, and the scene behaves as expected.

2. Test CatPen thoroughly:

   - Enter the Cat pen from a clean app start.
   - Rotate and zoom the camera; ensure the Cat remains visible and well-lit.
   - Observe idle motion and, if possible, walking/prowling states.

3. Pay special attention to:

   - Studio marking alignment: YZ wall vs XZ floor, etc., should be orthogonal and correctly oriented.
   - Grids and axis labels: no duplication or misalignment relative to Cat scale.
   - Performance: the presence of CatPen should not cause significant frame-rate drops.


## Validation & Phase Exit Criteria

Before packaging `catV1.3.5.zip`, verify:

1. **Pen correctness**:
   - CatPen visually matches the style and structure of ElephantPen’s corner studio.
   - Floor and walls are correctly placed and scaled.
   - Grids, axes, and markers are functional and readable.

2. **Integration**:
   - Cat can be selected/loaded via the same mechanisms used to load Elephant.
   - No runtime errors occur when switching between pens.

3. **Behavior and appearance**:
   - Cat stands correctly on the platform.
   - Skin/material looks good in this pen’s lighting.
   - Idle and basic movement are visible and believable.

4. **Regression testing**:
   - ElephantPen and other animals remain unaffected.

If all criteria are met, the Cat implementation is considered production-ready for Zoo v1.3.


## Packaging Instructions

1. Stage the final Cat implementation into a folder, e.g. `catV1.3.5/`, including:
   - `CatPen.js`
   - All Cat creature, geometry, material, and behavior files.
   - Any shared assets required specifically by the Cat (bodyParts and `GeometryBuilder` as standardized).

2. Confirm the folder can be dropped into a fresh Zoo checkout and integrated with minimal steps.

3. Zip as **`catV1.3.5.zip`**.

4. This archive represents the **golden Cat** implementation for Zoo v1.3.
