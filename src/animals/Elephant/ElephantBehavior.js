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

    // High-level state: 'idle', 'walk', etc.
    this.state = 'idle';

    // Build a simple bone map by name for convenience
    this.bones = {};
    this.skeleton.bones.forEach((bone) => {
      this.bones[bone.name] = bone;
    });

    // Locomotion controller: expects an object with { bones, mesh, setState? }
    this.locomotion = new ElephantLocomotion(this);

    // Optional debug flag (for future HUD/overlays)
    this.debug = {
      enabled: !!opts.debug
    };
  }

  /**
   * Called by ElephantLocomotion when its internal state changes.
   * Allows the studio UI to show a simple "top level" state.
   * @param {string} nextState
   */
  setState(nextState) {
    const allowed = ['idle', 'walk', 'wander', 'curious', 'drink', 'excited'];
    if (!allowed.includes(nextState)) return;
    this.state = nextState;
    if (this.locomotion?.setState) {
      this.locomotion.setState(nextState);
    }
  }

  /**
   * Define a target position for the elephant to walk to before drinking.
   * @param {THREE.Vector3|{x:number,y?:number,z:number}} target
   */
  setDrinkTarget(target) {
    if (this.locomotion?.setDrinkTarget) {
      this.locomotion.setDrinkTarget(target);
    }
  }

  /**
   * Convenience helper: set drink target and transition to the drink state.
   * @param {THREE.Vector3|{x:number,y?:number,z:number}} target
   */
  queueDrinkAt(target) {
    this.setDrinkTarget(target);
    this.setState('drink');
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
      drinkTarget: this.locomotion ? this.locomotion.drinkTarget : null
    };
  }
}
