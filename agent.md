````md
# Agents.md — Zoo CreatureStudio: Elephant Ring + Skeleton Knobs (Tier A + Tier B)

You are a repo agent working in the **Zoo** repository:

- https://github.com/hambonesoftware/zoo

This Agents.md updates the prior studio plan to add **real, high-impact tuning controls** for the elephant:
- **Tier A (instant):** a *debug rings overlay* that updates live (no rebuild)
- **Tier B (debounced rebuild):** skeleton length + real limb mesh radius/ring controls (regenerate geometry)

The plan assumes the Zoo-based CreatureStudio UI overlay already exists (animal dropdown, tuning panel, presets, reset, etc.).
If it does not, implement the base studio first and then proceed.

---

## Mission
Deliver a Zoo-identical CreatureStudio where the user can:
1) Live-adjust **limb “ring” visualization** (radius/placement/count) instantly via a debug overlay.
2) Adjust **elephant skeleton segment lengths** (legs/spine/neck/trunk) with a debounced rebuild.
3) Adjust **elephant limb thickness profile and ring density** in the actual limb mesh generation with a debounced rebuild.

All results must remain **Zoo-style** (same renderer, same generator pipeline, same material conventions).
No “second pipeline,” no blueprint compiler.

---

## Non-Negotiables
- Preserve **WebGPU-only** behavior (Zoo’s stance).
- Default tuning must render **exactly like current Zoo elephant**.
- No hidden fallbacks: if rebuild fails, show a visible error overlay and keep last valid creature.
- Prevent resource leaks: always dispose geometries/materials when rebuilding.
- Keep changes surgical and minimal.

---

## Concepts
### Tier A (Instant)
- Debug visualization overlays (rings drawn as separate meshes/lines) that move/rescale on every slider tick.
- Must not require mesh rebuild or skeleton rebinding.

### Tier B (Debounced Rebuild)
- Anything that changes:
  - bone rest offsets / segment lengths
  - mesh generator radii profiles
  - ring density / sides count
- Rebuild at most ~5–10x/sec while dragging via debounce (100–250ms).

---

## Phase 1 — Expand Elephant Tuning Schema + Implement Debug Rings Overlay (Tier A)

### 1.1 Add new Elephant tuning schema + defaults
In `ElephantModule.getTuningSchema()` and `ElephantModule.getDefaultTuning()` add:

#### Global / Debug
- `global.scale` (already exists)
- `global.rotateY` (already exists)
- `debug.showSkeleton` (already exists)

#### Debug Rings Overlay (Tier A)
Global settings:
- `debugRings.enabled` (bool)
- `debugRings.global.radiusScale` (0.2..3.0)
- `debugRings.global.thickness` (0.002..0.08) (units in scene scale)
- `debugRings.global.opacity` (0.05..1.0)
- `debugRings.global.offsetX` (-1..1)
- `debugRings.global.offsetY` (-1..1)
- `debugRings.global.offsetZ` (-1..1)

Per limb (repeat for: `frontLeft`, `frontRight`, `backLeft`, `backRight`):
- `debugRings.frontLeft.enabled` (bool) (optional; or inherit global enabled)
- `debugRings.frontLeft.radiusScale` (0.2..3.0)
- `debugRings.frontLeft.count` (2..24)
- `debugRings.frontLeft.startT` (0..1)
- `debugRings.frontLeft.endT` (0..1)
- `debugRings.frontLeft.bias` (-1..1)
- Optional per-limb offsets:
  - `debugRings.frontLeft.offsetX/Y/Z` (-1..1)

Schema format requirement:
```js
{
  "debugRings.frontLeft.count": { label, min, max, step, type: "int", group: "Debug Rings / Front Left" },
  ...
}
````

---

### 1.2 Create RingsOverlay implementation (Tier A)

Add a file:

* `src/animals/Elephant/debug/RingsOverlay.js`

RingsOverlay responsibilities:

* Construct and manage ring meshes (or line rings) attached under a `root` group.
* Provide:

  * `setVisible(bool)`
  * `update(tuning, bonesByName)`
  * `dispose()`

How placement works:

* For each limb, define the limb chain as bone names:

  * frontLeft: upper → lower → foot (or shoulder → upper → lower → foot if available)
  * frontRight: same
  * backLeft/backRight: similar
* Compute start and end points:

  * Use `bone.matrixWorld` positions for start/end anchors.
* Place rings:

  * Generate `count` values of `u` in [0..1]
  * Map to `t` within `[startT..endT]` using a bias curve:

    * `t = biasCurve(u, bias)` then `t = lerp(startT, endT, t)`
  * Position = `lerp(startPos, endPos, t) + offsets`
* Radius:

  * base ring radius scaled by `debugRings.global.radiusScale * debugRings.<limb>.radiusScale`
* If `count` changed: recreate ring meshes; otherwise reuse meshes and update transforms.

Implementation notes:

* Keep it lightweight: use `THREE.TorusGeometry` or a simple ring line geometry.
* If using material opacity, set `transparent: true` and update material opacity on change.
* RingsOverlay must not rely on limb mesh generation; it is purely a debug overlay.

---

### 1.3 Wire Tier A changes into ElephantModule.applyTuning()

In Elephant’s module instance (returned by `build()`):

* Store:

  * `this.ringsOverlay`
  * `this.skeletonHelper` (if present)
  * `this.tuning` (last applied tuning)

`applyTuning(tuning)` must:

* Apply transforms (scale/rotate) to the animal root.
* Toggle skeleton helper visibility based on `debug.showSkeleton`.
* Call `ringsOverlay.update(tuning, bonesByName)`.

Acceptance criteria (Phase 1):

* Dragging debug ring sliders updates ring count, radius, and placement instantly.
* No rebuild occurs during Tier A changes.
* Switching animals properly disposes overlays.

---

## Phase 2 — Add Tier B Rebuild: Skeleton Length + Limb Mesh Radii/Ring Density (Debounced)

### 2.1 Extend tuning schema for Tier B rebuild keys

#### Skeleton Length (Tier B)

Front legs:

* `skeleton.front.upperLenScale` (0.5..2.0)
* `skeleton.front.lowerLenScale` (0.5..2.0)
* `skeleton.front.footLenScale` (0.5..2.0)

Back legs:

* `skeleton.back.upperLenScale` (0.5..2.0)
* `skeleton.back.lowerLenScale` (0.5..2.0)
* `skeleton.back.footLenScale` (0.5..2.0)

Body:

* `skeleton.spineLenScale` (0.5..2.0)
* `skeleton.neckLenScale` (0.5..2.0)

Head:

* `skeleton.headScale` (0.5..2.0)

Trunk:

* `skeleton.trunkLenScale` (0.5..2.0)

#### Limb Mesh Profile (Tier B)

Per limb (repeat for each limb):

* `limbMesh.frontLeft.upperRadius` (0.05..2.0)
* `limbMesh.frontLeft.kneeRadius` (0.05..2.0)
* `limbMesh.frontLeft.ankleRadius` (0.05..2.0)
* `limbMesh.frontLeft.footRadius` (0.05..2.0)
* Optional:

  * `limbMesh.frontLeft.footFlare` (-1.0..1.0)

#### Limb Mesh Ring Density / LowPoly

* `limbMesh.ringsPerSegment` (2..24) (int)
* `limbMesh.sides` (3..48) (int)
* `render.lowPoly` (bool) can map to `limbMesh.sides` preset if already present.

---

### 2.2 Implement ElephantModule.rebuild(tuning) and disposal

Add `rebuild(tuning)` to elephant instance with:

1. Dispose old skinned meshes and materials.
2. Dispose old skeleton helper and overlay objects.
3. Build a modified elephant definition/rest pose:

   * Multiply relevant bone local offsets by segment scales (proportional).
   * Apply head scale if definition supports it (or scale head group if not).
   * Apply trunk length scaling by scaling trunk bone offsets.
4. Generate meshes using the same generator pipeline (Zoo elephant):

   * Pass updated limb radii profiles into limb generation.
   * Pass ring density: `ringsPerSegment` and `sides`.
5. Recreate skeleton helper + rings overlay.
6. Reapply Tier A tuning immediately after rebuild so overlays match.

If rebuild fails:

* Show an on-screen error overlay (do not crash).
* Keep the last valid creature mounted (no blank scene).

---

### 2.3 Debounce rebuild calls in the Tuning UI

Update the studio tuning panel logic:

* Determine which keys are Tier A vs Tier B.

  * Tier A: `global.*` transforms, `debug.*`, `debugRings.*`
  * Tier B: `skeleton.*`, `limbMesh.*`, anything affecting geometry/skeleton
* On Tier A changes:

  * call `animal.applyTuning(tuning)` immediately
* On Tier B changes:

  * call a debounced function that calls `animal.rebuild(tuning)` after 100–250ms
* Ensure repeated dragging cancels pending rebuild timers.

Acceptance criteria (Phase 2):

* Changing skeleton or limb mesh knobs rebuilds the elephant smoothly (debounced).
* No geometry duplication in the scene after repeated rebuilds.
* Memory does not balloon during repeated rebuilds (dispose is correct).
* Default tuning continues to match Zoo elephant exactly.

---

## Optional Phase 2.5 — True Limb Ring Placement Control for Actual Limb Mesh

Only do this if needed. This adds non-uniform ring placement for the generated limb mesh.

Modify the limb geometry generator (commonly `LimbGenerator.generateLimbGeometry()`):

* Allow either:

  * `tStops` array (explicit ring positions along segment)
  * OR a `distributionFn(u)->t`
* Replace uniform `t=i/(rings-1)` with the custom distribution.

Add tuning keys:

* `limbMesh.ringBias` (-1..1)
* `limbMesh.startT`, `limbMesh.endT` (0..1) (optional)

Acceptance criteria:

* Limb mesh ring spacing visibly shifts with placement/bias sliders.

---

## File Targets (Expected)

These are typical files; locate the actual ones in the repo and adapt.

Add:

* `src/animals/Elephant/debug/RingsOverlay.js`

Modify (likely):

* `src/animals/modules/ElephantModule.js` (or wherever the Elephant module is)
* `src/ui/TuningPanel.js` (or studio overlay UI)
* `src/pens/AnimalStudioPen.js` (only if debug root needed)
* Limb generator file (only if Phase 2.5): `src/animals/bodyParts/LimbGenerator.js` (or equivalent)

---

## Testing / Verification Checklist

* [ ] Studio runs WebGPU-only as before.
* [ ] Elephant default is unchanged (visual parity).
* [ ] Tier A rings overlay updates instantly while dragging.
* [ ] Tier B skeleton/limb mesh knobs rebuild smoothly with debounce.
* [ ] No duplicated grids/walls/rings after switching animals.
* [ ] No console errors during normal use.
* [ ] Resource disposal verified:

  * geometries disposed
  * materials disposed
  * overlays disposed
  * old roots removed
* [ ] Preset save/load still works and includes the new tuning keys.

---

## Implementation Order (Do Exactly This)

1. Add schema + defaults for `debugRings.*`.
2. Implement RingsOverlay and wire it into `applyTuning()`.
3. Confirm Tier A sliders work with no rebuild.
4. Add schema + defaults for `skeleton.*` and `limbMesh.*`.
5. Implement `rebuild(tuning)` with proper disposal and regeneration.
6. Wire Tier B keys to debounced rebuild from the UI controller.
7. (Optional) Implement limb generator placement controls (Phase 2.5).

End of Agents.md

```
::contentReference[oaicite:0]{index=0}
```
