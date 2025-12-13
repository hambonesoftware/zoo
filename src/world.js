// src/world.js

import * as THREE from '../libs/three.module.js';
import { WebGPURenderer } from '../libs/three.webgpu.js';
import { OrbitControls } from '../libs/OrbitControls.js';
import { AnimalStudioPen } from './pens/AnimalStudioPen.js';
import { AnimalRegistry } from './animals/AnimalRegistry.js';

function createRenderer(canvas, preferWebGPU) {
  let renderer = null;

  if (preferWebGPU) {
    try {
      renderer = new WebGPURenderer({ canvas, antialias: true });
    } catch (error) {
      console.warn('[Zoo] Falling back to WebGLRenderer because WebGPU init failed:', error);
    }
  }

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

export function createWorld(canvasContainer, { preferWebGPU = true, defaultAnimal = 'cat' } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8ecef);

  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.05, 1000);
  camera.position.set(7.5, 7.5, 7.5);
  camera.lookAt(0, 1, 0);

  const canvas = createCanvas(canvasContainer);
  const renderer = createRenderer(canvas, preferWebGPU);

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

  const pen = new AnimalStudioPen(scene, {});

  let activeAnimal = null;
  let activeAnimalId = null;
  let activeModule = null;
  let currentTuning = null;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    const module = AnimalRegistry[animalId];
    if (!module) {
      console.warn(`[Zoo] Unknown animal module '${animalId}'`);
      return null;
    }

    const defaults = module.getDefaultTuning ? module.getDefaultTuning() : {};
    currentTuning = { ...defaults, ...tuningOverrides };

    const instance = module.build({ renderer, scene, tuning: currentTuning });
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

  function applyTuning(tuningPatch = {}) {
    if (!activeModule || !activeAnimal) return;
    currentTuning = { ...currentTuning, ...tuningPatch };

    if (typeof activeModule.applyTuning === 'function') {
      activeModule.applyTuning(activeAnimal, currentTuning);
    } else if (typeof activeModule.rebuild === 'function') {
      const rebuilt = activeModule.rebuild({ renderer, scene, tuning: currentTuning });
      if (rebuilt) {
        activeAnimal = rebuilt;
        pen.mountAnimal(rebuilt);
      }
    }
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

    return info;
  }

  function update(dt) {
    pen.update(dt);
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
    update,
    getDebugInfo,
    getActivePen: () => pen,
    getActiveAnimal: () => activeAnimal
  };
}
