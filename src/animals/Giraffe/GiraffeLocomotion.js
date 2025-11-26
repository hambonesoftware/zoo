// src/animals/Giraffe/GiraffeLocomotion.js

/**
 * Simple idle/walk locomotion tuned for the tall proportions of the giraffe.
 */
export class GiraffeLocomotion {
  constructor(giraffe) {
    this.giraffe = giraffe;
    this.state = 'idle';
    this.time = 0;
    this.walkPhase = 0;
    this.baseHeight = 1.7;
    this.walkSpeed = 1.4;
  }

  setState(next) {
    const allowed = ['idle', 'walk'];
    if (allowed.includes(next)) {
      this.state = next;
    }
  }

  update(dt) {
    const bones = this.giraffe?.bones;
    const root = bones?.spine_base;
    if (!bones || !root || !dt) return;

    this.time += dt;

    if (this.giraffe.state && this.giraffe.state !== this.state) {
      this.setState(this.giraffe.state);
    }

    if (this.state === 'walk') {
      this._updateWalk(dt, bones, root);
    } else {
      this._updateIdle(bones, root);
    }
  }

  _updateIdle(bones, root) {
    const sway = Math.sin(this.time * 0.4) * 0.02;
    const breathe = Math.sin(this.time * 0.6) * 0.03;
    root.position.set(0, this.baseHeight + breathe, 0);
    root.rotation.set(0, 0, sway);

    if (bones.spine_neck_base && bones.spine_neck_top) {
      bones.spine_neck_base.rotation.x = 0.08 + Math.sin(this.time * 0.35) * 0.02;
      bones.spine_neck_mid.rotation.x = 0.1 + Math.sin(this.time * 0.32) * 0.025;
      bones.spine_neck_top.rotation.x = 0.12 + Math.sin(this.time * 0.3) * 0.02;
    }

    if (bones.head) {
      bones.head.rotation.y = Math.sin(this.time * 0.5) * 0.04;
      bones.head.rotation.x = -0.08 + Math.sin(this.time * 0.42) * 0.015;
    }

    this._tailSway(bones, 0.6);
  }

  _updateWalk(dt, bones, root) {
    const TWO_PI = Math.PI * 2;
    this.walkPhase = (this.walkPhase + dt * this.walkSpeed) % TWO_PI;

    const vertical = Math.sin(this.walkPhase * 2.0) * 0.05;
    root.position.set(0, this.baseHeight + vertical, 0);

    const stride = 0.25;
    const kneeLift = 0.55;

    this._poseLeg(bones, 'front_left', this.walkPhase, stride, kneeLift);
    this._poseLeg(bones, 'rear_right', this.walkPhase, stride * 0.95, kneeLift);
    this._poseLeg(bones, 'front_right', this.walkPhase + Math.PI, stride, kneeLift);
    this._poseLeg(bones, 'rear_left', this.walkPhase + Math.PI, stride * 0.95, kneeLift);

    if (bones.spine_mid) {
      bones.spine_mid.rotation.z = Math.sin(this.walkPhase) * 0.04;
    }
    if (bones.spine_neck_base) {
      bones.spine_neck_base.rotation.x = 0.12 + Math.sin(this.walkPhase * 0.7) * 0.03;
    }

    this._tailSway(bones, 1.0);
  }

  _poseLeg(bones, prefix, phase, stride, kneeLift) {
    const shoulder = bones[`${prefix}_shoulder`];
    const upper = bones[`${prefix}_upper`];
    const lower = bones[`${prefix}_lower`];
    const hoof = bones[`${prefix}_hoof`];
    if (!shoulder || !upper || !lower || !hoof) return;

    const swing = Math.sin(phase) * stride;
    const lift = Math.max(0, Math.sin(phase)) * kneeLift;

    shoulder.rotation.x = swing * 0.5;
    upper.rotation.x = swing * 0.8 - 0.2;
    lower.rotation.x = -swing * 0.5 - lift * 0.3;
    hoof.rotation.x = -lift * 0.1;
  }

  _tailSway(bones, strength) {
    if (bones.tail_base && bones.tail_mid && bones.tail_tip) {
      const sway = Math.sin(this.time * 0.9) * 0.25 * strength;
      bones.tail_base.rotation.y = sway;
      bones.tail_mid.rotation.y = sway * 1.2;
      bones.tail_tip.rotation.y = sway * 1.4;
    }
  }
}
