// src/app.js

import { createWorld } from './world.js';
import { AnimalRegistry, getRegisteredAnimals } from './animals/AnimalRegistry.js';
import { SoundFontEngine } from './audio/SoundFontEngine.js';
import { TheoryEngine } from './music/TheoryEngine.js';
import { AnimalMusicBrain } from './music/AnimalMusicBrain.js';
import { MUSIC_PROFILES, getProfileForAnimal } from './music/MusicProfiles.js';
import { MusicEngine } from './music/MusicEngine.js';
import { NoteHighway } from './ui/NoteHighway.js';
import { downloadAsOBJ } from './debug/exporters.js';
import { TuningPanel } from './ui/TuningPanel.js';

function isWebGPUSupported() {
  try {
    if (typeof navigator === 'undefined') return false;
    return !!navigator.gpu;
  } catch (e) {
    return false;
  }
}

class App {
  constructor() {
    this.webgpuSupported = isWebGPUSupported();

    if (!this.webgpuSupported) {
      console.warn('[Zoo] WebGPU is not available; falling back to WebGL renderer.');
    }

    // Create the world (scene, camera, controls, renderer)
    const container = document.body;
    const defaultAnimalType = 'cat';
    this.currentAnimalType = defaultAnimalType;
    this.world = createWorld(container, {
      preferWebGPU: this.webgpuSupported,
      defaultAnimal: defaultAnimalType
    });

    this.scene = this.world.scene;
    this.camera = this.world.camera;
    this.controls = this.world.controls;
    this.renderer = this.world.renderer;

    // Audio + music subsystems
    this.soundFontEngine = new SoundFontEngine();
    this.theoryEngine = new TheoryEngine();
    this.noteHighway = new NoteHighway(this.soundFontEngine.getAudioContext());
    this.musicEngine = new MusicEngine({
      soundFontEngine: this.soundFontEngine,
      theoryEngine: this.theoryEngine,
      noteHighway: this.noteHighway
    });
    this.audioReady = false;
    this.setupAudioBootstrap();

    // UI wiring
    this.setupAnimalDropdown(defaultAnimalType);
    this.setupTuningPanel(defaultAnimalType);
    this.setupDebugPanel();
    this.setupExportHooks();

    // Bind event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.lastTime = 0;
    this.init();

    // Prevent context menu on right-click over canvas for nicer UX
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  async setupAudioBootstrap() {
    const handler = async () => {
      if (this.audioReady) return;
      try {
        await this.soundFontEngine.resumeContext();
        await this.soundFontEngine.loadSoundFont('/audio/general.sf2');
        this.configureMusicBrains();
        this.audioReady = true;

        // Expose for quick console testing
        window.soundFontEngine = this.soundFontEngine;
        window.musicEngine = this.musicEngine;
      } catch (error) {
        console.error('[Zoo] Failed to initialize audio pipeline:', error);
      }
    };

    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
  }

  configureMusicBrains() {
    const catProfile = getProfileForAnimal('cat') || MUSIC_PROFILES.CatCreature;
    const elephantProfile = getProfileForAnimal('elephant') || MUSIC_PROFILES.ElephantCreature;

    if (catProfile) {
      const catBrain = new AnimalMusicBrain(catProfile);
      this.musicEngine.registerAnimalBrain('cat', catBrain);
      this.soundFontEngine.assignChannelForAnimal('cat', 0);
      this.soundFontEngine.setInstrumentForAnimal('cat', catProfile.programNumber);
    }

    if (elephantProfile) {
      const elephantBrain = new AnimalMusicBrain(elephantProfile);
      this.musicEngine.registerAnimalBrain('elephant', elephantBrain);
      this.soundFontEngine.assignChannelForAnimal('elephant', 1);
      this.soundFontEngine.setInstrumentForAnimal('elephant', elephantProfile.programNumber);
    }
  }

  setupAnimalDropdown(defaultAnimalType) {
    const select = document.getElementById('animal-select');
    if (!select) return;

    const animals = getRegisteredAnimals();

    for (const key of animals) {
      const entry = AnimalRegistry[key];
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
      this.currentAnimalType = type;
      this.world.setAnimalType(type);
      this.syncTuningPanel(type);
    });
  }

  setupTuningPanel(defaultAnimalType) {
    this.tuningPanel = new TuningPanel({
      onTuningChange: (patch) => {
        this.world.applyTuning(patch);
      },
      onReset: () => {
        const module = AnimalRegistry[this.currentAnimalType];
        if (!module) return;
        const defaults = module.getDefaultTuning ? module.getDefaultTuning() : {};
        this.world.setAnimalType(this.currentAnimalType, defaults);
        this.tuningPanel.setSchema(module.getTuningSchema?.() || {}, defaults, this.currentAnimalType);
      },
      onPresetLoad: (values) => {
        this.world.setAnimalType(this.currentAnimalType, values);
        const module = AnimalRegistry[this.currentAnimalType];
        const schema = module?.getTuningSchema ? module.getTuningSchema() : {};
        this.tuningPanel.setSchema(schema, values, this.currentAnimalType);
      }
    });

    this.syncTuningPanel(defaultAnimalType);
  }

  syncTuningPanel(animalType) {
    if (!this.tuningPanel) return;
    const module = AnimalRegistry[animalType];
    if (!module) return;
    const schema = module.getTuningSchema ? module.getTuningSchema() : {};
    const info = this.world.getDebugInfo ? this.world.getDebugInfo() : {};
    const current = info.tuning || (module.getDefaultTuning ? module.getDefaultTuning() : {});
    this.tuningPanel.setSchema(schema, current, animalType);
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
        <button id="zoo-debug-export-obj" type="button">Export OBJ (debug)</button>
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

    this.debugExportButton = document.getElementById('zoo-debug-export-obj');
  }

  setupExportHooks() {
    // Debug-only OBJ export shortcut.
    this._exportKeyHandler = (event) => {
      if (event.key === 'O') {
        console.info('[Zoo] Debug OBJ export triggered via keyboard.');
        exportCurrentPenAsOBJ(this);
      }
    };

    window.addEventListener('keydown', this._exportKeyHandler);

    if (this.debugExportButton) {
      this.debugExportButton.addEventListener('click', () => {
        console.info('[Zoo] Debug OBJ export button clicked.');
        exportCurrentPenAsOBJ(this);
      });
      console.info('[Zoo] Debug OBJ export button initialized.');
    }
  }


  async init() {
    // Ensure WebGPU renderer is initialized before starting the main loop.
    if (this.renderer && typeof this.renderer.init === 'function') {
      try {
        await this.renderer.init();
      } catch (error) {
        console.warn('[Zoo] WebGPU renderer failed to initialize; rebuilding world with WebGL.', error);
        const fallback = createWorld(document.body, {
          preferWebGPU: false,
          defaultAnimal: 'cat'
        });
        this.world = fallback;
        this.scene = fallback.scene;
        this.camera = fallback.camera;
        this.controls = fallback.controls;
        this.renderer = fallback.renderer;
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

    // Update active pen + animal
    if (this.world && typeof this.world.update === 'function') {
      this.world.update(dt);
    }

    // Update controls
    this.controls.update();

    // Render the scene
    this.renderer.render(this.scene, this.camera);

    if (this.audioReady && this.musicEngine && this.soundFontEngine) {
      const audioCtx = this.soundFontEngine.getAudioContext();
      this.musicEngine.update(audioCtx.currentTime);
    }

    // Debug info
    if (this.debugFields) {
      const info = this.world && this.world.getDebugInfo ? this.world.getDebugInfo() : {};
      const pensCount = info.penCount ?? 1;

      if (this.debugFields.animal) {
        this.debugFields.animal.textContent = info.animalType || 'unknown';
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

export function exportCurrentPenAsOBJ(app) {
  const world = app ? app.world : null;

  if (!world) {
    console.warn('[Zoo] Cannot export OBJ: world instance missing on app.');
    return;
  }

  const info = world.getDebugInfo ? world.getDebugInfo() : {};

  console.info('[Zoo] Attempting OBJ export for current pen.', {
    animalType: info.animalType,
    penCount: info.penCount
  });

  const pen = typeof world.getActivePen === 'function' ? world.getActivePen() : null;

  if (!pen || typeof pen.getExportRoot !== 'function') {
    console.warn('[Zoo] No exportable pen or getExportRoot() not implemented.');
    return;
  }

  const root = pen.getExportRoot();
  if (!root) {
    console.warn('[Zoo] Pen returned no export root.');
    return;
  }

  const animalType = info.animalType || null;
  const registryEntry = animalType ? AnimalRegistry[animalType] : null;
  const label = pen.label || (registryEntry ? registryEntry.label : null) || animalType || 'animal';
  const safeLabel = label.toString().trim().toLowerCase().replace(/\s+/g, '_');
  const filename = `${safeLabel || 'animal'}_highpoly.obj`;

  console.info('[Zoo] Exporting OBJ with filename:', filename);
  downloadAsOBJ(root, filename);
}

// Create and start the app
new App();
