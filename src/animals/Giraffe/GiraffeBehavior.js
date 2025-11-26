// src/animals/Giraffe/GiraffeBehavior.js

import { GiraffeLocomotion } from './GiraffeLocomotion.js';

export class GiraffeBehavior {
  constructor(skeleton, mesh, opts = {}) {
    this.skeleton = skeleton;
    this.mesh = mesh;
    this.state = 'idle';
    this.time = 0;
    this.moveSpeed = typeof opts.moveSpeed === 'number' ? opts.moveSpeed : 0;

    this.bones = {};
    this.skeleton.bones.forEach((bone) => {
      this.bones[bone.name] = bone;
    });

    this.locomotion = new GiraffeLocomotion(this);
  }

  setState(next) {
    const allowed = ['idle', 'walk'];
    if (allowed.includes(next)) {
      this.state = next;
      if (this.locomotion?.setState) {
        this.locomotion.setState(next);
      }
    }
  }

  setMoveSpeed(speed) {
    this.moveSpeed = Math.max(0, speed);
  }

  update(dt) {
    if (!dt || !this.skeleton || !this.mesh) return;

    this.time += dt;
    const nextState = this.moveSpeed > 0.05 ? 'walk' : 'idle';
    if (nextState !== this.state) {
      this.setState(nextState);
    }

    if (this.locomotion?.update) {
      this.locomotion.update(dt);
    }

    this.skeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));
  }

  getDebugInfo() {
    return {
      state: this.state,
      moveSpeed: this.moveSpeed,
      time: this.time,
      locomotionState: this.locomotion?.state
    };
  }
}
