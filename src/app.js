// src/app.js

import { createWorld } from './world.js';
import { AnimalRegistry, getRegisteredAnimals } from './animals/AnimalRegistry.js';
import { SoundFontEngine } from './audio/SoundFontEngine.js';
import { TheoryEngine } from './music/TheoryEngine.js';
import { MusicEngine } from './music/MusicEngine.js';
import { AnimalMusicBrain } from './music/AnimalMusicBrain.js';
import { MIDI_CHANNEL_ASSIGNMENTS, getProfileForAnimal } from './music/MusicProfiles.js';
import { NoteHighway } from './ui/NoteHighway.js';
import { downloadAsJSON, downloadAsOBJ } from './debug/exporters.js';
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

    // Audio + music subsystems
    this.soundFontEngine = new SoundFontEngine();
    this.theoryEngine = new TheoryEngine();
    this.noteHighway = new NoteHighway(this.soundFontEngine.getAudioContext());
    this.musicEngine = new MusicEngine({
      soundFontEngine: this.soundFontEngine,
      theoryEngine: this.theoryEngine,
      noteHighway: this.noteHighway
    });

    // Create the world (scene, camera, controls, renderer)
    const container = document.body;
    const defaultAnimalType = 'cat';
    this.currentAnimalType = defaultAnimalType;
    this.world = createWorld(container, {
      preferWebGPU: this.webgpuSupported,
      defaultAnimal: defaultAnimalType,
      soundFontEngine: this.soundFontEngine
    });

    this.currentTuning = {};
    this.currentSchema = {};
    this.tuningHistory = { past: [], future: [], limit: 50 };
    this.schemaVersion = '1.0.0';

    this.scene = this.world.scene;
    this.camera = this.world.camera;
    this.controls = this.world.controls;
    this.renderer = this.world.renderer;
    this.audioSettings = this.createDefaultAudioSettings();
    this.applyAudioRoutingDefaults();
    this.audioReady = false;
    this.programOptions = [];
    this.instrumentSelections = {};
    this.refreshMusicForAnimal(defaultAnimalType);
    this.setupAudioBootstrap();

    // UI wiring
    this.setupAnimalDropdown(defaultAnimalType);
    this.setupCameraShortcuts();
    this.setupTuningPanel(defaultAnimalType);
    this.setupHistoryShortcuts();
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
        this.updateSoundFontStatus({ loading: true });
        await this.soundFontEngine.loadSoundFont('/audio/GeneralUser_GS_v1.471.sf2');
        this.refreshProgramOptions();
        this.audioReady = true;

        this.updateSoundFontStatus({ loading: false });

        // Expose for quick console testing
        window.soundFontEngine = this.soundFontEngine;
        window.musicEngine = this.musicEngine;
      } catch (error) {
        console.error('[Zoo] Failed to initialize audio pipeline:', error);
        this.refreshProgramOptions();
        this.updateSoundFontStatus({ error });
      }
    };

    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
  }

  getDefaultInstrumentForAnimal(animalId) {
    const profile = getProfileForAnimal(animalId);
    if (profile && typeof profile.programNumber === 'number') {
      return profile.programNumber;
    }
    return 0;
  }

  createDefaultAudioSettings() {
    const settings = {
      masterVolume: 1,
      masterMuted: false,
      footstepsEnabled: true,
      instrumentByAnimal: {},
      animalVolume: {},
      animalMuted: {}
    };

    for (const animalId of getRegisteredAnimals()) {
      settings.instrumentByAnimal[animalId] = this.getDefaultInstrumentForAnimal(animalId);
      settings.animalVolume[animalId] = 1;
      settings.animalMuted[animalId] = false;
    }

    return settings;
  }

  applyAudioRoutingDefaults() {
    for (const animalId of getRegisteredAnimals()) {
      const channel = MIDI_CHANNEL_ASSIGNMENTS[animalId];
      if (typeof channel === 'number') {
        this.soundFontEngine.assignChannelForAnimal(animalId, channel);
      }
      this.applyAudioForAnimal(animalId);
    }
    this.applyMasterAudioSettings();
    this.musicEngine.setFootstepsEnabled(this.audioSettings.footstepsEnabled);
  }

  ensureAudioDefaultsForAnimal(animalId) {
    if (!Object.prototype.hasOwnProperty.call(this.audioSettings.instrumentByAnimal, animalId)) {
      this.audioSettings.instrumentByAnimal[animalId] = this.getDefaultInstrumentForAnimal(animalId);
    }
    if (!Object.prototype.hasOwnProperty.call(this.audioSettings.animalVolume, animalId)) {
      this.audioSettings.animalVolume[animalId] = 1;
    }
    if (!Object.prototype.hasOwnProperty.call(this.audioSettings.animalMuted, animalId)) {
      this.audioSettings.animalMuted[animalId] = false;
    }
  }

  applyMasterAudioSettings() {
    this.soundFontEngine.setMasterVolume(this.audioSettings.masterVolume);
    this.soundFontEngine.setMasterMute(this.audioSettings.masterMuted);
  }

  applyAudioForAnimal(animalId) {
    if (!animalId) return;
    this.ensureAudioDefaultsForAnimal(animalId);
    const instrument = this.audioSettings.instrumentByAnimal[animalId];
    const volume = this.audioSettings.animalVolume[animalId];
    const muted = this.audioSettings.animalMuted[animalId];

    if (typeof instrument === 'number') {
      this.soundFontEngine.setInstrumentForAnimal(animalId, instrument);
    }
    this.soundFontEngine.setAnimalVolume(animalId, volume);
    this.soundFontEngine.setAnimalMute(animalId, muted);
  }

  syncAudioPanel(animalType) {
    if (!this.tuningPanel || !animalType) return;
    this.ensureAudioDefaultsForAnimal(animalType);
    const defaultProgramName = this.getDefaultProgramLabel(animalType);

    this.tuningPanel.setInstrumentOptions(
      this.programOptions,
      this.getInstrumentSelection(animalType),
      defaultProgramName
    );

    this.tuningPanel.setAudioState({
      instrumentProgram: this.audioSettings.instrumentByAnimal[animalType],
      masterVolume: this.audioSettings.masterVolume,
      masterMuted: this.audioSettings.masterMuted,
      animalVolume: this.audioSettings.animalVolume[animalType],
      animalMuted: this.audioSettings.animalMuted[animalType],
      footstepsEnabled: this.audioSettings.footstepsEnabled,
      instrumentOptions: this.programOptions
    });
  }

  handleAudioSettingsChange(change = {}) {
    const animalId = this.currentAnimalType;
    if (animalId) {
      this.ensureAudioDefaultsForAnimal(animalId);
    }

    if (typeof change.instrumentProgram === 'number' && animalId) {
      this.audioSettings.instrumentByAnimal[animalId] = change.instrumentProgram;
      this.soundFontEngine.setInstrumentForAnimal(animalId, change.instrumentProgram);
    }

    if (typeof change.masterVolume === 'number') {
      this.audioSettings.masterVolume = Math.min(Math.max(change.masterVolume, 0), 1);
      this.applyMasterAudioSettings();
    }

    if (typeof change.masterMuted === 'boolean') {
      this.audioSettings.masterMuted = change.masterMuted;
      this.applyMasterAudioSettings();
    }

    if (typeof change.animalVolume === 'number' && animalId) {
      this.audioSettings.animalVolume[animalId] = Math.min(Math.max(change.animalVolume, 0), 1);
      this.soundFontEngine.setAnimalVolume(animalId, this.audioSettings.animalVolume[animalId]);
    }

    if (typeof change.animalMuted === 'boolean' && animalId) {
      this.audioSettings.animalMuted[animalId] = change.animalMuted;
      this.soundFontEngine.setAnimalMute(animalId, change.animalMuted);
    }

    if (typeof change.footstepsEnabled === 'boolean') {
      this.audioSettings.footstepsEnabled = change.footstepsEnabled;
      this.musicEngine.setFootstepsEnabled(change.footstepsEnabled);
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
      this.refreshMusicForAnimal(type);
      this.syncTuningPanel(type);
      this.applyAudioForAnimal(type);
      this.syncAudioPanel(type);
    });

    const frameBtn = document.getElementById('zoo-frame');
    if (frameBtn) {
      frameBtn.addEventListener('click', () => this.frameAnimal());
    }

    const resetCamBtn = document.getElementById('zoo-reset-camera');
    if (resetCamBtn) {
      resetCamBtn.addEventListener('click', () => this.resetCamera());
    }
  }

  setupTuningPanel(defaultAnimalType) {
    this.tuningPanel = new TuningPanel({
      onTuningChange: (change) => {
        this.handleTuningChange(change);
      },
      onFrame: () => {
        this.frameAnimal();
      },
      onCameraReset: () => {
        this.resetCamera();
      },
      onReset: () => {
        this.resetTuningToDefaults();
      },
      onPresetLoad: (values, name, meta) => {
        this.applyPreset(values, meta);
      },
      onUndo: () => this.undoTuning(),
      onRedo: () => this.redoTuning(),
      onInstrumentChange: (programNumber) => this.setInstrumentSelection(this.currentAnimalType, programNumber),
      programOptions: this.programOptions,
      defaultProgram: this.getInstrumentSelection(defaultAnimalType),
      defaultProgramName: this.getDefaultProgramLabel(defaultAnimalType),
      onAudioSettingsChange: (change) => this.handleAudioSettingsChange(change)
    });

    this.syncTuningPanel(defaultAnimalType);
    this.syncAudioPanel(defaultAnimalType);
  }

  syncTuningPanel(animalType) {
    if (!this.tuningPanel) return;
    const module = AnimalRegistry[animalType];
    if (!module) return;
    this.schemaVersion = this.getSchemaVersionForAnimal(animalType);
    const schema = module.getTuningSchema ? module.getTuningSchema() : {};
    this.currentSchema = schema;
    const info = this.world.getDebugInfo ? this.world.getDebugInfo() : {};
    const current = info.tuning || (module.getDefaultTuning ? module.getDefaultTuning() : {});
    const defaults = module.getDefaultTuning ? module.getDefaultTuning() : {};
    this.currentTuning = { ...current };
    this.resetHistory(current);
    this.tuningPanel.setSchema(schema, current, animalType, defaults, this.schemaVersion);
    this.syncAudioPanel(animalType);
  }

  handleTuningChange(change) {
    if (!change) return;
    const values = change.values || {};
    const patch = change.patch || {};
    const prev = { ...this.currentTuning };
    const next = { ...this.currentTuning, ...values };
    if (this.areTuningsEqual(this.currentTuning, next)) return;

    this.pushHistory(prev);
    this.tuningHistory.future = [];
    this.currentTuning = next;

    const changedKeys = this.diffKeys(prev, next, patch);
    const hasTierB = changedKeys.some((key) => this.getTierForKey(key) === 'B');

    if (hasTierB) {
      this.tuningPanel?.setRebuilding(true);
      this.world.scheduleRebuild(next, () => this.tuningPanel?.setRebuilding(false));
    } else {
      this.world.applyImmediateTuning(patch);
    }
  }

  diffKeys(prev = {}, next = {}, patch = {}) {
    const candidateKeys = Object.keys(patch).length
      ? Object.keys(patch)
      : Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
    return candidateKeys.filter((key) => prev[key] !== next[key]);
  }

  buildPatch(prev = {}, next = {}, keys = []) {
    const patch = {};
    for (const key of keys) {
      patch[key] = next[key];
    }
    return patch;
  }

  getTierForKey(key) {
    const meta = this.currentSchema?.[key];
    return (meta?.tier || 'A').toUpperCase();
  }

  areTuningsEqual(a = {}, b = {}) {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of keys) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  }

  pushHistory(snapshot = {}) {
    const past = this.tuningHistory.past;
    if (past.length && this.areTuningsEqual(past[past.length - 1], snapshot)) return;
    past.push({ ...snapshot });
    if (past.length > this.tuningHistory.limit) {
      past.shift();
    }
  }

  resetHistory(current = {}) {
    this.tuningHistory = { past: [], future: [], limit: 50 };
    this.currentTuning = { ...current };
  }

  applySnapshot(snapshot = {}, { recordHistory = true } = {}) {
    const prev = { ...this.currentTuning };
    if (this.areTuningsEqual(prev, snapshot)) return;

    if (recordHistory) {
      this.pushHistory(prev);
      this.tuningHistory.future = [];
    }

    this.currentTuning = { ...snapshot };
    this.tuningPanel?.setValues(this.currentTuning);

    const changedKeys = this.diffKeys(prev, this.currentTuning);
    const patch = this.buildPatch(prev, this.currentTuning, changedKeys);
    const hasTierB = changedKeys.some((key) => this.getTierForKey(key) === 'B');

    if (hasTierB) {
      this.tuningPanel?.setRebuilding(true);
      this.world.scheduleRebuild(this.currentTuning, () => this.tuningPanel?.setRebuilding(false));
    } else {
      this.world.applyImmediateTuning(patch);
    }
  }

  undoTuning() {
    if (!this.tuningHistory.past.length) return;
    const previous = this.tuningHistory.past.pop();
    this.tuningHistory.future.push({ ...this.currentTuning });
    this.applySnapshot(previous, { recordHistory: false });
  }

  redoTuning() {
    if (!this.tuningHistory.future.length) return;
    const next = this.tuningHistory.future.pop();
    this.tuningHistory.past.push({ ...this.currentTuning });
    this.applySnapshot(next, { recordHistory: false });
  }

  resetTuningToDefaults() {
    const module = AnimalRegistry[this.currentAnimalType];
    if (!module) return;
    const defaults = module.getDefaultTuning ? module.getDefaultTuning() : {};
    this.applySnapshot(defaults);
    const audioConfig = {
      programOptions: this.programOptions,
      selectedProgram: this.getInstrumentSelection(this.currentAnimalType),
      defaultProgramName: this.getDefaultProgramLabel(this.currentAnimalType)
    };
    this.tuningPanel?.setSchema(
      this.currentSchema,
      defaults,
      this.currentAnimalType,
      defaults,
      this.schemaVersion,
      audioConfig
    );
  }

  applyPreset(values = {}, meta = {}) {
    const snapshot = { ...values };
    this.applySnapshot(snapshot);
    if (meta?.schemaVersion && meta.schemaVersion !== this.schemaVersion) {
      console.warn('[Zoo] Preset schema version mismatch', {
        expected: this.schemaVersion,
        received: meta.schemaVersion
      });
    }
  }

  setupHistoryShortcuts() {
    this._historyHotkeys = (event) => {
      const tag = event.target?.tagName || '';
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
      const isRedo = (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
      if (isUndo) {
        event.preventDefault();
        this.undoTuning();
      } else if (isRedo) {
        event.preventDefault();
        this.redoTuning();
      }
    };

    window.addEventListener('keydown', this._historyHotkeys);
  }

  getSchemaVersionForAnimal(animalType) {
    const module = AnimalRegistry[animalType];
    if (!module) return '1.0.0';
    if (typeof module.getTuningSchemaVersion === 'function') return module.getTuningSchemaVersion();
    if (typeof module.tuningSchemaVersion === 'string') return module.tuningSchemaVersion;
    return '1.0.0';
  }

  setupCameraShortcuts() {
    this._cameraHotkeys = (event) => {
      const tag = event.target?.tagName || '';
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        this.frameAnimal();
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        this.resetCamera();
      }
    };

    window.addEventListener('keydown', this._cameraHotkeys);
  }

  frameAnimal() {
    if (this.world?.frameAnimal) {
      this.world.frameAnimal();
    }
  }

  resetCamera() {
    if (this.world?.resetCamera) {
      this.world.resetCamera();
    }
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
        <div>FL blend: <span class="value" id="zoo-debug-blend-fl">-</span></div>
        <div>FR blend: <span class="value" id="zoo-debug-blend-fr">-</span></div>
        <div>BL blend: <span class="value" id="zoo-debug-blend-bl">-</span></div>
        <div>BR blend: <span class="value" id="zoo-debug-blend-br">-</span></div>
        <button id="zoo-debug-export-obj" type="button">Export OBJ (debug)</button>
        <button id="zoo-debug-export-tuning" type="button">Export Tuning JSON</button>
        <button id="zoo-debug-export-preset" type="button">Export Preset Bundle</button>
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
      stateTime: document.getElementById('zoo-debug-state-time'),
      blendFrontLeft: document.getElementById('zoo-debug-blend-fl'),
      blendFrontRight: document.getElementById('zoo-debug-blend-fr'),
      blendBackLeft: document.getElementById('zoo-debug-blend-bl'),
      blendBackRight: document.getElementById('zoo-debug-blend-br')
    };

    this.debugExportButton = document.getElementById('zoo-debug-export-obj');
    this.debugTuningExportButton = document.getElementById('zoo-debug-export-tuning');
    this.debugPresetExportButton = document.getElementById('zoo-debug-export-preset');
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

    if (this.debugTuningExportButton) {
      this.debugTuningExportButton.addEventListener('click', () => {
        this.exportCurrentTuning();
      });
    }

    if (this.debugPresetExportButton) {
      this.debugPresetExportButton.addEventListener('click', () => {
        this.exportPresetBundle();
      });
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
          defaultAnimal: 'cat',
          soundFontEngine: this.soundFontEngine
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
    if (this.world && typeof this.world.renderFrame === 'function') {
      this.world.renderFrame();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.audioReady && this.musicEngine && this.soundFontEngine) {
      const audioCtx = this.soundFontEngine.getAudioContext();
      this.musicEngine.update(audioCtx.currentTime);
    }

    // Debug info
    if (this.debugFields) {
      const info = this.world && this.world.getDebugInfo ? this.world.getDebugInfo() : {};
      const pensCount = info.penCount ?? 1;
      const debugBlend = info.debugBlend || {};
      const formatBlend = (label, data) => {
        if (!data) return '-';
        const ring = Number.isFinite(data.ringIndex) ? data.ringIndex : '-';
        const segment = Number.isFinite(data.centerSegment) ? data.centerSegment : '-';
        const span = Number.isFinite(data.span) ? data.span : '-';
        const axis =
          typeof data.axisDistance === 'number' ? data.axisDistance.toFixed(2) : '-';
        const axisDebug = data.axisProjection || {};
        const axisClosest =
          typeof axisDebug.closestAxisDistance === 'number'
            ? axisDebug.closestAxisDistance.toFixed(2)
            : '-';
        const axisSelected =
          typeof axisDebug.selectedAxisDistance === 'number'
            ? axisDebug.selectedAxisDistance.toFixed(2)
            : '-';
        const projDist =
          typeof axisDebug.projectionDistance === 'number'
            ? axisDebug.projectionDistance.toFixed(3)
            : '-';
        return `${label} ring/seg:${ring}/${segment} span:${span} axis:${axis} sel:${axisSelected} closest:${axisClosest} projΔ:${projDist}`;
      };

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

      if (this.debugFields.blendFrontLeft) {
        this.debugFields.blendFrontLeft.textContent = formatBlend(
          'FL',
          debugBlend.frontLeft
        );
      }
      if (this.debugFields.blendFrontRight) {
        this.debugFields.blendFrontRight.textContent = formatBlend(
          'FR',
          debugBlend.frontRight
        );
      }
      if (this.debugFields.blendBackLeft) {
        this.debugFields.blendBackLeft.textContent = formatBlend(
          'BL',
          debugBlend.backLeft
        );
      }
      if (this.debugFields.blendBackRight) {
        this.debugFields.blendBackRight.textContent = formatBlend(
          'BR',
          debugBlend.backRight
        );
      }
    }
  }

  exportCurrentTuning() {
    const payload = {
      speciesId: this.currentAnimalType,
      schemaVersion: this.schemaVersion,
      tuning: { ...this.currentTuning },
      timestamp: new Date().toISOString()
    };
    const safeId = (this.currentAnimalType || 'animal').toString().toLowerCase();
    const filename = `${safeId}_tuning.json`;
    downloadAsJSON(payload, filename);
  }

  exportPresetBundle() {
    const name = (this.tuningPanel?.presetNameInput?.value || `${this.currentAnimalType || 'animal'}-preset`).trim();
    const safeName = name ? name.replace(/\s+/g, '_') : 'preset';
    const payload = {
      name: name || 'preset',
      speciesId: this.currentAnimalType,
      schemaVersion: this.schemaVersion,
      tuning: { ...this.currentTuning },
      createdAt: new Date().toISOString()
    };
    const filename = `${safeName || 'preset'}_${this.currentAnimalType || 'animal'}_bundle.json`;
    downloadAsJSON(payload, filename);
  }

  getInstrumentSelection(animalType) {
    const key = animalType || this.currentAnimalType;
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(this.instrumentSelections, key)) {
      return this.normalizeInstrumentSelection(key, this.instrumentSelections[key]);
    }
    const fallback = this.getDefaultInstrumentProgram(key);
    const normalized = this.normalizeInstrumentSelection(key, fallback);
    this.instrumentSelections[key] = normalized;
    return normalized;
  }

  getDefaultInstrumentProgram(animalType) {
    const profile = getProfileForAnimal(animalType) || {};
    return typeof profile.programNumber === 'number' ? profile.programNumber : 0;
  }

  getDefaultProgramLabel(animalType) {
    const program = this.getDefaultInstrumentProgram(animalType);
    const engine = this.soundFontEngine;
    if (engine?.getSoundFontError?.()) {
      return 'SoundFont failed to load';
    }
    if (engine?.isSoundFontLoading?.()) {
      return 'Loading instruments…';
    }
    const name = engine?.getProgramName?.(program);
    return name ? `Default (${name})` : 'Default instrument';
  }

  setInstrumentSelection(animalType, programNumber) {
    const safeProgram = this.normalizeInstrumentSelection(animalType, programNumber);
    this.instrumentSelections[animalType] = safeProgram;
    this.applyInstrumentSelection(animalType);
  }

  applyInstrumentSelection(animalType) {
    const program = this.getInstrumentSelection(animalType);
    if (this.soundFontEngine) {
      this.soundFontEngine.setInstrumentForAnimal(animalType, program);
      const channel = MIDI_CHANNEL_ASSIGNMENTS[animalType];
      if (typeof channel === 'number') {
        this.soundFontEngine.assignChannelForAnimal(animalType, channel);
      }
    }

    const active = this.world?.getActiveAnimal?.();
    if (active?.root?.behavior?.setInstrumentProgram && this.currentAnimalType === animalType) {
      active.root.behavior.setInstrumentProgram(program);
    }
  }

  refreshMusicForAnimal(animalType) {
    const profile = getProfileForAnimal(animalType) || {};
    if (this.musicEngine) {
      this.musicEngine.registerAnimalBrain(animalType, new AnimalMusicBrain(profile));
    }

    this.applyInstrumentSelection(animalType);
    this.attachFootfallListener(animalType);
  }

  refreshProgramOptions() {
    this.programOptions = this.soundFontEngine.getProgramList();
    this.validateInstrumentSelections();
    if (this.tuningPanel) {
      this.tuningPanel.setInstrumentOptions(
        this.programOptions,
        this.getInstrumentSelection(this.currentAnimalType),
        this.getDefaultProgramLabel(this.currentAnimalType)
      );
    }

    this.updateSoundFontStatus();
  }

  normalizeInstrumentSelection(animalId, programNumber) {
    const normalized =
      typeof programNumber === 'number' ? programNumber : this.getDefaultInstrumentProgram(animalId);
    if (this.isProgramAvailable(normalized)) {
      return normalized;
    }
    const defaultProgram = this.getDefaultInstrumentProgram(animalId);
    if (this.isProgramAvailable(defaultProgram)) {
      return defaultProgram;
    }
    const fallback = this.programOptions.find((program) => typeof program.number === 'number');
    return fallback ? fallback.number : normalized;
  }

  isProgramAvailable(programNumber) {
    if (typeof programNumber !== 'number') return false;
    return this.programOptions.some((program) => program.number === programNumber);
  }

  validateInstrumentSelections() {
    if (!Array.isArray(this.programOptions) || !this.programOptions.length) return;
    const validPrograms = new Set(this.programOptions.map((program) => program.number));
    for (const animalId of getRegisteredAnimals()) {
      const selection = this.instrumentSelections[animalId];
      if (typeof selection === 'number' && validPrograms.has(selection)) continue;
      const fallback = validPrograms.has(this.getDefaultInstrumentProgram(animalId))
        ? this.getDefaultInstrumentProgram(animalId)
        : this.programOptions[0]?.number;
      if (typeof fallback === 'number') {
        this.instrumentSelections[animalId] = fallback;
        this.audioSettings.instrumentByAnimal[animalId] = fallback;
        if (animalId === this.currentAnimalType) {
          this.applyInstrumentSelection(animalId);
        }
      }
    }
  }

  updateSoundFontStatus({ loading = false, error = null } = {}) {
    if (!this.tuningPanel?.setSoundFontStatus) return;
    this.tuningPanel.setSoundFontStatus({
      loading,
      error,
      programCount: this.programOptions.length
    });
  }

  attachFootfallListener(animalType) {
    if (!this.musicEngine) return;
    const active = this.world?.getActiveAnimal?.();
    const behavior = active?.root?.behavior;
    if (!behavior || typeof behavior.setFootfallListener !== 'function') return;

    behavior.setFootfallListener((footfall) => {
      const payload = {
        ...footfall,
        animalId: animalType,
        instrumentProgram: this.getInstrumentSelection(animalType)
      };
      this.musicEngine.enqueueFootfallEvent(payload);
    });
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
