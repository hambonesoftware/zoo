# CAT_PEN_AGENT

## Purpose

Implement and polish the **Cat’s pen (CatPen)** in the Zoo’s corner studio. This includes floor and walls, grids, axis markers, bounding box, lighting hooks, and Cat placement so the creature is easy to view and debug.

This agent is primarily responsible for **Phase 5**.

## Primary Phases

- **Phase 5 – Cat Pen, Studio Integration, and Final QA (`catV1.3.5.zip`)**

## Inputs

- `catV1.3.4` folder (from Phase 4)
- Golden Elephant pen implementation: `ElephantPen.js`
- Knowledge of any central animal/pen registry in the Zoo app
- Phase plan: `Phase5_CatPen_Integration_And_QA.md`

## Outputs

- Fully implemented `CatPen.js`:
  - Corner studio layout consistent with ElephantPen.
  - Correct placement and scaling of CatCreature.
  - Grids and axis markers aligned with world axes.
- Zoo registry updated to include CatPen as a selectable pen.
- `catV1.3.5` folder ready for packaging as the golden Cat implementation.

## Behavior / Steps

1. **Analyze `ElephantPen.js`**
   - Identify how:
     - Floor plane is created (size, material, shadow reception).
     - Two walls are placed and oriented (orthogonal axes).
     - Grids and numeric labels are drawn on floor and walls.
     - Axis triad and origin markers are implemented.
     - Lights and shadows are configured for good silhouettes.

2. **Implement `CatPen.js`**
   - Clone ElephantPen’s logic but adapt for Cat:
     - Import `CatCreature` instead of `ElephantCreature`.
     - Keep constructor signature `(scene, options = {})`.
   - Studio layout:
     - Floor plane sized appropriately for Cat gait range.
     - Two walls forming a corner at the origin, with correct orientation (e.g. XZ floor, YZ and XY walls).
   - Grids and labels:
     - Use the same spacing and aesthetic as ElephantPen.
     - Ensure axes markings are correctly aligned and non-overlapping.
   - Axis triad and origin marker:
     - Place at world origin as per ElephantPen.

3. **Place the Cat in the Pen**
   - Instantiate `CatCreature` and add it to the pen group.
   - Ensure Cat is centered on the floor platform.
   - Align Cat’s facing direction with the studio convention (e.g. facing +Z).

4. **Lighting and Shadows**
   - Configure lights similarly to ElephantPen:
     - Ensure the floor receives shadows.
     - Ensure the Cat casts shadows onto the floor.
   - Adjust intensities and positions (if necessary) to best show Cat’s form and material without breaking Elephant’s appearance.

5. **Integration into Zoo Registry**
   - Locate the central registry / factory responsible for pens and animals.
   - Add an entry for Cat:
     - Key (e.g. `'cat'`).
     - Value: `CatPen` constructor or factory function.
   - Ensure UI controls (dropdowns, buttons) include Cat as an option.

6. **Tuning and Visual QA**
   - Work with `CAT_QA_AGENT` to:
     - Verify CatPen loads correctly from a clean start.
     - Check camera interactions (orbit/pan/zoom) with Cat and the corner studio.
     - Verify axes markings are orthogonal and correctly aligned (no duplicated planes).
     - Confirm Cat silhouette is visible and attractive under pen lighting.

7. **Handoff**
   - Stage all Cat files—especially `CatPen.js` and any central registry changes—into `catV1.3.5/`.
   - Notify supervising process that `catV1.3.5` is ready to be zipped as the golden Cat implementation for Zoo v1.3.

## Guardrails

- Do not change ElephantPen behavior or layout except where absolutely necessary to factor out shared code (if desired).
- Maintain consistent visual language across pens: same measurement styles, axis colors, and basic lighting scheme.
- Avoid pen-specific hacks that would break multi-animal usage of shared components.