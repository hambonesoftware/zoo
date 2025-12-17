// src/animals/Elephant/ElephantBehavior.js

import * as THREE from 'three';
import { ElephantLocomotion } from './ElephantLocomotion.js';

/**
 * ElephantBehavior
 *
 * Orchestrates procedural animation for the ElephantCreature:
 * - Delegates locomotion (idle + walk) to ElephantLocomotion
 * - Maintains a simple high-level state string for studio HUD/debugging
 * - Exposes a bone map for easy future extensions (trunk tricks, posing, etc.)
 */
export class ElephantBehavior {
  /**
   * @param {THREE.Skeleton} skeleton
   * @param {THREE.SkinnedMesh} mesh
   * @param {Object} opts - optional flags like { debug: true }
   */
  constructor(skeleton, mesh, opts = {}) {
    this.skeleton = skeleton;
    this.mesh = mesh;
    this.time = 0;
    this.instrumentProgram =
      typeof opts.instrumentProgram === 'number' ? opts.instrumentProgram : null;
    this.soundFontEngine = opts.soundFontEngine || null;

    // Environment config (enclosure/pond). Passed in from ElephantPen.
    this.environment = null;

    // High-level state: 'idle', 'walk', etc.
    this.state = 'idle';

    // Build a simple bone map by name for convenience
    this.bones = {};
    this.skeleton.bones.forEach((bone) => {
      this.bones[bone.name] = bone;
    });

    // Locomotion controller: expects an object with { bones, mesh, setState? }
    this.locomotion = new ElephantLocomotion(this);

    // Walk-in-place is useful for the creature studio so the elephant stays
    // centered while still animating a full gait and emitting footfalls.
    this.walkInPlace = !!opts.walkInPlace;
    if (this.locomotion?.setWalkInPlace) {
      this.locomotion.setWalkInPlace(this.walkInPlace);
    }

    this._strideCounter = 0;
    this._pentatonicIntervals = Array.isArray(opts.pentatonicIntervals)
      ? opts.pentatonicIntervals
      : [0, 2, 4, 7, 9];
    this._legOffsets = {
      front_left: 0,
      front_right: 2,
      back_left: 1,
      back_right: 3
    };
    this.stepInstrument = opts.stepInstrument || opts.instrument || 'elephant-steps';
    this.baseMidiNote = typeof opts.baseMidiNote === 'number' ? opts.baseMidiNote : 48;
    this.stepVelocity = typeof opts.stepVelocity === 'number' ? opts.stepVelocity : 0.8;
    this.stepDuration = typeof opts.stepDuration === 'number' ? opts.stepDuration : 0.35;
    this._footstepHandlers = new Set();
    this._defaultFootfallHandler = this._onFootfall.bind(this);
    this._legacyFootfallListener = null;
    this._locomotionFootstepUnsub = null;
    this._ensureDefaultFootfallHandler();
    this._bindFootstepRelay();

    // Optional debug flag (for future HUD/overlays)
    this.debug = {
      enabled: !!opts.debug
    };

  }

  setFootfallListener(listener) {
    if (typeof listener !== 'function') return;

    this._ensureDefaultFootfallHandler();

    if (this._legacyFootfallListener && this._legacyFootfallListener !== listener) {
      this._footstepHandlers.delete(this._legacyFootfallListener);
    }

    this._legacyFootfallListener = listener;
    this._footstepHandlers.add(listener);
    this._bindFootstepRelay();
  }

  _bindFootstepRelay() {
    if (this._locomotionFootstepUnsub) return;
    if (!this.locomotion || typeof this.locomotion.onFootstep !== 'function') return;

    this._locomotionFootstepUnsub = this.locomotion.onFootstep((evt) => {
      this._ensureDefaultFootfallHandler();
      this._footstepHandlers.forEach((handler) => handler(evt));
    });
  }

  onFootstep(listener) {
    if (typeof listener !== 'function') return () => {};
    this._ensureDefaultFootfallHandler();
    this._footstepHandlers.add(listener);
    this._bindFootstepRelay();
    return () => {
      this._footstepHandlers.delete(listener);
    };
  }

  _ensureDefaultFootfallHandler() {
    if (
      this._defaultFootfallHandler &&
      !this._footstepHandlers.has(this._defaultFootfallHandler)
    ) {
      this._footstepHandlers.add(this._defaultFootfallHandler);
    }
  }

  setInstrumentProgram(programNumber) {
    this.instrumentProgram = typeof programNumber === 'number' ? programNumber : null;
  }

  /**
   * Configure environment data such as enclosure radius and pond location.
   * Propagates to locomotion and defaults the elephant into a wandering state
   * once the world is known.
   */
  configureEnvironment(env) {
    this.environment = env || null;

    if (this.locomotion && typeof this.locomotion.setEnvironment === 'function') {
      this.locomotion.setEnvironment(env);
    }

    if (this.locomotion && this.state === 'idle') {
      this.locomotion.setState('wander');
    }
  }

  /**
   * Called by ElephantLocomotion when its internal state changes.
   * Allows the studio UI to show a simple "top level" state.
   * @param {string} nextState
   */
  setState(nextState) {
    this.state = nextState;
  }

  /**
   * Per-frame update. Call once per render frame.
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    if (!dt || !this.skeleton || !this.mesh) return;

    this.time += dt;

    // Delegate actual motion to the locomotion layer
    if (this.locomotion && typeof this.locomotion.update === 'function') {
      this.locomotion.update(dt);
    }

    // Ensure bones update their matrices after we tweak rotations/positions
    this.skeleton.bones.forEach((bone) => {
      bone.updateMatrixWorld(true);
    });
  }

  /**
   * Lightweight debug snapshot for the studio HUD or console logging.
   */
  getDebugInfo() {
    return {
      state: this.state,
      time: this.time,
      locomotionState: this.locomotion ? this.locomotion.state : null,
      instrumentProgram: this.instrumentProgram
    };
  }

  setStepMusicConfig(config = {}) {
    if (!config) return;
    if (typeof config.stepInstrument !== 'undefined') {
      this.stepInstrument = config.stepInstrument;
    }
    if (typeof config.baseMidiNote === 'number') {
      this.baseMidiNote = config.baseMidiNote;
    }
    if (Array.isArray(config.pentatonicIntervals)) {
      this._pentatonicIntervals = config.pentatonicIntervals;
    }
  }

  _onFootfall(event = {}) {
    if (!event.limbId || !this.soundFontEngine?.playStepNote) return;

    const audioTime = this._getAudioTime();
    const eventTime = typeof event.timestamp === 'number' ? event.timestamp : audioTime;
    const midiNote = this._getStepNote(event.limbId, this._strideCounter);
    const velocity = this._resolveVelocity(event);

    this.soundFontEngine.playStepNote(this.stepInstrument, midiNote, velocity, eventTime, this.stepDuration);

    this._strideCounter += 1;
  }

  _getStepNote(limbId, strideIndex) {
    const intervals = this._pentatonicIntervals.length > 0 ? this._pentatonicIntervals : [0, 2, 4, 7, 9];
    const offset = this._legOffsets[limbId] ?? 0;
    const interval = intervals[(strideIndex + offset) % intervals.length];
    return this.baseMidiNote + interval;
  }

  _resolveVelocity(event = {}) {
    const speedFactor = typeof event.strideSpeed === 'number' ? THREE.MathUtils.clamp(event.strideSpeed * 0.9, 0.4, 1.0) : 1;
    return THREE.MathUtils.clamp(this.stepVelocity * speedFactor, 0, 1);
  }

  _getAudioTime() {
    if (this.soundFontEngine && typeof this.soundFontEngine.getAudioContext === 'function') {
      const ctx = this.soundFontEngine.getAudioContext();
      if (ctx && typeof ctx.currentTime === 'number') {
        return ctx.currentTime;
      }
    }
    return 0;
  }
}
