# Phase 1 – Bootstrap Cat Creature from Elephant (Create `catV1.3.1.zip`)

## Phase Goal

Create a **working Cat creature module** for the Zoo app by cloning the **Elephantv1.3** implementation and retargeting it to Cat names and paths, without yet changing the actual body shapes or behavior.

The result of this phase is a **mechanically correct, buildable** `catV1.3.1.zip` that can be dropped into the Zoo project. The Cat will still look and move like an Elephant, but all naming, file layout, and imports will be Cat-specific.

This phase is about **bootstrapping** only:
- Correct filesystem structure
- Correct imports/exports
- No remaining Elephant-specific identifiers in Cat files
- No geometry/animation tuning yet


## Inputs

- `Elephantv1.3.zip` (golden reference)
- `bodyPartsv1.3.zip` (golden, generic body-part generators)
- Existing Zoo repo / project root (if available)
- (Optional but recommended) Canonical Cat skeleton specification and naming (e.g., the user’s canonical `CatDefinition.js` spec)


## Outputs / Deliverables

- Working archive: **`catV1.3.1.zip`** containing:
  - Cat equivalents of all Elephant files:
    - `CatCreature.js`
    - `CatDefinition.js` (temporary, may be identical or stubbed from Elephant; will be refined in later phases)
    - `CatGenerator.js`
    - `CatBehavior.js`
    - `CatLocomotion.js`
    - `CatSkinNode.js`
    - `CatSkinTexture.js`
    - `CatPen.js`
  - Cat directory under `src/animals/Cat/` mirroring the Elephant layout under `src/animals/Elephant/`.
  - `src/animals/bodyParts/*` copied from `bodyPartsv1.3` or Elephant’s bundled copy, unchanged.
  - `src/utils/GeometryBuilder.js` from the golden set, unchanged.

In this phase, **Cat-specific geometry and behavior are NOT yet implemented**. The Cat is essentially a renamed Elephant, but all wiring is correct.


## Expected Agents (from `agents_cat.zip`)

- `CAT_BOOTSTRAP_AGENT` – primary code/file refactor agent for cloning Elephant → Cat.
- `CAT_QA_AGENT` – validation and consistency checker (no Elephant references, imports resolvable).


## Detailed Steps

### 1. Set up a working directory

1. Create a new working folder, e.g. `cat_phase1_work/`.
2. Copy or move `Elephantv1.3.zip` and `bodyPartsv1.3.zip` into this folder.

### 2. Extract the golden archives

1. Use the Python/file tools to unzip:
   - `Elephantv1.3.zip` → `Elephantv1.3/`
   - `bodyPartsv1.3.zip` → `bodyPartsv1.3/`
2. Inspect the structure of `Elephantv1.3/` and note:
   - Root-level files: `ElephantCreature.js`, `ElephantDefinition.js`, `ElephantGenerator.js`, `ElephantBehavior.js`, `ElephantLocomotion.js`, `ElephantSkinNode.js`, `ElephantSkinTexture.js`, `ElephantPen.js`, etc.
   - Mirrored paths under `src/animals/Elephant/`.
   - `src/animals/bodyParts/*` and `src/utils/GeometryBuilder.js`.

### 3. Copy and rename Elephant files to Cat

Use `CAT_BOOTSTRAP_AGENT` for this section.

1. In the working directory, create a new structure mirroring Elephant but for Cat, for example:

   - New root-level files:
     - `CatCreature.js`
     - `CatDefinition.js`
     - `CatGenerator.js`
     - `CatBehavior.js`
     - `CatLocomotion.js`
     - `CatSkinNode.js`
     - `CatSkinTexture.js`
     - `CatPen.js`

   - New subdirectory:
     - `src/animals/Cat/`

2. For each Elephant file:
   - Copy `ElephantCreature.js` → `CatCreature.js`
   - Copy `ElephantDefinition.js` → `CatDefinition.js`
   - Copy `ElephantGenerator.js` → `CatGenerator.js`
   - Copy `ElephantBehavior.js` → `CatBehavior.js`
   - Copy `ElephantLocomotion.js` → `CatLocomotion.js`
   - Copy `ElephantSkinNode.js` → `CatSkinNode.js`
   - Copy `ElephantSkinTexture.js` → `CatSkinTexture.js`
   - Copy `ElephantPen.js` → `CatPen.js`

3. Under `src/animals`:
   - Copy the entire `src/animals/Elephant/` folder to `src/animals/Cat/`, then rename inner files from `Elephant*.js` to `Cat*.js` as needed.
   - Ensure that relative import paths point to `../CatCreature.js` etc., not Elephant.


### 4. Systematic identifier renaming: Elephant → Cat

1. For each new Cat file (both root-level and in `src/animals/Cat/`):
   - Replace all occurrences of class names, imports, comments, and identifiers:
     - `ElephantCreature` → `CatCreature`
     - `ElephantDefinition` → `CatDefinition`
     - `ElephantGenerator` → `CatGenerator`
     - `ElephantBehavior` → `CatBehavior`
     - `ElephantLocomotion` → `CatLocomotion`
     - `ElephantSkinNode` → `CatSkinNode`
     - `ElephantSkinTexture` → `CatSkinTexture`
     - `ElephantPen` → `CatPen`
   - Fix any path references such as:
     - `'./ElephantCreature.js'` → `'./CatCreature.js'`
     - `'../animals/Elephant/ElephantCreature.js'` → `'../animals/Cat/CatCreature.js'` or equivalent.

2. In comments and debug logs:
   - Change human-readable text from “Elephant” to “Cat” to avoid confusion.

3. Ensure that **Elephant-specific identifiers remain unchanged in non-Cat files**:
   - `ElephantCreature.js` and the original Elephant code must remain untouched in their golden archive; only the copies for Cat are edited.


### 5. Temporarily keep Elephant geometry & behavior

For this phase only:

1. Do **not** change any geometry-generating logic inside the copied files beyond renaming identifiers:
   - Torso, head, limbs, tail remain Elephant-shaped.
2. Do **not** alter locomotion patterns or behavior internals yet.
3. `CatDefinition.js` may still be a direct copy of `ElephantDefinition.js` at this step, or a minimal stub:
   - A more accurate cat skeleton will be introduced in Phase 2.
4. If a canonical CatDefinition already exists in the Zoo repo:
   - Optionally copy that into `CatDefinition.js`, but **do not modify any bone naming**. Detailed integration will happen in Phase 2.


### 6. Integrate bodyPartsv1.3

1. From `bodyPartsv1.3/`, copy the generic body-part modules into the Cat working tree **unchanged**:
   - `src/animals/bodyParts/TorsoGenerator.js`
   - `src/animals/bodyParts/LimbGenerator.js`
   - `src/animals/bodyParts/HeadGenerator.js`
   - `src/animals/bodyParts/TailGenerator.js`
   - `src/animals/bodyParts/NeckGenerator.js`
   - `src/animals/bodyParts/FurGenerator.js`
   - `src/animals/bodyParts/FurStrand.js`
2. Copy `src/utils/GeometryBuilder.js` from the golden set (Elephant or bodyParts archive) **unchanged**.
3. Confirm that Cat files import these modules via **relative paths identical to Elephant’s pattern**, just with Cat-specific imports where appropriate (e.g., `CatGenerator` using the same bodyParts modules).


### 7. Ensure build & runtime wiring

Use `CAT_QA_AGENT` for checks and minor wiring fixes.

1. Ensure that the Zoo’s central animal/pen registry (e.g. `AnimalStudio` or similar) can import and instantiate `CatPen` just like `ElephantPen`:
   - If there is a registry array or map of pens, add an entry for `'cat'` using `CatPen`.
2. Ensure that the update loop called by the main app can reach `CatCreature`:
   - `CatPen` must call `this.creature.update(delta)` or equivalent, mirroring Elephant’s logic.
3. Run whatever build/serve command exists for the Zoo project (e.g., `npm run dev` or `npm run build`) and confirm:
   - No module-not-found errors for Cat imports.
   - No runtime `undefined` errors when instantiating CatPen.
   - The Cat (currently Elephant-shaped) appears in the pen, moves, and renders shadows.


## Validation & Phase Exit Criteria

Before packaging `catV1.3.1.zip`, verify all of the following:

1. **No Elephant references in Cat files**:
   - Search across the Cat files (`Cat*.js` and `src/animals/Cat/*`) for the string `Elephant`. There should be **zero** matches.
2. **Imports compile**:
   - All imports inside Cat files resolve successfully when the project is built or run.
3. **Cat can be instantiated**:
   - The app can load `CatPen` and instantiate a Cat creature without throwing exceptions.
4. **Behavior parity with Elephant**:
   - For now, the Cat moves/behaves exactly like the Elephant. This is expected and acceptable at the end of Phase 1.
5. **Preserve golden archives**:
   - `Elephantv1.3.zip` and `bodyPartsv1.3.zip` remain unchanged.
   - The Cat work is entirely in new files/directories.


## Packaging Instructions

1. Gather the newly created/updated Cat-related files and directories into a clean staging folder, for example `catV1.3.1/`.
2. Ensure `catV1.3.1/` contains:
   - All Cat root files (`Cat*.js`)
   - `src/animals/Cat/*`
   - `src/animals/bodyParts/*`
   - `src/utils/GeometryBuilder.js`
   - Any additional configuration or index files strictly needed for Cat integration.
3. Create the archive:
   - `catV1.3.1.zip` with `catV1.3.1/` as its root contents.
4. Save `catV1.3.1.zip` to the working directory for use in Phase 2.


## Notes & Constraints

- **Do not modify** the golden Elephant or bodyParts archives.
- Cat bone names and canonical skeleton will be respected and integrated in **Phase 2**. It is acceptable for `CatDefinition.js` to be temporarily Elephant-like at this step if a canonical CatDefinition is not yet available in the workspace.
- This phase is successful when `catV1.3.1.zip` provides a drop-in Cat module that **builds and runs** and is structurally ready for cat-specific geometry, material, and behavior in later phases.
