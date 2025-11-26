// src/animals/Gorilla/GorillaBehavior.js

import { GorillaLocomotion } from './GorillaLocomotion.js';

export class GorillaBehavior {
  constructor(skeleton, mesh, opts = {}) {
    this.skeleton = skeleton;
    this.mesh = mesh;
    this.time = 0;
    this.state = 'idle';
    this.bones = {};

    this.skeleton.bones.forEach((bone) => {
      this.bones[bone.name] = bone;
    });

    this.locomotion = new GorillaLocomotion(this);
    this.debug = { enabled: !!opts.debug };
  }

  setState(next) {
    this.state = next;
  }

  update(dt) {
    if (!dt || !this.skeleton || !this.mesh) return;

    this.time += dt;
    if (this.locomotion && typeof this.locomotion.update === 'function') {
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
