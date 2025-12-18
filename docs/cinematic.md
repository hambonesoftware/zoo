# Cinematic vs Fast Render Modes

Zoo now centralizes render configuration so you can switch between the default fast path and a higher quality cinematic path without touching gameplay logic.

## How to toggle
- **Query string:** append `?cinematic=1` to the URL to force cinematic mode. Use `?cinematic=0` to force fast mode.
- **Runtime flag:** set `window.ZOO_CINEMATIC = true` (or `false`) **before** the app boots to override the default.

Both toggles feed into the same resolver, so the query string takes priority and falls back to `window.ZOO_CINEMATIC` when absent.

## Where the settings live
- `src/render/renderMode.js` handles the toggle resolver (query string, `window.ZOO_CINEMATIC`, defaults).
- `src/render/rendererConfig.js` centralizes per-mode renderer quality settings (antialiasing sample count, tone mapping, output buffer type, pixel ratio caps, and shadow quality helpers).
- `src/world.js` consumes the helpers to build the renderer, apply the mode-specific settings, and log diagnostics.

## What the modes change (Phase 2 baseline)
- **Color & tone mapping:** ACESFilmic tone mapping and SRGB output color space in both modes, with a slightly brighter exposure in Cinematic.
- **HDR output buffer:** requests `HalfFloatType` output buffers for WebGPU so highlights retain range before tone mapping.
- **Antialiasing samples:** Fast uses `sampleCount: 1`; Cinematic bumps to `4` for smoother edges on WebGPU.
- **DPR caps:** Fast clamps `devicePixelRatio` to `<= 1.5`; Cinematic clamps to `<= 2.0` to avoid runaway pixel counts.
- **Shadows:** Shadows stay enabled; the key light's shadow map grows from 1024 (Fast) to 2048 (Cinematic) with tuned bias/normalBias to reduce acne.

## Cinematic post stack (Phase 3)
- **WebGPU-only:** The post pipeline only attaches in Cinematic mode when WebGPU is active; Fast mode renders directly.
- **Bloom:** Subtle highlight bloom is added via a bright-pass extraction + separable blur (half resolution) + composite back into the scene. Tuned defaults live in `src/render/CinematicPost.js`.
- **Resizing:** Post-processing render targets resize with the window using the same pixel ratio caps applied during renderer setup.

## Faceted hero look (Phase 4)
- **Lighting rig:** Cinematic mode swaps to a tuned key/fill/rim rig (`src/render/LightingRig.js`) with warmer key and cooler fill/rim colors plus PMREM-based studio environment reflections.
- **Hero materials:** A centralized material pass (`src/render/HeroMaterialProfiles.js`) lightly boosts body spec/roughness, emphasizes eyes, and preserves flat-shaded facets so the low-poly look stays intentional.
- **Environment reflections:** A gradient PMREM environment is applied in Cinematic mode for cleaner specular highlights without changing gameplay lighting.

## Diagnostics
On startup, the renderer logs a one-time diagnostics object to the console (mode, renderer type, sample count, tone mapping, exposure, output color space, output buffer type, shadow settings, and pixel ratio) to make A/B comparisons straightforward.
