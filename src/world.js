// src/world.js

// Use your local libs
import * as THREE from '../libs/three.module.js';
import { WebGPURenderer } from '../libs/three.webgpu.js';
import { OrbitControls } from '../libs/OrbitControls.js';

/**
 * Creates a focused, minimal scene for animal/model creation studio.
 * Returns scene, camera, controls, renderer, and view-snapping helpers.
 * @param {HTMLElement} canvasContainer
 */
export function createWorld(canvasContainer) {
  // --- 1. Scene and neutral background ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8ecef);

  // --- 2. Ground Grid ---
  const grid = new THREE.GridHelper(20, 20, 0xcccccc, 0xffffff);
  grid.position.y = 0;
  scene.add(grid);

  // --- 3. Axes Helper ---
  const axes = new THREE.AxesHelper(2.5);
  scene.add(axes);

  // --- 4. Lighting ---
  // Soft key/fill setup so no side is too dark
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 0.75);
  hemi.position.set(0, 8, 0);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(6, 7, 5);
  key.castShadow = true;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xbbe7ff, 0.5);
  rim.position.set(-6, 5, -8);
  scene.add(rim);

  // --- 5. Camera (Perspective, centered, isometric default) ---
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(54, aspect, 0.1, 100);
  // ISO view: 3/4 angle, slightly above
  camera.position.set(7.5, 7.5, 7.5);
  camera.lookAt(0, 1, 0);

  // --- 6. Renderer (WebGPU) ---
  // Use a dedicated canvas element so WebGPU can own its context cleanly.
  const existingCanvas = document.querySelector('#zoo-canvas');
  const canvas = existingCanvas || (() => {
    const c = document.createElement('canvas');
    c.id = 'zoo-canvas';
    c.style.display = 'block';
    c.style.width = '100%';
    c.style.height = '100%';
    canvasContainer.appendChild(c);
    return c;
  })();

  const renderer = new WebGPURenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;


  // --- 7. Controls ---
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.dampingFactor = 0.10;
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);
  controls.minDistance = 3;
  controls.maxDistance = 40;
  controls.update();

  // --- 8. Responsive Resize ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- 9. View Snapping Helpers ---
  // Each function smoothly moves to a classic view (use in UI or debug console)
  function setView(name) {
    // All views focus on the world origin (0,1,0), assumed animal base at Y=1
    const d = 8; // distance
    let pos = { x: 0, y: 0, z: 0 };
    switch (name) {
      case 'front':   pos = { x: 0,    y: 1,  z: d }; break;
      case 'back':    pos = { x: 0,    y: 1,  z: -d }; break;
      case 'left':    pos = { x: -d,   y: 1,  z: 0 }; break;
      case 'right':   pos = { x: d,    y: 1,  z: 0 }; break;
      case 'top':     pos = { x: 0,    y: d+1, z: 0 }; break;
      case 'bottom':  pos = { x: 0,    y: -d+1, z: 0 }; break;
      case 'iso':     pos = { x: d,    y: d,  z: d }; break;
      default:        pos = { x: d,    y: d,  z: d };
    }
    // Optional: smooth transition (instead of instant jump)
    controls.target.set(0, 1, 0);
    controls.update();
    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(0, 1, 0);
    controls.update();
  }

  // Optionally expose helpers to window for live console control:
  window.setAnimalStudioView = setView;

  // --- 10. Return studio context ---
  return { scene, camera, controls, renderer, setView };
}
