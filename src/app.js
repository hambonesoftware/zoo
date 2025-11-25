// src/app.js

import * as THREE from 'three';
import { createWorld } from './world.js';
import { Zoo } from './zoo/Zoo.js';
import { animalsRegistry, getDiscoveredAnimals } from './animals/registry.js';

function isWebGPUSupported() {
  try {
    if (typeof navigator === 'undefined') return false;
    return !!navigator.gpu;
  } catch (e) {
    return false;
  }
}

function showWebGPURequiredOverlay() {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.getElementById('webgpu-required-overlay');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'webgpu-required-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'radial-gradient(circle at top, #020617, #020617 40%, #000000 100%)',
    color: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '2rem',
    zIndex: '9999',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
  });

  const title = document.createElement('h1');
  title.textContent = 'WebGPU Required';
  title.style.fontSize = 'clamp(1.8rem, 2.8vw, 2.4rem)';
  title.style.letterSpacing = '0.08em';
  title.style.textTransform = 'uppercase';
  title.style.marginBottom = '0.75rem';

  const subtitle = document.createElement('p');
  subtitle.textContent =
    'Zoo Animal Studio now runs on WebGPU for higher-fidelity lighting and shading. ' +
    'Your browser does not appear to support WebGPU.';
  subtitle.style.maxWidth = '40rem';
  subtitle.style.fontSize = '0.95rem';
  subtitle.style.lineHeight = '1.6';
  subtitle.style.opacity = '0.9';
  subtitle.style.marginBottom = '1rem';

  const hint = document.createElement('p');
  hint.innerHTML = [
    '<strong>To continue:</strong>',
    'Use a recent desktop version of Chrome, Edge, or another WebGPU-capable browser,',
    'and ensure that hardware acceleration & WebGPU are enabled in settings/flags.'
  ].join(' ');
  hint.style.maxWidth = '40rem';
  hint.style.fontSize = '0.9rem';
  hint.style.lineHeight = '1.5';
  hint.style.opacity = '0.85';

  overlay.appendChild(title);
  overlay.appendChild(subtitle);
  overlay.appendChild(hint);

  document.body.appendChild(overlay);
}

class App {
  constructor() {
    this.webgpuSupported = isWebGPUSupported();

    if (!this.webgpuSupported) {
      console.error('[Zoo] WebGPU is not available in this environment. Zoo requires WebGPU for rendering.');
      showWebGPURequiredOverlay();
      // Do not create the world or start the render loop.
      return;
    }

    // Create the world (scene, camera, controls, renderer)
    const container = document.body;
    const { scene, camera, controls, renderer } = createWorld(container);

    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.renderer = renderer;

    const defaultAnimalType = 'cat';

    // Create the zoo with a default animal
    this.zoo = new Zoo(this.scene, {
      penCount: 1,
      spacing: 10,
      animalType: defaultAnimalType
    });

    // UI wiring
    this.setupAnimalDropdown(defaultAnimalType);
    this.setupDebugPanel();

    // Bind event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.lastTime = 0;
    this.init();

    // Prevent context menu on right-click over canvas for nicer UX
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  setupAnimalDropdown(defaultAnimalType) {
    const select = document.getElementById('animal-select');
    if (!select) return;

    const animals = getDiscoveredAnimals();

    for (const key of animals) {
      const entry = animalsRegistry[key];
      const option = document.createElement('option');
      option.value = key;
      option.textContent = entry.label ?? key;
      if (key === defaultAnimalType) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const type = select.value;
      this.zoo.setAnimalType(type);
    });
  }

  setupDebugPanel() {
    let panel = document.getElementById('zoo-debug-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'zoo-debug-panel';
      panel.innerHTML = `
        <h4>Zoo Debug</h4>
        <div>Animal: <span class="value" id="zoo-debug-animal">-</span></div>
        <div>Pens: <span class="value" id="zoo-debug-pens">0</span></div>
        <div>Last dt: <span class="value" id="zoo-debug-dt">0.000</span></div>
        <hr />
        <div>Bounds (L×W×H m): <span class="value" id="zoo-debug-bounds">-</span></div>
        <div>Behavior: <span class="value" id="zoo-debug-behavior">-</span></div>
        <div>State time: <span class="value" id="zoo-debug-state-time">0.000</span></div>
      `;
      document.body.appendChild(panel);
    }

    this.debugPanel = panel;
    this.debugFields = {
      animal: document.getElementById('zoo-debug-animal'),
      pens: document.getElementById('zoo-debug-pens'),
      dt: document.getElementById('zoo-debug-dt'),
      bounds: document.getElementById('zoo-debug-bounds'),
      behavior: document.getElementById('zoo-debug-behavior'),
      stateTime: document.getElementById('zoo-debug-state-time')
    };
  }


  async init() {
    // Ensure WebGPU renderer is initialized before starting the main loop.
    if (this.renderer && typeof this.renderer.init === 'function') {
      try {
        await this.renderer.init();
      } catch (error) {
        console.error('[Zoo] Failed to initialize renderer (likely WebGPU unsupported or blocked):', error);
        showWebGPURequiredOverlay();
        return;
      }
    }
    this.animate(0);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate(time) {
    requestAnimationFrame(this.animate.bind(this));

    const dt = (time - this.lastTime) * 0.001;
    this.lastTime = time;

    // Update zoo (pens and animals)
    this.zoo.update(dt);

    // Update controls
    this.controls.update();

    // Render the scene
    this.renderer.render(this.scene, this.camera);

    // Debug info
    if (this.debugFields) {
      const info = this.zoo.getDebugInfo ? this.zoo.getDebugInfo() : {};
      const pensCount = info.penCount ?? (Array.isArray(this.zoo.pens) ? this.zoo.pens.length : 0);

      if (this.debugFields.animal) {
        this.debugFields.animal.textContent = info.animalType || this.zoo.currentAnimalType || 'unknown';
      }
      if (this.debugFields.pens) {
        this.debugFields.pens.textContent = String(pensCount);
      }
      if (this.debugFields.dt) {
        this.debugFields.dt.textContent = dt.toFixed(3);
      }

      if (this.debugFields.bounds) {
        const b = info.bounds;
        this.debugFields.bounds.textContent = b
          ? `${b.x.toFixed(3)} × ${b.z.toFixed(3)} × ${b.y.toFixed(3)}`
          : '-';
      }

      if (this.debugFields.behavior) {
        const beh = info.behavior;
        this.debugFields.behavior.textContent = beh && beh.state ? beh.state : '-';
      }

      if (this.debugFields.stateTime) {
        const beh = info.behavior;
        const t = beh && typeof beh.time === 'number' ? beh.time : 0;
        this.debugFields.stateTime.textContent = t.toFixed(3);
      }
    }
  }
}

// Create and start the app
new App();
