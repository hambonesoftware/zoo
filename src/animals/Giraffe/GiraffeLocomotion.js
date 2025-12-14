// src/animals/Giraffe/GiraffeLocomotion.js

/**
 * GiraffeLocomotion
 *
 * Lightweight idle locomotion for the GiraffeCreature:
 * - Gentle neck sway down the long neck chain
 * - Subtle head bob and yaw drift
 * - Tail swish with diminishing amplitude down the chain
 * - Occasional ear flutter to keep the silhouette alive
 */
export class GiraffeLocomotion {
  constructor(giraffe) {
    this.giraffe = giraffe;

    this.state = 'idle';
    this.time = 0;
    this.idlePhase = 0;

    // Tunable amplitudes
    this.baseHeight = 2.1;
    this.neckSwayAmplitude = 0.16;
    this.neckSwaySpeed = 0.55;
    this.headBobAmplitude = 0.05;
    this.headBobSpeed = 0.9;
    this.tailSwayAmplitude = 0.38;
    this.tailSwaySpeed = 1.1;
    this.earFlutterAmplitude = 0.35;
    this.earFlutterSpeed = 2.2;
  }

  setState(nextState) {
    const allowed = ['idle'];
    if (!allowed.includes(nextState)) return;
    this.state = nextState;
  }

  update(dt) {
    const bones = this.giraffe?.bones;
    const root = bones?.spine_base;
    if (!bones || !root) return;

    this.time += dt;

    if (this.giraffe.state && this.giraffe.state !== this.state) {
      this.setState(this.giraffe.state);
    }

    switch (this.state) {
      case 'idle':
      default:
        this._updateIdle(dt, bones, root);
        break;
    }
  }

  _updateIdle(dt, bones, root) {
    this.idlePhase += dt;

    const vertical = Math.sin(this.idlePhase * this.headBobSpeed) * this.headBobAmplitude;
    const roll = Math.sin(this.idlePhase * 0.5) * 0.05;
    root.position.set(0, this.baseHeight + vertical, 0);
    root.rotation.set(0, 0, roll);

    this._applyNeckSway(bones, this.idlePhase);
    this._applyHeadBob(bones, this.idlePhase);
    this._applyTailSway(bones, this.idlePhase);
    this._applyEars(bones, this.idlePhase);
  }

  _applyNeckSway(bones, t) {
    const sway = Math.sin(t * this.neckSwaySpeed) * this.neckSwayAmplitude;
    let falloff = 1.0;

    for (let i = 0; i <= 6; i += 1) {
      const key = `neck_${i}`;
      const bone = bones[key];
      if (!bone) continue;

      bone.rotation.x = 0.35 - sway * 0.4 * falloff;
      bone.rotation.y = sway * 0.3 * falloff;
      bone.rotation.z = Math.sin(t * this.neckSwaySpeed * 0.7 + i * 0.15) * 0.05 * falloff;

      falloff *= 0.82;
    }
  }

  _applyHeadBob(bones, t) {
    const head = bones.head;
    const jaw = bones.jaw;
    if (!head) return;

    const bob = Math.sin(t * this.headBobSpeed * 1.2) * 0.08;
    const yaw = Math.sin(t * 0.35) * 0.18;
    head.rotation.x = -0.18 + bob;
    head.rotation.y = yaw;
    head.rotation.z = Math.sin(t * 0.6 + 1.3) * 0.05;

    if (jaw) {
      jaw.rotation.x = -0.08 + Math.sin(t * 1.6 + 0.4) * 0.03;
    }
  }

  _applyTailSway(bones, t) {
    const keys = ['tail_0', 'tail_1', 'tail_tip'];
    let falloff = 1.0;
    const sway = Math.sin(t * this.tailSwaySpeed) * this.tailSwayAmplitude;

    keys.forEach((key, idx) => {
      const bone = bones[key];
      if (!bone) return;

      bone.rotation.y = sway * falloff;
      bone.rotation.x = Math.cos(t * this.tailSwaySpeed * 0.8 + idx * 0.3) * 0.08 * falloff;
      bone.rotation.z = Math.sin(t * this.tailSwaySpeed * 0.6 + idx * 0.35) * 0.06 * falloff;
      falloff *= 0.72;
    });
  }

  _applyEars(bones, t) {
    const earLeft = bones.ear_left;
    const earRight = bones.ear_right;

    const flutter = Math.sin(t * this.earFlutterSpeed) * this.earFlutterAmplitude;
    if (earLeft) {
      earLeft.rotation.z = flutter;
      earLeft.rotation.y = Math.sin(t * 0.9) * 0.08;
    }
    if (earRight) {
      earRight.rotation.z = -flutter;
      earRight.rotation.y = -Math.sin(t * 0.9) * 0.08;
    }
  }
}
