// src/world.js

import * as THREE from '../libs/three.module.js';
import { WebGPURenderer } from '../libs/three.webgpu.js';
import { OrbitControls } from '../libs/OrbitControls.js';
import { AnimalStudioPen } from './pens/AnimalStudioPen.js';
import { AnimalRegistry } from './animals/AnimalRegistry.js';
import { RENDER_MODES, isCinematic, resolveRenderMode } from './render/renderMode.js';
import {
  applyRendererConfig,
  applyRendererSize,
  getRendererOptionsForMode,
  logRendererDiagnostics
} from './render/rendererConfig.js';
import { CinematicPost } from './render/CinematicPost.js';

function createRenderer(canvas, preferWebGPU, rendererOptions = {}) {
  let renderer = null;
  const { antialias = true, sampleCount = 1 } = rendererOptions;

  if (preferWebGPU) {
    try {
      renderer = new WebGPURenderer({ canvas, antialias, sampleCount });
    } catch (error) {
      console.warn('[Zoo] Falling back to WebGLRenderer because WebGPU init failed:', error);
    }
  }

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias });
  }

  return renderer;
}

function createCanvas(canvasContainer) {
  const existingCanvas = document.querySelector('#zoo-canvas');
  if (existingCanvas) return existingCanvas;

  const canvas = document.createElement('canvas');
  canvas.id = 'zoo-canvas';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvasContainer.appendChild(canvas);
  return canvas;
}

export function createWorld(
  canvasContainer,
  { preferWebGPU = true, defaultAnimal = 'cat', soundFontEngine = null, renderMode: initialRenderMode = null } = {}
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8ecef);

  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.05, 1000);
  camera.position.set(7.5, 7.5, 7.5);
  camera.lookAt(0, 1, 0);

  const canvas = createCanvas(canvasContainer);
  const renderMode = initialRenderMode || resolveRenderMode({ defaultMode: RENDER_MODES.FAST });
  const rendererOptions = getRendererOptionsForMode(renderMode);
  const renderer = createRenderer(canvas, preferWebGPU, rendererOptions);
  const rendererSettings = applyRendererConfig(renderer, renderMode);
  logRendererDiagnostics(renderer, renderMode, { ...rendererOptions, ...rendererSettings });
  window.ZOO_RENDER_MODE = renderMode;

  const post = isCinematic(renderMode) && renderer.isWebGPURenderer
    ? new CinematicPost(renderer, scene, camera, { bloom: { strength: 0.35, threshold: 1.0, radius: 0.85 } })
    : null;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.dampingFactor = 0.1;
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);
  controls.minDistance = 0.5;
  controls.maxDistance = 25;
  controls.update();

  const defaultCameraState = {
    position: camera.position.clone(),
    target: controls.target.clone()
  };

  const pen = new AnimalStudioPen(scene, {
    shadowMapSize: rendererSettings.shadowMapSize,
    shadowBias: rendererSettings.shadowBias,
    shadowNormalBias: rendererSettings.shadowNormalBias,
    renderer,
    renderMode
  });

  let activeAnimal = null;
  let activeAnimalId = null;
  let activeModule = null;
  let currentTuning = null;
  let rebuildTimer = null;
  const REBUILD_DEBOUNCE_MS = 180;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    applyRendererSize(renderer, renderMode);
    post?.setSize(window.innerWidth, window.innerHeight);
  });

  function setView(name) {
    const d = 8;
    let pos = { x: d, y: d, z: d };
    switch (name) {
      case 'front':
        pos = { x: 0, y: 1, z: d };
        break;
      case 'back':
        pos = { x: 0, y: 1, z: -d };
        break;
      case 'left':
        pos = { x: -d, y: 1, z: 0 };
        break;
      case 'right':
        pos = { x: d, y: 1, z: 0 };
        break;
      case 'top':
        pos = { x: 0, y: d + 1, z: 0 };
        break;
      case 'bottom':
        pos = { x: 0, y: -d + 1, z: 0 };
        break;
      case 'iso':
      default:
        pos = { x: d, y: d, z: d };
        break;
    }
    controls.target.set(0, 1, 0);
    controls.update();
    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(0, 1, 0);
    controls.update();
  }

  window.setAnimalStudioView = setView;

  function unmountCurrent() {
    if (pen) pen.unmountAnimal();
    if (activeAnimal && typeof activeAnimal.dispose === 'function') {
      activeAnimal.dispose();
    }
    activeAnimal = null;
    activeModule = null;
    activeAnimalId = null;
  }

  function setAnimalType(animalId, tuningOverrides = {}) {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
      rebuildTimer = null;
    }
    const module = AnimalRegistry[animalId];
    if (!module) {
      console.warn(`[Zoo] Unknown animal module '${animalId}'`);
      return null;
    }

    const defaults = module.getDefaultTuning ? module.getDefaultTuning() : {};
    currentTuning = { ...defaults, ...tuningOverrides };

    const instance = module.build({ renderer, scene, tuning: currentTuning, soundFontEngine });
    if (!instance) {
      console.warn(`[Zoo] Failed to build animal '${animalId}'`);
      return null;
    }

    unmountCurrent();
    activeAnimal = instance;
    activeAnimalId = animalId;
    activeModule = module;
    pen.mountAnimal(instance);
    return instance;
  }

  function applyImmediateTuning(tuningPatch = {}) {
    if (!activeModule || !activeAnimal) return;
    currentTuning = { ...currentTuning, ...tuningPatch };
    if (typeof activeModule.applyTuning === 'function') {
      activeModule.applyTuning(activeAnimal, currentTuning);
    }
  }

  function scheduleRebuild(tuning = {}, onRebuilt) {
    if (!activeModule || !activeAnimal) {
      onRebuilt?.();
      return;
    }
    currentTuning = { ...currentTuning, ...tuning };
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
    }

    rebuildTimer = setTimeout(() => {
      rebuildTimer = null;
      if (typeof activeModule.rebuild === 'function') {
        const rebuilt = activeModule.rebuild({ renderer, scene, tuning: currentTuning, existing: activeAnimal, soundFontEngine });
        if (rebuilt) {
          activeAnimal = rebuilt;
          pen.mountAnimal(rebuilt);
        }
      } else if (typeof activeModule.applyTuning === 'function') {
        activeModule.applyTuning(activeAnimal, currentTuning);
      }
      onRebuilt?.();
    }, REBUILD_DEBOUNCE_MS);
  }

  function applyTuning(tuningPatch = {}) {
    if (!activeModule || !activeAnimal) return;
    currentTuning = { ...currentTuning, ...tuningPatch };
    const keys = Object.keys(tuningPatch);
    const wantsRebuild =
      typeof activeModule.shouldRebuildOnChange === 'function' &&
      keys.some((key) => activeModule.shouldRebuildOnChange(key));

    if (wantsRebuild) {
      scheduleRebuild({}, undefined);
      return;
    }

    applyImmediateTuning({});
  }

  function frameAnimal() {
    if (!pen || !pen.animalRoot) return;
    const box = new THREE.Box3().setFromObject(pen.animalRoot);
    if (box.isEmpty()) return;

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const target = sphere.center;
    const radius = sphere.radius || 1;
    const fov = camera.fov * (Math.PI / 180);
    const distance = (radius / Math.sin(fov / 2)) * 1.15;

    const viewDir = camera.position.clone().sub(controls.target);
    if (viewDir.lengthSq() === 0) {
      viewDir.set(1, 0.35, 1);
    }
    viewDir.normalize();

    const newPosition = target.clone().add(viewDir.multiplyScalar(distance));
    camera.position.copy(newPosition);
    controls.target.copy(target);
    camera.near = Math.max(0.05, distance * 0.02);
    camera.far = Math.max(camera.far, distance * 10);
    camera.updateProjectionMatrix();
    controls.update();
  }

  function resetCamera() {
    camera.position.copy(defaultCameraState.position);
    controls.target.copy(defaultCameraState.target);
    camera.lookAt(controls.target);
    controls.update();
  }

  function getDebugInfo() {
    const info = {
      animalType: activeAnimalId,
      penCount: 1,
      behavior: null,
      bounds: null,
      tuning: currentTuning
    };

    if (pen && pen.animalRoot) {
      const box = new THREE.Box3().setFromObject(pen.animalRoot);
      if (!box.isEmpty()) {
        const size = new THREE.Vector3();
        box.getSize(size);
        info.bounds = { x: size.x, y: size.y, z: size.z };
      }
    }

    if (activeAnimal && activeAnimal.root && activeAnimal.root.behavior) {
      info.behavior = activeAnimal.root.behavior;
    }
    info.debugBlend = activeAnimal?.root?.debugBlend ?? null;

    return info;
  }

  function update(dt) {
    pen.update(dt);
  }

  function renderFrame() {
    if (post) {
      post.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  setAnimalType(defaultAnimal);

  return {
    scene,
    camera,
    controls,
    renderer,
    pen,
    setAnimalType,
    applyTuning,
    applyImmediateTuning,
    scheduleRebuild,
    update,
    renderFrame,
    getDebugInfo,
    getActivePen: () => pen,
    getActiveAnimal: () => activeAnimal,
    frameAnimal,
    resetCamera
  };
}
