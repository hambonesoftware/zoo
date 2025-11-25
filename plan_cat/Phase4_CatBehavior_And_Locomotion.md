# Phase 4 – Cat Behavior and Locomotion (Create `catV1.3.4.zip`)

## Phase Goal

Give the Cat its own **distinct motion language** by implementing:

- Cat-specific locomotion patterns (`CatLocomotion.js`).
- Cat-specific behavior orchestration (`CatBehavior.js`).
- Integration with `CatCreature.js` and the Zoo’s update loop.

At the end of this phase, the Cat should:

- Idle in a way that feels feline (tail swish, gentle breathing, subtle head/ear motion).
- Walk with a diagonal gait distinct from the Elephant’s heavier stride.
- Transition cleanly between idle and walking states.

Deliverable: **`catV1.3.4.zip`**.


## Inputs

- `catV1.3.3.zip` from Phase 3 (cat-shaped geometry, cat material).
- Golden Elephant behavior and locomotion implementations:
  - `ElephantBehavior.js`
  - `ElephantLocomotion.js`
- Canonical Cat skeleton (from Phase 2) with known bone names and chains.


## Outputs / Deliverables

- `CatLocomotion.js` implementing feline motion patterns:
  - Idle, walk, and optional prowl/run foundations.
- `CatBehavior.js` coordinating state changes and exposing debug info.
- `CatCreature.js` wired to call CatBehavior on each update.
- Cat that **looks and moves like a cat**, not an Elephant.

Packaged as **`catV1.3.4.zip`**.


## Expected Agents (from `agents_cat.zip`)

- `CAT_BEHAVIOR_AGENT` – primary agent for behavior state machines and bone animation.
- `CAT_GEOMETRY_AGENT` – may assist with bone indices or minor skeleton adjustments.
- `CAT_QA_AGENT` – validates motion via visual inspection and logging.


## Detailed Steps

### 1. Unpack `catV1.3.3.zip`

1. Create a working folder, e.g. `cat_phase4_work/`.
2. Unzip `catV1.3.3.zip` to `catV1.3.3/`.
3. Confirm presence of:
   - `CatCreature.js`
   - `CatBehavior.js`
   - `CatLocomotion.js`
   - `CatDefinition.js`
   - Cat generator and material files.


### 2. Analyze the Elephant behavior architecture

Use `CAT_BEHAVIOR_AGENT` to examine:

1. `ElephantBehavior.js`:
   - How it stores references to bones (e.g. a `boneMap` keyed by bone name).
   - Its main state machine (`state`, `time`, etc.).
   - `update(delta)` flow and any helper functions.

2. `ElephantLocomotion.js`:
   - How it implements idle vs. walk cycles.
   - How it computes phase offsets for each leg.
   - How it applies transformations to bones (rotations, translations).

Take note of any generic patterns that can be reused for Cat.


### 3. Implement `CatLocomotion.js`

Starting from the Elephant locomotion as a template, design a Cat-specific locomotion module.

**3.1. High-level design**

1. States (at minimum):
   - `'idle'` – subtle breathing and tail motion.
   - `'walk'` – smooth, moderately paced feline walk.
2. Optional states to stub (for later enhancement):
   - `'prowl'` – lower body, slower, more deliberate steps.
   - `'run'` – faster gait, more exaggerated limb movement.

3. Parameters:
   - `baseHeight`: default body height above ground.
   - `walkSpeed`: stride frequency (higher than Elephant’s).
   - `idleBreathAmplitude`: small vertical oscillation of root/spine.
   - `tailSwayAmplitude` and `tailSwaySpeed`.

**3.2. Implementation details**

1. Constructor:
   - Accepts `skeleton`, `boneMap`, and `mesh` as per ElephantLocomotion.
   - Stores references to key bones:
     - Spine: `spine_base`, `spine_mid`, `spine_neck`, `head`.
     - Tail: `tail_base`, `tail_mid`, `tail_tip`.
     - Legs: `front_left_*`, `front_right_*`, `rear_left_*`, `rear_right_*` chains.
   - Initializes internal time accumulators and state.

2. `update(dt)`:
   - Increment internal `time` with `dt`.
   - Switch on current locomotion state:
     - Call `_updateIdle(dt)` or `_updateWalk(dt)` accordingly.

3. `_updateIdle(dt)`:
   - Apply gentle breathing motion to spine/root:
     - Slight sinusoidal motion on Y for the torso.
   - Animate tail swish:
     - Slow sinusoidal rotation around Y and/or X at tail bones.
   - Optionally add micro-motions:
     - Tiny yaw oscillation of the head.
     - Occasional ear twitches (randomized or low-amplitude noise).

4. `_updateWalk(dt)`:
   - Implement a diagonal gait:
     - Front left + rear right in one phase.
     - Front right + rear left in the opposite phase.
   - Use separate phase offsets per leg chain.
   - For each leg:
     - Move upper and lower bones via rotation to simulate stepping.
     - Ensure feet land at approximate ground plane without penetrating floor.
   - Add mild spine undulation:
     - Subtle side-to-side or up-down motion along the spine to imply flexibility.

5. Constraints:
   - Keep rotations small to avoid unnatural distortions.
   - Maintain continuous motion across state transitions (idle ↔ walk).


### 4. Implement `CatBehavior.js`

1. Ensure `CatBehavior` construction mirrors ElephantBehavior, but with Cat-specific references:

   - Holds:
     - `this.skeleton`
     - `this.mesh`
     - `this.boneMap`
     - `this.locomotion` (instance of `CatLocomotion`)
     - `this.state` (e.g. `'idle'`, `'walk'`)
     - `this.time`

2. Methods:

   - `setState(newState)`:
     - Validate against allowed states (`idle`, `walk`, etc.).
     - Reset any locomotion state if necessary.

   - `update(dt)`:
     - Increment internal `time`.
     - Possibly determine state based on external triggers (for now, a simple default or a `moveSpeed` scalar).
     - Delegate to `this.locomotion.update(dt)`.

   - `getDebugInfo()`:
     - Return a small object with:
       - `state`
       - `time`
       - `locomotionState`
       - Any extra debug values like `currentSpeed`, `tailSwayPhase`, etc.

3. Remove or rename any Elephant-specific labels or comments.


### 5. Wire up `CatCreature.js`

1. Verify that `CatCreature` is constructing `CatBehavior` correctly:

   - When creating the Cat mesh and skeleton, it must pass them into `new CatBehavior(skeleton, mesh)`.
   - `CatCreature.update(delta)` must call `this.behavior.update(delta)`.

2. Ensure CatCreature exposes any debug toggles or helper methods analogous to Elephant’s:
   - `enableSkeletonHelper()`
   - `setState('walk')`, etc. (if relevant).


### 6. Visual QA and tuning

Use `CAT_QA_AGENT`.

1. Run the Zoo app, load the Cat pen, and observe:

   - Idle state:
     - Check breathing motion and tail swish.
     - Confirm no bone jitter or unnatural arcs.
   - Walk state:
     - Trigger walking if hooked up (e.g. a simple speed parameter or GUI toggle).
     - Confirm diagonal gait, not the heavy Elephant stride.

2. Iterate to improve motion:

   - Adjust amplitudes and frequencies to feel “feline”:
     - Cats generally have smoother, quicker steps compared to Elephants.
   - Ensure feet contact ground plane consistently.
   - Keep transitions between idle and walk smooth and continuous.

3. Confirm other animals’ behaviors remain unchanged.


## Validation & Phase Exit Criteria

Before packaging `catV1.3.4.zip`, verify:

1. **Behavior correctness**:
   - Cat idles with believable feline micro-motions.
   - Cat walks with a diagonal gait; movement feels nimble compared to Elephant.

2. **Runtime stability**:
   - No runtime errors from `CatBehavior` or `CatLocomotion`.
   - No bone index or undefined reference errors during updates.

3. **Code hygiene**:
   - No leftover `Elephant` references in Cat behavior files.
   - Behavior code is documented with brief comments describing each motion.

4. **Visual approval**:
   - Motion looks reasonable from multiple camera angles in the studio.

If any criterion fails, iterate within this phase until satisfied.


## Packaging Instructions

1. Stage behavior-related files into a new folder, e.g. `catV1.3.4/`, including:
   - `CatLocomotion.js`
   - `CatBehavior.js`
   - Updated `CatCreature.js`
   - Any related configuration or debug files touched in this phase.
2. Ensure geometry and material files from previous phases are present and consistent.
3. Zip as **`catV1.3.4.zip`**.
4. Save `catV1.3.4.zip` for the final integration and QA phase.
