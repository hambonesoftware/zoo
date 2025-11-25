# WEBGPU_NOTES

This document summarizes how the Zoo Animal Studio build uses WebGPU and what you need to run it.

## Renderer and color pipeline

- The project uses **Three.js `WebGPURenderer`** everywhere.
- There is **no WebGLRenderer** in this build.
- Color management is configured as:
  - `renderer.outputColorSpace = THREE.SRGBColorSpace`
  - `renderer.toneMapping = THREE.ACESFilmicToneMapping`
  - `renderer.toneMappingExposure = 1.0` (tweakable in `src/world.js` and `src/worldreal.js` if you want the scene brighter or darker).

Materials are aligned for WebGPU:

- Elephant uses a **node-based MeshStandard material (TSL)** with an sRGB canvas texture.
- The cat uses a `MeshStandardMaterial` with an sRGB fur texture.
- Studio and pen elements (walls, pads, labels, debug textures) use PBR materials or sprite materials with sRGB textures.

## WebGPU feature detection

Feature detection happens in `src/app.js`:

```js
function isWebGPUSupported() {
  try {
    if (typeof navigator === 'undefined') return false;
    return !!navigator.gpu;
  } catch (e) {
    return false;
  }
}
```

The `App` constructor calls this function and:

- If WebGPU **is not** supported:
  - Logs a console error.
  - Calls `showWebGPURequiredOverlay()`.
  - Returns early before creating the world or starting the animation loop.
- If WebGPU **is** supported:
  - Creates the world via `createWorld(...)`.
  - Calls `await renderer.init()` in `init()` before starting `animate()`.

If `renderer.init()` throws (for example if WebGPU is nominally present but blocked by the OS/driver), the error is logged and the overlay is shown.

## “WebGPU Required” overlay

The unsupported-browser overlay is created in `showWebGPURequiredOverlay()`:

- It uses a fixed-position `<div>` covering the viewport.
- Background: a dark radial gradient to keep focus on the message.
- Content:
  - Title: “WebGPU Required”.
  - Subtitle explaining that Zoo Animal Studio now runs on WebGPU.
  - Hint text suggesting a WebGPU-capable browser and enabling hardware acceleration/WebGPU flags.

This matches the behavior described in `plan_webgpu/Phase2_WebGPU_Only_Guardrail.md` and Phase 4 documentation.

## Recommended browsers

This build is intended for **desktop** browsers with WebGPU enabled, for example:

- Recent **Chrome** on Windows, macOS, or Linux.
- Recent **Edge** on Windows.
- Other Chromium-based browsers that expose `navigator.gpu`.

WebGPU support is still evolving. If you do not see the scene:

1. Check `chrome://flags` or equivalent:
   - Ensure WebGPU is enabled.
   - Ensure hardware acceleration is turned on.
2. Make sure you are not in a restricted environment (remote desktop, virtual machine, or disabled GPU drivers) that blocks WebGPU.
3. Check the developer console for the `[Zoo]` logs.

## Quick test checklist

When validating a new environment:

1. Run `npm install` and `npm run dev`.
2. Open the app in a recent desktop Chrome/Edge.
3. Confirm:
   - No WebGPU overlay appears.
   - The corner studio and animal pens render correctly.
   - The cat (default) animates in its pen.
   - The debug panel shows non-zero pen counts and updates over time.

If any of these fail, the issue is likely environmental (browser/driver/flags). The code assumes a working WebGPU implementation and will refuse to run without it.

