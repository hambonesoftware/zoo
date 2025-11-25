# CAT_MATERIAL_AGENT

## Purpose

Define and implement the **Cat’s skin, texture, and material** so it has a distinct, readable visual identity in the Zoo’s corner studio while remaining performant and consistent with the NodeMaterial pipeline.

This agent is primarily responsible for **Phase 3**.

## Primary Phases

- **Phase 3 – Cat Skin, Texture, and Material (`catV1.3.3.zip`)**

## Inputs

- `catV1.3.2` folder (from Phase 2)
- Elephant’s material implementation:
  - `ElephantSkinTexture.js`
  - `ElephantSkinNode.js`
- Knowledge of studio lighting from `ElephantPen.js`
- Phase plan: `Phase3_CatSkin_And_Material.md`

## Outputs

- `CatSkinTexture.js` – cat-specific procedural texture generator.
- `CatSkinNode.js` – NodeMaterial builder for Cat’s skin.
- Updated `CatGenerator.js` that uses `createCatSkinMaterial()`.
- A visually distinct Cat with legible form in the corner studio.
- `catV1.3.3` folder ready for packaging.

## Behavior / Steps

1. **Analyze Elephant Material Pipeline**
   - Review `ElephantSkinTexture.js` to understand:
     - Canvas or data texture creation.
     - Color/pattern strategy.
     - Wrapping, filtering, and color space.
   - Review `ElephantSkinNode.js` to understand:
     - NodeMaterial setup.
     - How texture, colors, and lighting parameters are combined.

2. **Design Cat Visual Style**
   - Choose default color palette:
     - `bodyColor`: warm brown or neutral grey.
     - `accentColor`: slightly darker or complementary color.
     - `bellyColor`: lighter tone for underside.
   - Decide on patterns:
     - Mild stripes or mottling.
     - Vertical gradient for belly and spine.
     - Low-frequency noise for fur variation.
   - Choose physical parameters:
     - `metalness` near 0.
     - `roughness` around 0.5–0.8.

3. **Implement `CatSkinTexture.js`**
   - Create a function `createCatSkinTexture(options = {})` that:
     - Builds a canvas (e.g., 512×512).
     - Fills with base `bodyColor`.
     - Overlays patterns:
       - Soft noise bands.
       - Belly or spine gradients if UV mapping supports it.
       - Optional subtle striping.
     - Returns a `THREE.Texture` configured with:
       - Repeat wrapping as needed.
       - Compatible filtering and color space.

4. **Implement `CatSkinNode.js`**
   - Import NodeMaterial tools and `createCatSkinTexture`.
   - Create a function `createCatSkinMaterial(options = {})` that:
     - Generates or receives the cat skin texture.
     - Defines node graphs for:
       - Base albedo from texture and `bodyColor`.
       - Belly gradient blending in `bellyColor`.
       - Accent modulation using `accentColor` and noise/stripe functions.
     - Sets physical props:
       - `roughness` and `metalness`.
     - Returns a `MeshStandardNodeMaterial` (or project equivalent).

5. **Integrate into `CatGenerator.js`**
   - Replace any Elephant material usage with Cat material:
     - Import `createCatSkinMaterial` from `CatSkinNode.js`.
     - Call it with options like `{ bodyColor, accentColor, bellyColor }`.
   - Apply the resulting material to the Cat’s `SkinnedMesh`.

6. **Visual QA**
   - Work with `CAT_QA_AGENT` to check Cat in the corner studio:
     - Verify good contrast against floor/walls.
     - Ensure patterns are not too noisy or too flat.
     - Confirm that materials of other animals remain unchanged.

7. **Performance Check**
   - Ensure no heavy CPU-side per-frame texture generation; textures should be created once.
   - Keep NodeMaterial graph complexity similar to Elephant’s to avoid performance regressions.

8. **Handoff**
   - Stage updated Cat files:
     - `CatSkinTexture.js`
     - `CatSkinNode.js`
     - `CatGenerator.js` (with material hookup).
   - Notify supervising process that `catV1.3.3` is ready for packaging.

## Guardrails

- Do not introduce hard dependencies that break non-NodeMaterial builds (if any exist).
- Avoid color schemes that make the Cat hard to see in the dark studio.
- Keep Cat’s visual style consistent with the overall Zoo aesthetic (stylized, faceted, not photoreal).