# Zoo Animal Studio (WebGPU)

This is the WebGPU-only build of the 3D Zoo / Zoo Animal Studio project. It uses:

- **Three.js** for 3D rendering
- **WebGPURenderer** as the only renderer
- **Node-based materials (TSL)** for the elephant skin, plus PBR materials for the studio and cat

The scene is set up as an animal development studio with:

- A precision pen for the cat (CatPen)
- A precision pen for the elephant (ElephantPen)
- Labeled axes, grids, and corner studio walls for visual measurement and debugging

## Version

- Package version: `1.7.4-webgpu`
- Plan: corresponds to `plan_webgpu` **Phase 4 – Test, Tune, and Package v1.8**
- Archive name: `zooV1.7.4.zip`

## WebGPU requirement

This build **requires WebGPU**. The renderer is created with `WebGPURenderer` and there is **no WebGL fallback**.

At startup:

- If `navigator.gpu` is available, the app creates the world and starts the Zoo.
- If WebGPU is missing or blocked, the app:
  - Logs an error to the console
  - Shows a full-screen **“WebGPU Required”** overlay
  - Does **not** attempt to start the render loop

See [`WEBGPU_NOTES.md`](./WEBGPU_NOTES.md) for browser and platform details.

## Getting started (development)

From the project root:

```bash
npm install
npm run dev
```

Then open the printed URL in a **WebGPU-capable desktop browser**.

During development you should see:

- The corner studio with measurement visuals
- The currently selected animal (default: cat) in its pen
- A debug panel with basic information about pens, bounds, and behavior

## Studio controls

- The tuning panel is collapsible and grouped by accordion headers so you can quickly hide whole sections (Global, Skeleton, Torso, Trunk, Tusks, Legs, Materials, Debug).
- Frame the current animal with **F** and reset the studio camera with **R**; both shortcuts mirror the header buttons.
- Elephant-specific tuning now exposes tusk length scaling, trunk base offsets (XYZ), and torso ring density/radius/bulge controls; defaults match the original look and Tier B changes rebuild after the debounce.

## Production build

To create a production build:

```bash
npm run build
```

This runs the Vite build pipeline and outputs a bundled app into `dist/`.

Optionally, you can preview the production build locally:

```bash
npm run preview
```

## Overlay behavior

In a WebGPU-capable browser:

- No overlay should appear.
- The Zoo scene should render and animate normally.

In a non-WebGPU or WebGPU-disabled environment:

- The **“WebGPU Required”** overlay appears.
- No renderer is instantiated and no animation loop is started.

The overlay text and behavior are implemented in `src/app.js` via:

- `isWebGPUSupported()`
- `showWebGPURequiredOverlay()`
- The `App` constructor and `init()` path, which guard renderer creation and animation.

## File layout (top-level)

- `index.html` – entry HTML file, sets up the import map and bootstrap for `src/app.js`.
- `package.json` – scripts and dependencies (Three.js, cannon-es, Vite).
- `src/app.js` – app entry point and WebGPU guard/overlay.
- `src/world.js` – focused animal studio scene using `WebGPURenderer`.
- `src/worldreal.js` – larger zoo/park world using `WebGPURenderer`.
- `src/animals/*` – animal registry, generators, behavior, and pens.
- `WEBGPU_NOTES.md` – extra notes about WebGPU support and testing.

