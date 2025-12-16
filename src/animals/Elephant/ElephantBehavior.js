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

    this._footfallListener = null;
    this._footstepHandlers = new Set();
    this._locomotionFootstepUnsub = null;
    this._bindFootstepRelay();

    // Optional debug flag (for future HUD/overlays)
    this.debug = {
      enabled: !!opts.debug
    };
  }

  setFootfallListener(listener) {
    this._footfallListener = typeof listener === 'function' ? listener : null;
  }

  _bindFootstepRelay() {
    if (this._locomotionFootstepUnsub) return;
    if (!this.locomotion || typeof this.locomotion.onFootstep !== 'function') return;

    this._locomotionFootstepUnsub = this.locomotion.onFootstep((evt) => {
      if (this._footfallListener) {
        this._footfallListener(evt);
      }

      this._footstepHandlers.forEach((handler) => handler(evt));
    });
  }

  onFootstep(listener) {
    if (typeof listener !== 'function') return () => {};
    this._footstepHandlers.add(listener);
    this._bindFootstepRelay();
    return () => {
      this._footstepHandlers.delete(listener);
    };
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
      locomotionState: this.locomotion ? this.locomotion.state : null
    };
  }
}
