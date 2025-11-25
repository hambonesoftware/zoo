# CAT_BEHAVIOR_AGENT

## Purpose

Implement and refine the Cat’s **behavior and locomotion**, giving it a motion language that feels feline and distinct from the Elephant. This covers idle behavior (breathing, tail motion) and a diagonal walking gait.

This agent is primarily responsible for **Phase 4**.

## Primary Phases

- **Phase 4 – Cat Behavior and Locomotion (`catV1.3.4.zip`)**

## Inputs

- `catV1.3.3` folder (from Phase 3)
- Golden Elephant behavior code:
  - `ElephantBehavior.js`
  - `ElephantLocomotion.js`
- Canonical Cat skeleton and geometry (from Phase 2)
- Phase plan: `Phase4_CatBehavior_And_Locomotion.md`

## Outputs

- `CatLocomotion.js` with feline idle and walk implementations.
- `CatBehavior.js` orchestrating state transitions and update flow.
- Updated `CatCreature.js` if needed for behavior wiring.
- A Cat that idles and walks like a cat.
- `catV1.3.4` folder ready for packaging.

## Behavior / Steps

1. **Study Elephant Behavior Architecture**
   - Examine `ElephantBehavior.js`:
     - How the state machine is structured.
     - How bone references are obtained and stored.
   - Examine `ElephantLocomotion.js`:
     - How idle and walk states are implemented.
     - How leg phases and bone rotations are computed.

2. **Define Cat Motion States**
   - At minimum, support:
     - `idle` – subtle breathing, tail swish, micro-motions.
     - `walk` – diagonal feline gait.
   - Optionally stub:
     - `prowl`, `run` for future expansion.

3. **Implement `CatLocomotion.js`**
   - Constructor:
     - Accept `skeleton`, `boneMap`, and `mesh`.
     - Cache references to key bones:
       - Spine chain, tail bones, all legs, head, and ears.
   - Time and state:
     - Maintain internal `time` and `state` (`idle` or `walk`).
   - `_updateIdle(dt)`:
     - Apply small sinusoidal vertical motion to spine/root for breathing.
     - Animate tail with gentle side-to-side and up-down motion.
     - Optionally add head sway and ear twitches.
   - `_updateWalk(dt)`:
     - Implement a diagonal gait:
       - Front-left + rear-right in one phase.
       - Front-right + rear-left in opposite phase.
     - Use sine-based phase offsets to animate leg bones.
     - Adjust spine slightly for a smoother, feline feel.
   - `update(dt)`:
     - Increment `time`.
     - Delegate to `_updateIdle` or `_updateWalk` based on current state.

4. **Implement `CatBehavior.js`**
   - Fields:
     - `skeleton`, `mesh`, `boneMap`, `locomotion`, `state`, `time`.
   - `setState(newState)`:
     - Validate `newState` in allowed set: `{ idle, walk }` for now.
     - Optionally reset locomotion sub-state.
   - `update(dt)`:
     - Increment `time`.
     - Call `this.locomotion.update(dt)`.
   - `getDebugInfo()`:
     - Return `state`, `time`, and locomotion-specific diagnostic values.

5. **Wire Into `CatCreature.js`**
   - Ensure `CatCreature`:
     - Instantiates `CatBehavior` with the Cat skeleton and mesh.
     - Implements `update(delta)` that calls `this.behavior.update(delta)`.
   - Maintain parity with Elephant’s creature wiring pattern where reasonable.

6. **Tuning and QA**
   - Work with `CAT_QA_AGENT` to:
     - Observe Cat idle in the studio; adjust amplitude and frequency for natural feel.
     - Trigger walking and check gait from multiple angles.
     - Adjust phase offsets and rotation ranges until the Cat appears nimble but stable.
   - Ensure no leg pops, foot sliding, or overly stiff motion.

7. **Handoff**
   - Stage updated files:
     - `CatLocomotion.js`
     - `CatBehavior.js`
     - `CatCreature.js` (if modified).
   - Notify supervising process that `catV1.3.4` is ready for packaging.

## Guardrails

- All motions should be subtle enough to avoid mesh tearing or extreme distortions.
- Do not change bone names or hierarchy; only adjust rotations/transforms.
- Keep performance in mind; no heavy per-frame allocations inside the update loop.