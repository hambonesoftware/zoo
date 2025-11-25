# CAT_BOOTSTRAP_AGENT

## Purpose

Clone and adapt the **Elephant v1.3** implementation into a Cat-specific implementation while preserving:
- File structure
- Import/export wiring
- Build compatibility

This agent is responsible for the initial bootstrap (Phase 1) and for subsequent refactors where bulk renaming or file cloning is required.

## Primary Phases

- **Phase 1 – Bootstrap Cat Creature from Elephant (`catV1.3.1.zip`)**
- Assists in later phases when structural refactors or new helper modules are needed.

## Inputs

- `Elephantv1.3.zip` (golden)
- `bodyPartsv1.3.zip` (golden)
- Existing Zoo repo (if present)
- Phase plan file: `Phase1_Bootstrap_CatV1.3.1.md`

## Outputs

- New Cat-specific files cloned from Elephant equivalents:
  - `CatCreature.js`
  - `CatDefinition.js` (temporary or stub)
  - `CatGenerator.js`
  - `CatBehavior.js`
  - `CatLocomotion.js`
  - `CatSkinNode.js`
  - `CatSkinTexture.js`
  - `CatPen.js`
- Mirrored Cat directory under `src/animals/Cat/`
- Updated imports and exports so all Cat files compile and run
- A buildable **`catV1.3.1`** folder ready to be zipped

## Behavior / Steps

1. **Unpack Golden Archives**
   - Extract `Elephantv1.3.zip` and `bodyPartsv1.3.zip` into working folders.
   - Inspect Elephant’s file layout and note:
     - Root-level Elephant files
     - `src/animals/Elephant/` contents
     - Shared `src/animals/bodyParts/*`
     - `src/utils/GeometryBuilder.js`

2. **Create Cat File Skeleton**
   - In a new working tree, create Cat root files by copying Elephant files:
     - `ElephantCreature.js` → `CatCreature.js`
     - `ElephantDefinition.js` → `CatDefinition.js`
     - `ElephantGenerator.js` → `CatGenerator.js`
     - `ElephantBehavior.js` → `CatBehavior.js`
     - `ElephantLocomotion.js` → `CatLocomotion.js`
     - `ElephantSkinNode.js` → `CatSkinNode.js`
     - `ElephantSkinTexture.js` → `CatSkinTexture.js`
     - `ElephantPen.js` → `CatPen.js`
   - Under `src/animals`, copy `Elephant` directory to `Cat` and rename files to Cat equivalents.

3. **Rename Identifiers and Imports**
   - For each Cat file (root-level and `src/animals/Cat/*`):
     - Replace class and symbol names:
       - `ElephantCreature` → `CatCreature`
       - `ElephantDefinition` → `CatDefinition`
       - `ElephantGenerator` → `CatGenerator`
       - `ElephantBehavior` → `CatBehavior`
       - `ElephantLocomotion` → `CatLocomotion`
       - `ElephantSkinNode` → `CatSkinNode`
       - `ElephantSkinTexture` → `CatSkinTexture`
       - `ElephantPen` → `CatPen`
     - Fix relative imports:
       - `./ElephantCreature.js` → `./CatCreature.js`
       - `../animals/Elephant/...` → `../animals/Cat/...` where appropriate.
   - Update log and debug strings from “Elephant” to “Cat” within Cat files.

4. **Integrate Shared Modules**
   - Copy `src/animals/bodyParts/*` and `src/utils/GeometryBuilder.js` from the golden set into the working tree unchanged.
   - Ensure Cat files import these modules using the same paths as Elephant.

5. **Wire Cat into Studio (Minimal)**
   - Ensure `CatPen` constructs a `CatCreature` and adds it to the scene.
   - Keep Elephant’s studio layout, but with Cat-specific names only (geometry/behavior unchanged for now).

6. **Prepare for QA**
   - Confirm the project builds with Cat files present.
   - Confirm that `CatPen` can be instantiated without runtime errors.
   - Provide the resulting Cat directory and files to `CAT_QA_AGENT` for validation.

7. **Handoff**
   - Once all structural and naming changes are complete and verified, stage files into a `catV1.3.1/` folder and notify the supervising process to package it as `catV1.3.1.zip`.

## Guardrails

- **Never modify** the original Elephant or bodyParts golden archives.
- Ensure **no `Elephant` string remains** inside Cat files.
- Preserve coding style, formatting, and comments except where Elephant-specific wording must be updated.
