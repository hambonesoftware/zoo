// src/animals/Cat/CatBehavior.js

import { CatLocomotion } from './CatLocomotion.js';

/**
 * CatBehavior
 *
 * Orchestrates procedural animation for the CatCreature:
 * - Delegates locomotion (idle + walk) to CatLocomotion
 * - Maintains a simple high-level state string for studio HUD/debugging
 * - Exposes a bone map for easy future extensions (tail posing, etc.)
 */
export class CatBehavior {
  /**
   * @param {THREE.Skeleton} skeleton
   * @param {THREE.SkinnedMesh} mesh
   * @param {Object} opts - optional flags like { debug: true, moveSpeed: 0 }
   */
  constructor(skeleton, mesh, opts = {}) {
    this.skeleton = skeleton;
    this.mesh = mesh;
    this.time = 0;

    // High-level state: 'idle', 'walk', etc.
    this.state = 'idle';
    this.moveSpeed = typeof opts.moveSpeed === 'number' ? opts.moveSpeed : 0;

    // Build a simple bone map by name for convenience
    this.bones = {};
    this.skeleton.bones.forEach((bone) => {
      this.bones[bone.name] = bone;
    });

    // Locomotion controller: expects an object with { bones, mesh, setState? }
    this.locomotion = new CatLocomotion(this);

    // Optional debug flag (for future HUD/overlays)
    this.debug = {
      enabled: !!opts.debug
    };
  }

  /**
   * Called by CatLocomotion or external systems when its internal state changes.
   * Allows the studio UI to show a simple "top level" state.
   * @param {string} nextState
   */
  setState(nextState) {
    const allowed = ['idle', 'walk', 'prowl', 'run'];
    if (!allowed.includes(nextState)) return;
    this.state = nextState;
    if (this.locomotion?.setState) {
      this.locomotion.setState(nextState);
    }
  }

  /**
   * Adjust the current desired ground speed. Values > 0.05 transition to walk.
   * @param {number} speed
   */
  setMoveSpeed(speed) {
    this.moveSpeed = Math.max(0, speed);
  }

  /**
   * Per-frame update. Call once per render frame.
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    if (!dt || !this.skeleton || !this.mesh) return;

    this.time += dt;

    // Simple state selection driven by desired speed
    const nextState = this.moveSpeed > 0.05 ? 'walk' : 'idle';
    if (nextState !== this.state) {
      this.setState(nextState);
    }

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
      moveSpeed: this.moveSpeed
    };
  }
}
