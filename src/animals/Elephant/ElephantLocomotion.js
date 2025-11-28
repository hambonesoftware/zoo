// src/animals/Elephant/ElephantLocomotion.js

import * as THREE from 'three';

/**
 * ElephantLocomotion
 *
 * Natural, heavy quadruped locomotion for the ElephantCreature:
 * - Slow, weighty walk with pronounced body bob
 * - Lateral-sequence gait (left side, then right side)
 * - Trunk sway and ear flapping, more noticeable while walking
 * - Soft idle breathing with subtle trunk/ear motion
 *
 * Expected bone keys (any missing ones are safely ignored):
 * - 'spine_base' (root / hips)
 * - 'spine_mid', 'spine_neck', 'head'
 * - 'leg_front_L_upper', 'leg_front_L_lower'
 * - 'leg_front_R_upper', 'leg_front_R_lower'
 * - 'leg_back_L_upper', 'leg_back_L_lower'
 * - 'leg_back_R_upper', 'leg_back_R_lower'
 * - 'trunk_base', 'trunk_mid1', 'trunk_mid2', 'trunk_tip'
 * - 'ear_left', 'ear_right'
 * - 'tail_base', 'tail_mid', 'tail_tip'
 */
export class ElephantLocomotion {
  constructor(elephant) {
    this.elephant = elephant;    

    // Finite state machine for high-level motion: idle, walking, curiosity, etc.
    this.state = 'idle';   // 'idle' | 'walk' | 'curious' | 'wander'

    // Walk cycle phase: 0..1 (or 0..2π in radians) for the stepping pattern
    this.gaitPhase = 0;

    // Base speed. Over time we can tween this for acceleration/deceleration
    this.walkSpeed = 0.6; // world units per second (adjust to taste)

    // Base height offset for the root (hips). Elephant body is big/heavy;
    // we keep it fairly low and bob it gently up and down while walking.
    this.baseHeight = 1.0;

    // Timer for idle breathing / subtle motion
    this._idleTime = 0;

    // Simple 'wander' heading these elephants walk in, if desired
    this.direction = new THREE.Vector3(0, 0, 1);

    // Reusable temp vector
    this.tempVec = new THREE.Vector3();

    // Internal timers
    this._stateTime = 0;

    // For transitional soft-start / soft-stop of walking
    this.walkBlend = 0; // 0=not walking, 1=fully walking

    // Curiosity: how much the elephant is sniffing around
    this.curiousBlend = 0;

    // Secondary motion springs for trunk/ears/tail
    this._spring = {
      trunk: { angle: 0, velocity: 0 },
      ears:  { angle: 0, velocity: 0 },
      tail:  { angle: 0, velocity: 0 }
    };
  }

  /**
   * Main update entry. Call once per frame with dt (seconds).
   */
  update(dt) {
    if (!this.elephant || !this.elephant.bones) return;

    const bones = this.elephant.bones;
    const root = bones['spine_base'];
    const mesh = this.elephant.mesh;

    if (!root || !mesh) return;

    // Advance time
    this._idleTime += dt;
    this._stateTime += dt;

    // Lerp walkBlend toward 1 if walking, otherwise toward 0
    const walkTarget = (this.state === 'walk' || this.state === 'wander') ? 1 : 0;
    this.walkBlend = THREE.MathUtils.damp(this.walkBlend, walkTarget, 2.5, dt);

    // Lerp curiosity blend similarly (for 'curious' state)
    const curiousTarget = (this.state === 'curious') ? 1 : 0;
    this.curiousBlend = THREE.MathUtils.damp(this.curiousBlend, curiousTarget, 2.0, dt);

    // Gait phase: only advance when walking/wandering
    if (this.walkBlend > 0.001) {
      const phaseSpeed = this.walkSpeed * 1.3; // scales stepping frequency
      this.gaitPhase = (this.gaitPhase + dt * phaseSpeed) % 1.0;
    }

    // Apply the correct locomotion behavior for each state
    switch (this.state) {
      case 'wander':
        this.updateWander(dt, root, mesh, bones);
        break;
      case 'curious':
        this.updateCurious(dt, root, bones);
        break;
      case 'walk':
        this.updateWalk(dt, root, mesh, bones);
        break;
      case 'idle':
      default:
        this.updateIdle(dt, root, bones);
        break;
    }

    // Apply simple secondary motion springs to trunk/ears/tail
    this.applySecondaryMotion(dt, bones);
  }

  /**
   * Set locomotion state externally, e.g. 'idle' or 'walk'.
   */
  setState(newState) {
    if (newState === this.state) return;
    this.state = newState;
    // Reset state timers or blends if necessary
    this._stateTime = 0;
  }

  /**
   * @returns {string} current locomotion state
   */
  getState() {
    return this.state;
  }

  // -----------------------------
  // WANDER STATE
  // -----------------------------

  /**
   * Wander: the elephant ambles steadily in its current direction, slowly
   * turning over time with some noise. Legs follow a gait; trunk & ears sway.
   */
  updateWander(dt, root, mesh, bones) {
    // Basic wandering logic: gently rotate direction vector over time
    const turnSpeed = 0.4; // rad/s for wandering
    const noise = (Math.random() - 0.5) * 0.3; // some randomness
    const turnAngle = turnSpeed * dt * noise;
    this.rotateDirection(turnAngle);

    // Move root along direction
    const forwardSpeed = this.walkSpeed * 0.7;
    this.tempVec.copy(this.direction).multiplyScalar(forwardSpeed * dt);
    root.position.add(this.tempVec);

    // Body bobbing
    const time = this._idleTime * 1.4;
    const bob = Math.sin((time + this.gaitPhase * Math.PI * 2) * 2.0) * 0.05;
    root.position.y = this.baseHeight + bob;

    // Lean slightly into gait
    const leanForward = Math.sin(this.gaitPhase * Math.PI * 2) * 0.05;
    const leanSide = Math.sin(this.gaitPhase * Math.PI * 4) * 0.03;
    root.rotation.x = leanForward;
    root.rotation.z = leanSide;

    // Apply walk pose for legs
    this.applyLegWalk(bones, this.gaitPhase);

    // Trunk & ears sway according to walk
    this.applyTrunkWalk(bones, this._idleTime, this.gaitPhase);
    this.applyEarWalk(bones, this._idleTime, this.gaitPhase);
  }

  rotateDirection(angle) {
    // Rotate direction vector around Y axis by `angle`
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = this.direction.x;
    const z = this.direction.z;
    this.direction.x = x * cos - z * sin;
    this.direction.z = x * sin + z * cos;
    this.direction.normalize();
  }

  turnToward(targetDir, dt) {
    // Smoothly turn current direction toward target in XZ
    const currentAngle = Math.atan2(this.direction.z, this.direction.x);
    const targetAngle = Math.atan2(targetDir.z, targetDir.x);
    let diff = targetAngle - currentAngle;

    // Wrap to [-π, π]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    const maxTurn = 1.2 * dt; // max turn speed
    const clamped = Math.max(-maxTurn, Math.min(maxTurn, diff));

    this.rotateDirection(clamped);
  }

  // -----------------------------
  // CURIOUS STATE
  // -----------------------------

  /**
   * Curious: Elephant stands mostly in place, perhaps shifting its weight,
   * lightly swaying trunk and ears, sometimes looking around.
   */
  updateCurious(dt, root, bones) {
    // Subtle breathing bob
    const t = this._idleTime;
    const bob = Math.sin(t * 1.3) * 0.03;
    root.position.y = this.baseHeight + bob;

    // Slight side-to-side shifting
    const swaySide = Math.sin(t * 0.9) * 0.04;
    root.rotation.z = swaySide;

    // Gentle forward/back tilt
    const pitch = Math.sin(t * 0.7) * 0.05;
    root.rotation.x = pitch;

    // Look around slowly
    const yaw = Math.sin(t * 0.45) * 0.25;
    const head = bones['head'];
    const neck = bones['spine_neck'];
    if (neck) neck.rotation.y = yaw * 0.4;
    if (head) head.rotation.y = yaw * 0.6;

    // Use existing trunk & ear idle/walk patterns but with stronger curiousBlend
    this.applyTrunkIdle(bones, t);
    this.applyEarIdle(bones, t);

    // Slight neck/head extra motion for curiosity
    if (neck) {
      neck.rotation.x = Math.sin(t * 0.8) * 0.05;
    }
    if (head) {
      head.rotation.x = Math.sin(t * 0.8 + 1.0) * 0.08;
    }

    // Ears flick slightly during curiosity
    const earLeft  = bones['ear_left'];
    const earRight = bones['ear_right'];
    const flap = 0.15 * Math.sin(this._stateTime * 3.0);
    if (earLeft)  earLeft.rotation.y = flap;
    if (earRight) earRight.rotation.y = -flap;
  }

  /**
   * Apply damped spring secondary motion to the trunk, ears and tail.
   * This introduces a lagging motion that follows the elephant's
   * forward velocity and turning rate.  The springs integrate simple
   * physics each frame.
   */
  applySecondaryMotion(dt, bones) {
    const TWO_PI = Math.PI * 2;
    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip = bones['trunk_tip'];
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];
    const tailBase = bones['tail_base'];
    const tailMid = bones['tail_mid'];
    const tailTip = bones['tail_tip'];

    // Determine a simple "forward velocity" from walkBlend + gait
    const forwardVel = this.walkBlend * this.walkSpeed;
    const turning = Math.sin(this.gaitPhase * TWO_PI) * this.walkBlend;

    // Spring parameters
    const stiffness = 18.0;
    const damping = 4.5;

    // Compute target offsets for trunk, ears, tail
    const trunkTarget = forwardVel * 0.6 + turning * 0.4;
    const earsTarget = forwardVel * 0.8 + turning * 0.4;
    const tailTarget = forwardVel * -0.9 + turning * 0.5;

    // --- Trunk spring ---
    {
      const s = this._spring.trunk;
      const acc = (trunkTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle += s.velocity * dt;

      if (trunkBase) trunkBase.rotation.x += s.angle * 0.12;
      if (trunkMid1) trunkMid1.rotation.x += s.angle * 0.45;
      if (trunkMid2) trunkMid2.rotation.x += s.angle * 0.75;
      if (trunkTip) trunkTip.rotation.x += s.angle * 1.0;
    }

    // --- Ears spring ---
    {
      const s = this._spring.ears;
      const acc = (earsTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle += s.velocity * dt;
      // Apply symmetrical ear swing around Y axis (forward/back sway)
      const earLeft = bones['ear_left'];
      const earRight = bones['ear_right'];
      if (earLeft) earLeft.rotation.y += s.angle;
      if (earRight) earRight.rotation.y -= s.angle;
    }

    // --- Tail spring ---
    {
      const s = this._spring.tail;
      const acc = (tailTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle += s.velocity * dt;

      if (tailBase) tailBase.rotation.x += s.angle * 0.6;
      if (tailMid) tailMid.rotation.x += s.angle * 0.8;
      if (tailTip) tailTip.rotation.x += s.angle * 1.0;
    }
  }

  // -----------------------------
  // IDLE STATE
  // -----------------------------

  /**
   * Idle: elephant stands mostly still, breathing with small motions
   * in trunk, ears, and sometimes shifting weight.
   */
  updateIdle(dt, root, bones) {
    const t = this._idleTime;

    // Soft breathing bob
    const bob = Math.sin(t * 1.2) * 0.03;
    root.position.y = this.baseHeight + bob;

    // Subtle sway
    const sway = Math.sin(t * 0.7) * 0.02;
    root.rotation.z = sway;

    // Minor forward/back tilt
    const pitch = Math.sin(t * 0.5) * 0.03;
    root.rotation.x = pitch;

    // Legs: keep basically under the body in idle
    this.applyLegIdle(bones, t);

    // Trunk & ears in idle
    this.applyTrunkIdle(bones, t);
    this.applyEarIdle(bones, t);
  }

  /**
   * Basic idle leg pose with subtle micro-motion.
   */
  applyLegIdle(bones, t) {
    const legFLU = bones['leg_front_L_upper'];
    const legFLL = bones['leg_front_L_lower'];
    const legFRU = bones['leg_front_R_upper'];
    const legFRL = bones['leg_front_R_lower'];
    const legBLU = bones['leg_back_L_upper'];
    const legBLL = bones['leg_back_L_lower'];
    const legBRU = bones['leg_back_R_upper'];
    const legBRL = bones['leg_back_R_lower'];

    const micro = Math.sin(t * 1.5) * 0.05;

    if (legFLU) legFLU.rotation.x = 0.05 + micro * 0.4;
    if (legFLL) legFLL.rotation.x = -0.05 + micro * 0.4;

    if (legFRU) legFRU.rotation.x = 0.02 - micro * 0.3;
    if (legFRL) legFRL.rotation.x = -0.02 - micro * 0.3;

    if (legBLU) legBLU.rotation.x = -0.03 + micro * 0.5;
    if (legBLL) legBLL.rotation.x = 0.03 + micro * 0.4;

    if (legBRU) legBRU.rotation.x = -0.05 - micro * 0.5;
    if (legBRL) legBRL.rotation.x = 0.05 - micro * 0.4;
  }

  /**
   * Trunk idle motion: a lazy sway, somewhat slower and less intense.
   */
  applyTrunkIdle(bones, t) {
    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip = bones['trunk_tip'];

    const sway = Math.sin(t * 0.8) * 0.2;
    const dip  = Math.sin(t * 0.6) * 0.15;

    if (trunkBase) {
      trunkBase.rotation.y = sway * 0.35;
      trunkBase.rotation.x = dip * 0.45;
    }
    if (trunkMid1) {
      trunkMid1.rotation.y = sway * 0.6;
      trunkMid1.rotation.x = dip * 0.65;
    }
    if (trunkMid2) {
      trunkMid2.rotation.y = sway * 0.8;
      trunkMid2.rotation.x = dip * 0.85;
    }
    if (trunkTip) {
      trunkTip.rotation.y = sway * 1.0;
      trunkTip.rotation.x = dip * 1.05;
    }
  }

  applyEarIdle(bones, t) {
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];
    if (!earLeft && !earRight) return;

    // Build a slow base motion
    const baseFlap = Math.sin(t * 0.7) * 0.1;
    // Occasionally trigger a stronger flap
    const pulse = Math.max(0, Math.sin(t * 0.3)) ** 2; // 0..1
    const strongFlap = pulse * 0.25;

    const totalFlapLeft = baseFlap + strongFlap;
    const totalFlapRight = baseFlap + strongFlap * 0.9; // slight asymmetry

    if (earLeft) {
      // Rotate around local Y so ears sway forward/back
      earLeft.rotation.y = totalFlapLeft;
    }
    if (earRight) {
      earRight.rotation.y = -totalFlapRight;
    }
  }

  // -----------------------------
  // WALK STATE
  // -----------------------------
  updateWalk(dt, root, mesh, bones) {
    const TWO_PI = Math.PI * 2;

    // Body bobbing: more pronounced than idle
    const bob = Math.sin((this.gaitPhase * TWO_PI) * 2.0) * 0.07 * this.walkBlend;
    root.position.y = this.baseHeight + bob;

    // Forward motion: accelerate/decelerate via walkBlend
    const speed = this.walkSpeed * this.walkBlend;
    const dx = this.direction.x * speed * dt;
    const dz = this.direction.z * speed * dt;
    root.position.x += dx;
    root.position.z += dz;

    // Small forward lean at peak of step
    const leanForward = Math.sin(this.gaitPhase * TWO_PI) * 0.12 * this.walkBlend;
    // And side-to-side roll from weight shift
    const roll = Math.sin(this.gaitPhase * TWO_PI * 2) * 0.06 * this.walkBlend;
    root.rotation.x = leanForward;
    root.rotation.z = roll;

    // Leg stepping pattern (lateral sequence)
    this.applyLegWalk(bones, this.gaitPhase);

    // Trunk sway & dip while walking
    this.applyTrunkWalk(bones, this._idleTime, this.gaitPhase);

    // Ears: more active flapping when walking
    this.applyEarWalk(bones, this._idleTime, this.gaitPhase);
  }

  /**
   * Lateral-sequence walk:
   * - front left, rear left, front right, rear right
   * We approximate with phase offsets for each leg.
   */
  applyLegWalk(bones, phase) {
    const TWO_PI = Math.PI * 2;

    const legFLU = bones['leg_front_L_upper'];
    const legFLL = bones['leg_front_L_lower'];
    const legFRU = bones['leg_front_R_upper'];
    const legFRL = bones['leg_front_R_lower'];
    const legBLU = bones['leg_back_L_upper'];
    const legBLL = bones['leg_back_L_lower'];
    const legBRU = bones['leg_back_R_upper'];
    const legBRL = bones['leg_back_R_lower'];

    const amplitudeFront = 0.55;
    const amplitudeBack  = 0.65;
    const kneeBendFactor = 0.75;

    // Phase offsets for each leg
    const phaseFL = phase;
    const phaseBL = (phase + 0.25) % 1;
    const phaseFR = (phase + 0.5) % 1;
    const phaseBR = (phase + 0.75) % 1;

    const swing = (p, amp) => Math.sin(p * TWO_PI) * amp;
    const knee  = (p, factor) => Math.max(0, -Math.sin(p * TWO_PI)) * factor;

    // Front Left
    if (legFLU) legFLU.rotation.x = swing(phaseFL, amplitudeFront) * 0.9;
    if (legFLL) legFLL.rotation.x = knee(phaseFL, kneeBendFactor);

    // Back Left
    if (legBLU) legBLU.rotation.x = swing(phaseBL, amplitudeBack);
    if (legBLL) legBLL.rotation.x = knee(phaseBL, kneeBendFactor * 1.1);

    // Front Right
    if (legFRU) legFRU.rotation.x = swing(phaseFR, amplitudeFront);
    if (legFRL) legFRL.rotation.x = knee(phaseFR, kneeBendFactor);

    // Back Right
    if (legBRU) legBRU.rotation.x = swing(phaseBR, amplitudeBack) * 1.1;
    if (legBRL) legBRL.rotation.x = knee(phaseBR, kneeBendFactor * 1.05);
  }

  /**
   * Trunk movement while walking: larger sway and dip than idle,
   * and also correlated with gaitPhase.
   */
  applyTrunkWalk(bones, t, phase) {
    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip = bones['trunk_tip'];

    const sway = Math.sin(t * 1.5) * 0.4 + Math.sin(phase * Math.PI * 2) * 0.3;
    const dip  = Math.sin(t * 1.2 + 1.0) * 0.3;

    if (trunkBase) {
      trunkBase.rotation.y = sway * 0.55;
      trunkBase.rotation.x = dip * 0.35;
    }
    if (trunkMid1) {
      trunkMid1.rotation.y = sway * 0.7;
      trunkMid1.rotation.x = dip * 0.65;
    }
    if (trunkMid2) {
      trunkMid2.rotation.y = sway * 0.65;
      trunkMid2.rotation.x = dip * 0.9;
    }
    if (trunkTip) {
      trunkTip.rotation.y = sway * 0.55;
      trunkTip.rotation.x = dip * 1.1;
    }
  }

  applyEarWalk(bones, t, phase) {
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];
    if (!earLeft && !earRight) return;

    // A bit more energetic ear motion while walking
    const gaitFlap = Math.sin(phase * 2.0) * 0.18;
    const idleFlap = Math.sin(t * 0.9) * 0.08;

    const totalLeft = gaitFlap + idleFlap;
    const totalRight = gaitFlap + idleFlap * 0.9;

    if (earLeft) {
      earLeft.rotation.y = totalLeft;
    }
    if (earRight) {
      earRight.rotation.y = -totalRight;
    }
  }

  // -----------------------------
  // RESET (if you need it)
  // -----------------------------
  resetBones() {
    const bones = this.elephant.bones;
    const root = bones['spine_base'];

    if (root) {
      // Keep current heading (rotation.y) but reset pitch & roll
      root.rotation.set(0, root.rotation.y, 0);
      root.position.set(0, this.baseHeight, 0);
      root.updateMatrix();
    }

    Object.keys(bones).forEach(key => {
      if (key === 'spine_base') return;
      const b = bones[key];
      if (!b) return;
      b.rotation.set(0, 0, 0);
    });
  }
}
