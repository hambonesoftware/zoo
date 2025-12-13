// src/animals/Giraffe/GiraffeBehavior.js

import { GiraffeLocomotion } from './GiraffeLocomotion.js';

/**
 * GiraffeBehavior
 *
 * Orchestrates simple idle animation for the giraffe creature.
 * Mirrors the Cat/Elephant behavior API so the studio UI can introspect state
 * and adjust locomotion tuning on the fly.
 */
export class GiraffeBehavior {
  /**
   * @param {THREE.Skeleton} skeleton
   * @param {THREE.SkinnedMesh} mesh
   * @param {Object} opts
   */
  constructor(skeleton, mesh, opts = {}) {
    this.skeleton = skeleton;
    this.mesh = mesh;
    this.time = 0;

    this.state = 'idle';

    this.bones = {};
    this.skeleton.bones.forEach((bone) => {
      this.bones[bone.name] = bone;
    });

    this.locomotion = new GiraffeLocomotion(this);

    // Allow tuning overrides for idle motion
    if (opts.idle) {
      this.applyIdleTuning(opts.idle);
    }

    this.debug = {
      enabled: !!opts.debug
    };
  }

  setState(nextState) {
    const allowed = ['idle'];
    if (!allowed.includes(nextState)) return;
    this.state = nextState;
    if (this.locomotion?.setState) {
      this.locomotion.setState(nextState);
    }
  }

  applyIdleTuning(idle) {
    if (!idle || !this.locomotion) return;
    const loco = this.locomotion;
    if (typeof idle.swayAmount === 'number') loco.neckSwayAmplitude = idle.swayAmount;
    if (typeof idle.swaySpeed === 'number') loco.neckSwaySpeed = idle.swaySpeed;
  }

  update(dt) {
    if (!dt || !this.skeleton || !this.mesh) return;

    this.time += dt;

    if (this.locomotion?.update) {
      this.locomotion.update(dt);
    }

    this.skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));
  }

  getDebugInfo() {
    return {
      state: this.state,
      time: this.time,
      locomotionState: this.locomotion ? this.locomotion.state : null
    };
  }
}
