// src/animals/Gorilla/GorillaLocomotion.js

/**
 * GorillaLocomotion
 *
 * Simple idle and knuckle-walking animation tuned for the GorillaCreature.
 * - Idle: breathing, micro sways, curious head turns.
 * - Walk: weighty forward lean with arm/leg swing pairs.
 */
export class GorillaLocomotion {
  constructor(gorilla) {
    this.gorilla = gorilla;
    this.state = 'idle';
    this.time = 0;
    this.walkPhase = 0;
    this.baseHeight = 0.75;
    this.walkCycleSpeed = 1.8;

    this._stateTimer = 0;
  }

  update(dt) {
    const bones = this.gorilla?.bones;
    const root = bones?.spine_base;
    if (!bones || !root) return;

    this.time += dt;
    this._stateTimer -= dt;

    if (this._stateTimer <= 0) {
      if (this.state === 'idle') {
        this.state = Math.random() > 0.6 ? 'walk' : 'idle';
        this._stateTimer = this.state === 'walk' ? 4 + Math.random() * 3 : 3 + Math.random() * 2;
      } else {
        this.state = 'idle';
        this._stateTimer = 3 + Math.random() * 2;
      }
      if (this.gorilla.setState) this.gorilla.setState(this.state);
    }

    if (this.state === 'walk') {
      this._updateWalk(dt, bones, root);
    } else {
      this._updateIdle(dt, bones, root);
    }
  }

  _updateIdle(dt, bones, root) {
    const phase = this.time;
    const breathe = Math.sin(phase * 1.1) * 0.015;
    const sway = Math.sin(phase * 0.7) * 0.02;

    root.position.set(0, this.baseHeight + breathe, 0);
    root.rotation.set(0, 0, sway);

    this._applySpine(bones, phase, 0.05);
    this._applyHead(bones, phase, 0.08);
    this._applyArms(bones, phase, 0.15);
    this._applyLegs(bones, phase, 0.12);
  }

  _updateWalk(dt, bones, root) {
    const TWO_PI = Math.PI * 2;
    this.walkPhase = (this.walkPhase + dt * this.walkCycleSpeed) % TWO_PI;

    const vertical = Math.sin(this.walkPhase * 2.0) * 0.03;
    const roll = Math.sin(this.walkPhase) * 0.04;
    root.position.set(0, this.baseHeight - 0.05 + vertical, 0);
    root.rotation.set(0.05, 0, roll);

    this._applyWalkGait(bones, this.walkPhase);
    this._applySpine(bones, this.walkPhase, 0.08);
    this._applyHead(bones, this.walkPhase, 0.05);
  }

  _applySpine(bones, t, amplitude) {
    const spineMid = bones.spine_mid;
    const spineNeck = bones.spine_neck;
    const head = bones.head;
    if (spineMid) {
      spineMid.rotation.x = amplitude * 0.5 * Math.sin(t * 1.2);
      spineMid.rotation.y = amplitude * 0.4 * Math.sin(t * 0.8);
    }
    if (spineNeck) {
      spineNeck.rotation.x = 0.1 + amplitude * Math.sin(t * 1.4);
      spineNeck.rotation.y = amplitude * 0.6 * Math.sin(t * 0.9 + 0.5);
    }
    if (head) {
      head.rotation.x = -0.12 + amplitude * -0.6 * Math.sin(t * 1.1);
      head.rotation.y = amplitude * 0.8 * Math.sin(t * 0.7 + 1.2);
    }
  }

  _applyHead(bones, t, amplitude) {
    const head = bones.head;
    if (!head) return;
    head.rotation.y += amplitude * 0.5 * Math.sin(t * 0.9);
    head.rotation.x += amplitude * -0.3 * Math.sin(t * 1.3 + 0.5);
  }

  _applyArms(bones, t, amplitude) {
    const lUpper = bones.arm_left_upper;
    const lLower = bones.arm_left_lower;
    const rUpper = bones.arm_right_upper;
    const rLower = bones.arm_right_lower;

    const swing = Math.sin(t) * amplitude;
    const counter = Math.sin(t + Math.PI) * amplitude;

    if (lUpper) lUpper.rotation.x = -0.6 + swing;
    if (lLower) lLower.rotation.x = -0.5 + swing * 0.6;
    if (rUpper) rUpper.rotation.x = -0.6 + counter;
    if (rLower) rLower.rotation.x = -0.5 + counter * 0.6;
  }

  _applyLegs(bones, t, amplitude) {
    const lUpper = bones.leg_left_upper;
    const lLower = bones.leg_left_lower;
    const rUpper = bones.leg_right_upper;
    const rLower = bones.leg_right_lower;

    const swing = Math.sin(t + Math.PI) * amplitude;
    const counter = Math.sin(t) * amplitude;

    if (lUpper) lUpper.rotation.x = 0.4 + swing;
    if (lLower) lLower.rotation.x = 0.2 + swing * 0.5;
    if (rUpper) rUpper.rotation.x = 0.4 + counter;
    if (rLower) rLower.rotation.x = 0.2 + counter * 0.5;
  }

  _applyWalkGait(bones, phase) {
    const stride = 0.45;
    const armSwing = Math.sin(phase) * stride;
    const legSwing = Math.sin(phase + Math.PI) * stride;

    const lUpperArm = bones.arm_left_upper;
    const lLowerArm = bones.arm_left_lower;
    const rUpperArm = bones.arm_right_upper;
    const rLowerArm = bones.arm_right_lower;

    const lUpperLeg = bones.leg_left_upper;
    const lLowerLeg = bones.leg_left_lower;
    const rUpperLeg = bones.leg_right_upper;
    const rLowerLeg = bones.leg_right_lower;

    if (lUpperArm) lUpperArm.rotation.x = -0.8 + armSwing;
    if (lLowerArm) lLowerArm.rotation.x = -0.4 + armSwing * 0.4;
    if (rUpperArm) rUpperArm.rotation.x = -0.8 + Math.sin(phase + Math.PI) * stride;
    if (rLowerArm) rLowerArm.rotation.x = -0.4 + Math.sin(phase + Math.PI) * stride * 0.4;

    if (lUpperLeg) lUpperLeg.rotation.x = 0.5 + legSwing * 0.8;
    if (lLowerLeg) lLowerLeg.rotation.x = 0.25 + legSwing * 0.5;
    if (rUpperLeg) rUpperLeg.rotation.x = 0.5 + Math.sin(phase) * stride * 0.8;
    if (rLowerLeg) rLowerLeg.rotation.x = 0.25 + Math.sin(phase) * stride * 0.5;
  }
}
