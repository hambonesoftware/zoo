# Agents.md
# Zoo CreatureStudio UI/UX Upgrade Agent Instructions

Repo: https://github.com/hambonesoftware/zoo

## Mission
Upgrade the **CreatureStudio UI inside the Zoo repo** so it is usable at **100% browser zoom** and feels like a real editor:
- Docked, scrollable, collapsible, resizable tuning panel
- Camera framing tools so users don’t “browser-zoom” to see the animal
- Grouped controls + search + per-control reset + numeric inputs
- Tier A instant apply vs Tier B debounced rebuild
- Presets + Undo/Redo + Export tuning JSON

## Non-Negotiables
- Do NOT introduce a second renderer or blueprint pipeline.
- UI must be screen-space and remain readable regardless of camera zoom.
- Preserve existing Zoo visual parity at default tuning.
- Must not leak meshes/materials during rebuilds or animal switching.

## Ground Rules
- First, locate the existing “studio mode” entrypoint and UI overlay files.
- Implement Phase 1 completely before attempting Phase 2+.
- Prefer minimal dependencies; if a GUI lib exists already, use it only if it doesn’t fight the new layout.

---

## Phase 0 — Repo Recon (Required)
1) Find:
- Studio entrypoint / route / mode switch
- Current tuning panel implementation (the long right-side list)
- Current camera controls / OrbitControls usage
- How animals are mounted/unmounted
- Where `getTuningSchema()`, `getDefaultTuning()`, `applyTuning()`, `rebuild()` live

2) Identify:
- The current DOM container where the studio overlay is injected
- Any CSS file(s) controlling overlay styles

Create a quick map in notes (not committed unless desired):
- “Studio boot path”
- “Tuning panel render path”
- “Camera object + controls”

---

## Phase 1 — Usability Fix (Layout + Camera Framing)
### 1.1 Implement Docked Panel (fixed)
Create/modify a panel component (vanilla or existing UI approach) with:
- `position: fixed; top: 12px; right: 12px; bottom: 12px;`
- `width: clamp(320px, 24vw, 520px);`
- `max-height: calc(100vh - 24px); overflow: auto;`
- Sticky header inside panel:
  - Title
  - Search input (wire later)
  - Collapse button
  - Reset button

Add CSS that guarantees:
- readable font size (>= 13–14px)
- slider hit areas not tiny
- padding and spacing consistent

### 1.2 Collapsed Mode
Implement:
- collapsed boolean state persisted in localStorage
- collapsed UI becomes a small right-edge pill button
- clicking pill expands panel

### 1.3 Resizable Width
Implement:
- a left-edge drag handle (8px wide)
- drag updates panel width in px, clamped between:
  - min 320px
  - max 520px (or 600px on large screens)
- persist width in localStorage

### 1.4 Camera Framing
Implement `frameAnimal()`:
- compute Box3 from the current animal root Object3D
- compute bounding sphere
- set OrbitControls target to sphere center
- set camera distance to fit sphere in view

Suggested math:
- `distance = (radius / Math.sin(fov/2)) * 1.15`
- position camera along current view direction:
  - `dir = camera.position.clone().sub(controls.target).normalize()`
  - `camera.position = target + dir * distance`
- call `controls.update()`

Add:
- Frame button in UI (header or near animal dropdown)
- Hotkey `F` for frame
- Hotkey `R` for reset camera to default studio rig

### 1.5 Responsive Bottom Sheet
If window width < 900px:
- switch panel to bottom sheet layout (fixed bottom, 45vh height)
- ensure it remains scrollable
- collapse still works

**Phase 1 Acceptance**
- 100% browser zoom is usable
- Framing works reliably for elephant and other animals
- Panel readable, scrollable, collapsible, resizable

---

## Phase 2 — “Pro Editor” Controls (Grouping, Search, Precision, Tiering)
### 2.1 Schema Metadata Support
Update schema format to include:
- `group`, `order`, `tier`, `type`, `min/max/step`
- optional: `fineStep`, `unit`, `format`

### 2.2 Grouped Accordions
Render groups:
- sort groups by configured order
- inside each group, sort by `order`
- use collapsible sections with saved open/closed state (localStorage)

### 2.3 Control Rows
For numeric controls:
- slider + numeric input box
- per-control reset button/icon

Interactions:
- holding Shift uses fineStep
- double-click numeric resets

For bool:
- checkbox/toggle with label
For enum:
- dropdown

### 2.4 Search
Wire the header search input:
- filter by label + key + group
- if no match, show “No controls found”

### 2.5 Tier Logic
In the tuning state manager:
- Tier A keys call `animal.applyTuning()` immediately
- Tier B keys trigger debounced `animal.rebuild()` (150–250ms)

Add “Rebuilding…” indicator when rebuild scheduled/in progress.

**Phase 2 Acceptance**
- Controls are navigable and not overwhelming
- Search works
- Tier A feels instant, Tier B stable

---

## Phase 3 — Workflow: Presets + Undo/Redo + Export
### 3.1 Presets
Implement:
- preset name input
- save/load/delete
- persist to localStorage as:
  - `{ speciesId, schemaVersion, tuning, createdAt, updatedAt }`

### 3.2 Undo/Redo
Implement tuning-only history:
- Ctrl+Z / Ctrl+Y
- store snapshots or diffs (snapshots ok first)
- max 50 entries
- applying an undo step respects tier logic (apply vs rebuild)

### 3.3 Export
Add:
- Export tuning JSON
- Export preset bundle JSON
If existing “Export OBJ (debug)” exists, keep it and add adjacent actions.

**Phase 3 Acceptance**
- Presets survive reload
- Undo/redo is reliable
- Export produces stable JSON

---

## Implementation Targets (Expected, Adapt to Repo)
Create a dedicated studio UI folder if it doesn’t exist:
- `src/studio/StudioShell.js`
- `src/studio/StudioPanel.js`
- `src/studio/StudioState.js`
- `src/studio/StudioCamera.js`
- `src/studio/studio.css`

If the repo already has equivalents, modify them instead of duplicating.

---

## Commands
Run whatever the repo uses (likely):
- `npm install`
- `npm run dev`

Verify in browser:
- elephant + cat
- switching animals
- frame/reset
- tier A vs tier B knobs
- preset save/load
- undo/redo
- export json

---

## Final QA Checklist (Do Not Skip)
- [ ] 100% browser zoom usable
- [ ] panel scroll works independently from page
- [ ] collapse/resize persist
- [ ] frame/reset camera works
- [ ] no duplicated helpers on animal switch
- [ ] no console spam during normal use
- [ ] rebuild disposal correct (no accumulating meshes/materials)
- [ ] presets + undo/redo stable

End of Agents.md
