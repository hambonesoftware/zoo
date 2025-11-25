# Cat v1.3.5 package

This folder contains the final Cat implementation for Zoo v1.3 (Phase 5).
It mirrors the production source layout so it can be dropped into a fresh
checkout under `src/`:

- `src/animals/Cat/*` – Cat creature, geometry, material, behavior, and pen.
- `src/animals/bodyParts/*` – Shared geometry builders used by the Cat.
- `src/libs/BufferGeometryUtils.js` – Utility dependency used by Cat geometry generation.

To integrate:
1. Copy the contents of this folder into your project's `src/` directory.
2. Ensure the animal registry references `CatCreature` and `CatPen` as in `src/animals/registry.js`.
3. Run the Zoo app and select **Cat** from the animal dropdown.
