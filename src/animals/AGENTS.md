# Animal Creation Agent Guide

## Goal
When prompted for a new animal, generate a folder `src/animals/{AnimalName}` (PascalCase) containing the full JS scaffolding so the creature loads like the Cat and Elephant implementations.

## Required Outputs
1. Create `src/animals/{AnimalName}` if missing.
2. Populate these files (mirror Cat/Elephant naming):
   - `{AnimalName}Definition.js` – anatomy data. Follow the bone/size layout style in `CatDefinition.js` and `ElephantDefinition.js`.
   - `{AnimalName}Behavior.js` – orchestrates state + drives locomotion. Keep constructor/update patterns seen in `CatBehavior.js` and `ElephantBehavior.js` (import locomotion, expose setState, update, getDebugInfo).
   - `{AnimalName}Locomotion.js` – handles movement/pose animations, similar to cat/elephant locomotion classes.
   - `{AnimalName}Creature.js` – assembles geometry + behavior (see `CatCreature.js`, `ElephantCreature.js`).
   - `{AnimalName}Generator.js` – procedural geometry setup like existing Cat/Elephant generators.
   - `{AnimalName}SkinNode.js` – skeletal/skin graph wiring.
   - `{AnimalName}SkinTexture.js` – materials/textures setup; match export shape used by cat/elephant.
   - `{AnimalName}Pen.js` – pen/staging scene wiring the creature into Three.js scenes.
   - `{AnimalName}Location.js` – export canonical spawn transform using the template in `agent_animal_creation.md`.
3. Register the animal in `src/animals/registry.js` with lowercase id and label.

## Naming & Structure Rules
- Use PascalCase for folder and filenames (e.g., `RedPanda`, `RedPandaBehavior.js`).
- Export classes/objects matching filenames (e.g., `export class RedPandaBehavior { ... }`).
- Keep file headers and import styles consistent with Cat/Elephant sources (standard ES modules, no try/catch around imports).
- Behavior/locomotion APIs should expose `update(dt)` and `setState` hooks like Cat/Elephant to stay compatible with existing studio tooling.

## Authoring Tips
- Use Cat files for lightweight quadruped proportions; Elephant files show heavier builds and extra helpers (e.g., torso profiles) if needed.
- Start from CatDefinition bone naming when unsure; extend with species-specific bones (e.g., trunk) like the elephant does.
- Prefer mirroring property names (`bones`, `sizes`, `debug` blocks) so downstream loaders require minimal changes.
- Ensure any new helper modules are imported at top-level without try/catch wrappers.

## Completion Checklist
- [ ] New folder created with all files above.
- [ ] Geometry/behavior exports align with Cat/Elephant signatures.
- [ ] `registry.js` updated to expose `createPen` and `createCreature` factories for the new animal.
- [ ] Lint-free ES module syntax (named exports, matching class names).
