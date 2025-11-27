# Elephant OBJ Export Verification

Steps taken to verify that the live app can export the elephant pen to OBJ:

1. Started the dev server with `npm run dev -- --host --port 4173`.
2. Opened the app in Playwright (Chromium), selected **Elephant** from the animal dropdown, and clicked **Export OBJ (debug)**.
3. Captured the resulting download and screenshot for reference.

Resulting console output from the Playwright run:

```
console: debug [vite] connecting...
console: debug [vite] connected.
console: warning WARNING: Multiple instances of Three.js being imported.
console: info WebGPU is experimental on this platform. See https://github.com/gpuweb/gpuweb/wiki/Implementation-Status#implementation-status
console: warning Failed to create WebGPU Context Provider
console: warning THREE.WebGPURenderer: WebGPU is not available, running under WebGL2 backend.
console: warning LightsNode.setupNodeLights: Light node not found for HemisphereLight
console: warning LightsNode.setupNodeLights: Light node not found for AmbientLight
console: warning LightsNode.setupNodeLights: Light node not found for DirectionalLight
console: warning LightsNode.setupNodeLights: Light node not found for DirectionalLight
console: warning LightsNode.setupNodeLights: Light node not found for DirectionalLight
console: warning [GroupMarkerNotSet(crbug.com/242999)!:A070200024320000]Automatic fallback to software WebGL has been deprecated. Please use the --enable-unsafe-swiftshader (about:flags#enable-unsafe-swiftshader) flag to opt in to lower security guarantees for trusted content.
console: warning [.WebGL-0x1bfc02bbb100]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
console: warning [.WebGL-0x1bfc02bbb100]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
console: warning LightsNode.setupNodeLights: Light node not found for HemisphereLight
console: warning LightsNode.setupNodeLights: Light node not found for AmbientLight
console: warning LightsNode.setupNodeLights: Light node not found for DirectionalLight
console: warning LightsNode.setupNodeLights: Light node not found for DirectionalLight
console: warning LightsNode.setupNodeLights: Light node not found for DirectionalLight
console: warning [.WebGL-0x1bfc02bbb100]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
console: warning [.WebGL-0x1bfc02bbb100]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat)
console: log [downloadAsOBJ] Exported OBJ: elephant_highpoly.obj
Saved OBJ to artifacts/elephant_highpoly.obj
Screenshot at artifacts/elephant-export.png
```

Artifacts saved by the Playwright run:

- `artifacts/elephant_highpoly.obj` — exported OBJ file.
- `artifacts/elephant-export.png` — screenshot of the running app after the export.

These artifacts are available from the Playwright run output and confirm the export pipeline worked while the app was running.
