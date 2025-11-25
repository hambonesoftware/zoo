# Phase 3 – Cat Skin, Texture, and Material (Create `catV1.3.3.zip`)

## Phase Goal

Give the Cat its own **distinct visual identity** by implementing:

- A cat-specific procedural skin texture (`CatSkinTexture.js`).
- A cat-specific node-based material (`CatSkinNode.js`) built atop the Zoo’s TSL/NodeMaterial setup.
- Integration of the new material into `CatGenerator.js` so the Cat reads clearly in the studio lighting.

At the end of this phase, the Cat should:

- Have a fur-like base appearance (stylized, not photorealistic).
- Be visually distinct from the Elephant (different hues, patterns, and macro shading).
- Render well in the dark corner studio, with good readability against walls and floor.

Deliverable: **`catV1.3.3.zip`**.


## Inputs

- `catV1.3.2.zip` from Phase 2 (cat-shaped geometry using Cat skeleton).
- The golden Elephant material implementation:
  - `ElephantSkinTexture.js`
  - `ElephantSkinNode.js`
- Knowledge of the studio lighting setup from `ElephantPen.js` (to ensure legible shading).


## Outputs / Deliverables

- Updated Cat material pipeline:
  - `CatSkinTexture.js` – generates a reusable texture (canvas or data) suitable for fur-like variation.
  - `CatSkinNode.js` – constructs a `MeshStandardNodeMaterial` (or equivalent) tuned for Cat.
  - `CatGenerator.js` updated to use `createCatSkinMaterial()` instead of Elephant’s material.
- Cat renders with:
  - A warm or neutral fur palette (e.g., browns, oranges, greys), customizable via options.
  - Subtle patterns: stripes, mottling, or gradients (no need to be species-realistic).
  - Good contrast with the studio environment.


## Expected Agents (from `agents_cat.zip`)

- `CAT_MATERIAL_AGENT` – responsible for texture generation, NodeMaterial graphs, and integration.
- `CAT_GEOMETRY_AGENT` – may assist if material needs extra vertex attributes or UVs.
- `CAT_QA_AGENT` – visual QA under different lighting/view angles.


## Detailed Steps

### 1. Unpack `catV1.3.2.zip`

1. Create a working folder, e.g. `cat_phase3_work/`.
2. Unzip `catV1.3.2.zip` into `catV1.3.2/`.
3. Confirm presence of:
   - `CatGenerator.js`
   - `CatSkinTexture.js` (currently Elephant-derived) – if exists.
   - `CatSkinNode.js` (currently Elephant-derived) – if exists.
   - Any material hookup code in `CatCreature.js` or `CatGenerator.js`.


### 2. Design the cat skin style

Use `CAT_MATERIAL_AGENT` for this section.

Decide on core visual characteristics:

1. **Base palette options** (exposed via `options` argument):
   - `bodyColor` (default: a medium warm brown or grey).
   - `accentColor` (for stripes, patches, or ears).
   - `bellyColor` (lighter, used along underside).

2. **Patterns** (procedural, low-frequency):
   - Vertical gradient: darker along spine, lighter on belly.
   - Soft noise or banding to suggest fur clumping.
   - Optional mild striping along the torso and tail (not necessarily realistic; just playful).

3. **Roughness / metalness**:
   - Low metalness (≈0.0).
   - Moderate roughness (≈0.5–0.8) so highlights are soft and not plastic-like.

4. **Subtle color variation**:
   - Introduce mild per-fragment color noise or pattern blending to avoid flat surfaces.

Document these choices in comments at the top of `CatSkinNode.js`.


### 3. Implement `CatSkinTexture.js`

1. Using `ElephantSkinTexture.js` as a reference, implement `CatSkinTexture.js` that:
   - Creates a canvas (or offscreen texture) with appropriate resolution (e.g., 512×512).
   - Fills background with a base fur color.
   - Draws procedural features such as:
     - Subtle vertical and horizontal noise bands.
     - A central lighter band for belly region (if mapping supports it).
     - Optional stripes: alternating darker bands across the X or Y direction.

2. Expose a simple function, e.g.:

   ```js
   export function createCatSkinTexture(options = {}) {
     // Returns { texture, size } or a THREE.Texture instance, depending on existing conventions.
   }
   ```

3. Keep the implementation lightweight and deterministic (based on `options.seed` if needed), to avoid runtime randomness that’s hard to debug.

4. Ensure texture parameters match the Elephant’s conventions:
   - Wrapping mode (e.g., `THREE.RepeatWrapping`).
   - Min/mag filters.
   - Color space (sRGB vs linear).


### 4. Implement `CatSkinNode.js`

Using `ElephantSkinNode.js` as a template, build a NodeMaterial graph specialized for Cat.

1. Import the necessary three.js TSL/NodeMaterial components and the `createCatSkinTexture` function.

2. In `createCatSkinMaterial(options = {})`:

   - Derive `baseColor`, `accentColor`, `bellyColor` from `options` with sensible defaults.
   - Sample the cat skin texture:
     - Use UVs consistent with Elephant’s mapping, if already established.
   - Construct layers:
     - **Base layer**: `baseColor` modulated by the texture intensity.
     - **Belly gradient**: a vertical gradient (based on world or object-space Y) blending in `bellyColor` near the underside.
     - **Accent bands**: mild modulation using noise or sin/cos functions to simulate subtle striping/shading along the torso and tail.

3. Configure physical parameters:
   - `roughness` in the 0.5–0.8 range.
   - `metalness` near 0.
   - Optional slight `clearcoat` or `sheen` if supported and visually helpful.

4. Return a `MeshStandardNodeMaterial` or the project’s equivalent material class.

5. Ensure no Elephant-specific naming remains:
   - Search for `Elephant` and remove or rename to `Cat` in all material-related files.


### 5. Integrate the material into `CatGenerator.js`

1. In `CatGenerator.js`, import `createCatSkinMaterial` from `CatSkinNode.js`.
2. Replace any Elephant material creation calls with the cat-specific one, e.g.:
   - From: `const material = createElephantSkinMaterial(options);`
   - To: `const material = createCatSkinMaterial(options);`
3. Pass appropriate `options`:
   - `bodyColor`: allow external override but supply a default cat-like color.
   - `accentColor` & `bellyColor` if needed.

4. Apply the material to the `SkinnedMesh` created from the merged cat geometry.

5. If there is a debug flag for wireframe or alternate materials, ensure it still works as before.


### 6. Visual QA in the studio

Use `CAT_QA_AGENT` for this section.

1. Run the Zoo app and load the Cat pen.
2. Check the Cat under typical lighting conditions in the dark corner studio:
   - Confirm the Cat is visible against the floor and walls.
   - Check for blown-out highlights or overly dark regions.
3. Rotate the camera and inspect:
   - Torso: pattern continuity and shading.
   - Legs: no weird UV seams or color jumps.
   - Head and tail: pattern/lighting looks coherent.

4. If the cat appears too flat or too noisy:
   - Adjust the texture contrast and/or NodeMaterial mixing weights.
   - Ensure the underlying geometry is not being overshadowed by busy patterns.

5. Confirm that other animals (Elephant, etc.) are visually unaffected by Cat material changes.


## Validation & Phase Exit Criteria

Before packaging `catV1.3.3.zip`, verify:

1. **Material integration**:
   - Cat uses `createCatSkinMaterial()` and no Elephant material code.
2. **Visual identity**:
   - Cat can be visually distinguished from Elephant in color and shading.
3. **Readability in studio**:
   - Cat is clearly visible in the corner studio, with discernible form and silhouette.
4. **Code correctness**:
   - No runtime errors related to materials or textures.
   - No unused material imports from Elephant in Cat files.
5. **Performance**:
   - Material complexity is reasonable; no obvious frame-rate drop compared to Elephant.


## Packaging Instructions

1. Stage updated material-related Cat files in a new folder, e.g. `catV1.3.3/`, including:
   - `CatSkinTexture.js`
   - `CatSkinNode.js`
   - Updated `CatGenerator.js`
   - Any other Cat files touched during this phase.
2. Ensure shared modules remain unchanged (bodyParts, `GeometryBuilder`, etc.).
3. Zip the folder as **`catV1.3.3.zip`**.
4. Save `catV1.3.3.zip` for use in Phase 4.
