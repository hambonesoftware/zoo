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
    this.state = 'idle';   // 'idle' | 'walk' | 'curious' | 'wander' | 'drink' | 'excited'

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

    // Environment / enclosure settings
    this.environment = null;
    this.enclosureCenter = new THREE.Vector3();
    this.enclosureRadius = 8.0;
    this.pondCenter = new THREE.Vector3();
    this.pondRadius = 1.4;
    this.boundarySoftRadius = 0.75; // fraction of enclosure at which to steer back

    // Drinking behaviour timers
    this.lastDrinkTime = -Infinity;
    this.drinkCooldown = 25; // seconds between drinks
    this.drinkDuration = 6.0;
    this.drinkApproachDistance = 0.8; // how close to get to pond edge before posing

    // Excited behaviour timers
    this.lastExcitedTime = -Infinity;
    this.excitedCooldown = 14; // minimum seconds between excited bursts
    this.excitedDuration = 3.5;
    this.excitedChance = 0.12; // probability over cooldown window to trigger

    // Global time tracker
    this._time = 0;

    // Reusable temp vectors
    this.tempVec = new THREE.Vector3();
    this.tempVec2 = new THREE.Vector3();

    // Internal timers
    this._stateTime = 0;

    // For transitional soft-start / soft-stop of walking
    this.walkBlend = 0; // 0=not walking, 1=fully walking

    // Pathing helpers
    this.obstaclePadding = 0.6;
    this.lookAheadDistance = 2.3;

    // Curiosity: how much the elephant is sniffing around
    this.curiousBlend = 0;

    // Secondary motion springs for trunk/ears/tail
    this._spring = {
      trunk: { angle: 0, velocity: 0 },
      ears:  { angle: 0, velocity: 0 },
      tail:  { angle: 0, velocity: 0 }
    };
  }

  setEnvironment(env) {
    this.environment = env || null;

    if (!env) return;

    if (env.enclosureCenter) this.enclosureCenter.copy(env.enclosureCenter);
    if (typeof env.enclosureRadius === 'number') this.enclosureRadius = env.enclosureRadius;
    if (env.pondCenter) this.pondCenter.copy(env.pondCenter);
    if (typeof env.pondRadius === 'number') this.pondRadius = env.pondRadius;
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
    this.ensureDirectionNormalized();

    // Advance time
    this._time += dt;
    this._idleTime += dt;
    this._stateTime += dt;

    // Consider spontaneous state changes (excited/drink) when roaming
    if (this.state !== 'drink' && this.state !== 'excited') {
      this.maybeTriggerExcitement(dt);
      this.maybeTriggerDrink(root);
    }

    // Lerp walkBlend toward 1 if walking, otherwise toward 0
    const walkTarget = (this.state === 'walk' || this.state === 'wander' || this.state === 'drink') ? 1 : 0;
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
      case 'drink':
        this.updateDrink(dt, root, mesh, bones);
        break;
      case 'excited':
        this.updateExcited(dt, root, mesh, bones);
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

    if (newState === 'drink') {
      this.lastDrinkTime = this._time;
    }
    if (newState === 'excited') {
      this.lastExcitedTime = this._time;
    }

    if (this.elephant && typeof this.elephant.setState === 'function') {
      this.elephant.setState(newState);
    }
  }

  /**
   * @returns {string} current locomotion state
   */
  getState() {
    return this.state;
  }

  maybeTriggerDrink(root) {
    if (!this.environment) return;

    const timeSinceDrink = this._time - this.lastDrinkTime;
    if (timeSinceDrink < this.drinkCooldown) return;

    this.tempVec.copy(root.position).sub(this.pondCenter);
    this.tempVec.y = 0;
    const distance = this.tempVec.length();
    const drinkZone = this.pondRadius + 2.2;

    if (distance < drinkZone) {
      this.setState('drink');
    }
  }

  maybeTriggerExcitement(dt = 0) {
    const timeSinceExcited = this._time - this.lastExcitedTime;
    if (timeSinceExcited < this.excitedCooldown) return;

    // Small random chance each second once cooldown elapsed
    const perFrameChance = (this.excitedChance / this.excitedCooldown) * Math.max(dt, 0.016);
    if (Math.random() < perFrameChance) {
      this.setState('excited');
    }
  }

  computeAvoidance(position, includeWater = true) {
    const steering = new THREE.Vector3();

    if (!this.environment) return steering;

    const softBoundary = this.enclosureRadius * this.boundarySoftRadius;
    const offset = this.tempVec.copy(position).sub(this.enclosureCenter);
    offset.y = 0;
    const distanceFromCenter = offset.length();
    if (distanceFromCenter > softBoundary) {
      const pull = offset.clone().multiplyScalar(-1).normalize();
      const strength = Math.min(1, (distanceFromCenter - softBoundary) / Math.max(softBoundary, 0.0001));
      steering.add(pull.multiplyScalar(strength * 0.9));
    }

    const obstacles = this.environment.obstacles || [];
    obstacles.forEach((obs) => {
      if (obs.type === 'water' && (!includeWater || this.state === 'drink')) return;

      const obsPos = obs.position || this.tempVec2.set(0, 0, 0);
      const toObstacle = this.tempVec2.copy(position).sub(obsPos);
      toObstacle.y = 0;
      const distance = toObstacle.length();
      const radius = (obs.radius || 0.6) + this.obstaclePadding;

      // Look slightly ahead so we steer early
      const future = this.tempVec.copy(position)
        .add(this.direction.clone().setY(0).normalize().multiplyScalar(this.lookAheadDistance));
      const futureDistance = future.sub(obsPos).setY(0).length();
      const effectiveDist = Math.min(distance, futureDistance);

      if (effectiveDist < radius) {
        const strength = (1 - (effectiveDist / radius)) * (obs.weight || 1);
        const away = toObstacle.lengthSq() < 0.0001 ? this.direction.clone().negate() : toObstacle.normalize();
        steering.add(away.multiplyScalar(strength));
      }
    });

    return steering;
  }

  moveForward(root, speed, dt, maxDistance = null) {
    const step = speed * dt;
    const clampedStep = maxDistance !== null ? Math.min(step, maxDistance) : step;
    this.ensureDirectionNormalized();
    root.position.addScaledVector(this.direction, clampedStep);
  }

  keepWithinBounds(root) {
    const afterMove = this.tempVec.copy(root.position).sub(this.enclosureCenter);
    afterMove.y = 0;
    const distAfter = afterMove.length();
    if (distAfter > this.enclosureRadius) {
      afterMove.setLength(Math.max(0, this.enclosureRadius - 0.1));
      root.position.set(
        this.enclosureCenter.x + afterMove.x,
        root.position.y,
        this.enclosureCenter.z + afterMove.z
      );
      this.turnToward(afterMove.clone().multiplyScalar(-1).normalize(), 0.016);
    }
  }

  ensureDirectionNormalized() {
    this.direction.y = 0;
    if (this.direction.lengthSq() < 0.0001) {
      this.direction.set(0, 0, 1);
    }
    this.direction.normalize();
  }

  // -----------------------------
  // WANDER STATE
  // -----------------------------

  /**
   * Wander: the elephant ambles steadily in its current direction, slowly
   * turning over time with some noise. Legs follow a gait; trunk & ears sway.
   */
  updateWander(dt, root, mesh, bones) {
    const drift = this.tempVec2.set(
      (Math.random() - 0.5) * 0.35,
      0,
      (Math.random() - 0.5) * 0.35
    );

    const avoidance = this.computeAvoidance(root.position, true);
    const desiredDirection = this.direction.clone()
      .add(drift.multiplyScalar(0.3))
      .add(avoidance);

    this.turnToward(desiredDirection, dt, 2.6);

    const forwardSpeed = this.walkSpeed * 0.7;
    this.moveForward(root, forwardSpeed, dt);
    this.keepWithinBounds(root);

    // Body bobbing
    const time = this._idleTime * 1.4;
    const bob = Math.sin((time + this.gaitPhase * Math.PI * 2) * 2.0) * 0.05;
    root.position.y = this.baseHeight + bob;

    // Lean slightly into gait
    const leanForward = Math.sin(this.gaitPhase * Math.PI * 2) * 0.05;
    const leanSide = Math.sin(this.gaitPhase * Math.PI * 4) * 0.03;
    const yaw = Math.atan2(this.direction.x, this.direction.z);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, yaw, 6.0, dt);
    root.rotation.x = leanForward;
    root.rotation.z = leanSide;

    // Apply walk pose for legs
    this.applyLegWalk(bones, this.gaitPhase);

    // Trunk & ears sway according to walk
    this.applyTrunkWalk(bones, this._idleTime, this.gaitPhase);
    this.applyEarWalk(bones, this._idleTime, this.gaitPhase);
  }

  updateDrink(dt, root, mesh, bones) {
    const approach = this.tempVec.copy(this.pondCenter).sub(root.position);
    approach.y = 0;
    const distance = approach.length();
    if (distance > 0.0001) {
      approach.normalize();
    }

    const avoidance = this.computeAvoidance(root.position, false);
    const desiredDir = approach.clone().add(avoidance.multiplyScalar(0.8));
    this.turnToward(desiredDir, dt, 3.3);

    // Approach the pond until close enough
    const targetDist = this.pondRadius + this.drinkApproachDistance;
    if (distance > targetDist) {
      const speed = this.walkSpeed * 0.55;
      const remaining = Math.max(0, distance - targetDist);
      this.moveForward(root, speed, dt, remaining);
      this.keepWithinBounds(root);

      const bob = Math.sin((this._idleTime + this.gaitPhase * Math.PI * 2) * 2.0) * 0.04;
      root.position.y = this.baseHeight + bob;
      root.rotation.y = THREE.MathUtils.damp(
        root.rotation.y,
        Math.atan2(this.direction.x, this.direction.z),
        6.0,
        dt
      );
      root.rotation.x = -0.05;

      this.applyLegWalk(bones, this.gaitPhase);
      this.applyTrunkWalk(bones, this._idleTime, this.gaitPhase * 0.5);
      this.applyEarWalk(bones, this._idleTime, this.gaitPhase * 0.5);
      return;
    }

    // Drinking pose
    const settle = Math.min(1, this._stateTime / 1.2);
    const head = bones['head'];
    const neck = bones['spine_neck'];
    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip = bones['trunk_tip'];

    root.position.y = this.baseHeight - 0.08 * settle;
    root.rotation.x = -0.2 * settle;

    this.applyLegIdle(bones, this._idleTime * 0.5);

    if (neck) neck.rotation.x = -0.45 * settle;
    if (head) head.rotation.x = -0.25 * settle;

    const trunkDip = -0.8 * settle;
    if (trunkBase) trunkBase.rotation.x = trunkDip * 0.3;
    if (trunkMid1) trunkMid1.rotation.x = trunkDip * 0.6;
    if (trunkMid2) trunkMid2.rotation.x = trunkDip * 0.9;
    if (trunkTip) {
      trunkTip.rotation.x = trunkDip * 1.2;
      trunkTip.rotation.y = Math.sin(this._stateTime * 1.8) * 0.05;
    }

    // Gentle ear flare while paused
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];
    const flare = 0.18 * settle;
    if (earLeft) earLeft.rotation.y = flare;
    if (earRight) earRight.rotation.y = -flare;

    if (this._stateTime > this.drinkDuration) {
      this.setState('wander');
    }
  }

  updateExcited(dt, root, mesh, bones) {
    const t = this._stateTime;
    const bounce = Math.sin(t * 6.0) * 0.08;
    root.position.y = this.baseHeight + 0.18 + bounce;
    root.rotation.x = Math.sin(t * 4.0) * 0.1;
    root.rotation.z = Math.sin(t * 5.0) * 0.08;

    const head = bones['head'];
    const neck = bones['spine_neck'];
    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip = bones['trunk_tip'];
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];

    if (neck) neck.rotation.x = -0.25;
    if (head) {
      head.rotation.x = -0.2;
      head.rotation.y = Math.sin(t * 3.0) * 0.25;
    }

    const wave = Math.sin(t * 5.5) * 0.5;
    const lift = -0.9;
    if (trunkBase) trunkBase.rotation.x = lift * 0.25;
    if (trunkMid1) trunkMid1.rotation.x = lift * 0.5;
    if (trunkMid2) {
      trunkMid2.rotation.x = lift * 0.8;
      trunkMid2.rotation.y = wave * 0.4;
    }
    if (trunkTip) {
      trunkTip.rotation.x = lift * 1.0;
      trunkTip.rotation.y = wave * 0.6;
    }

    const flare = 0.3 + Math.sin(t * 7.0) * 0.1;
    if (earLeft) earLeft.rotation.y = flare;
    if (earRight) earRight.rotation.y = -flare;

    this.applyLegIdle(bones, this._idleTime * 1.8);

    if (this._stateTime > this.excitedDuration) {
      this.setState('wander');
    }
  }

  turnToward(targetDir, dt, turnRate = 3.0) {
    if (!targetDir) return;

    const desired = targetDir.clone();
    desired.y = 0;
    if (desired.lengthSq() < 0.0001) return;

    desired.normalize();
    this.ensureDirectionNormalized();

    const currentYaw = Math.atan2(this.direction.x, this.direction.z);
    const targetYaw = Math.atan2(desired.x, desired.z);
    let delta = targetYaw - currentYaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const maxTurn = Math.max(0.0001, turnRate * dt);
    delta = THREE.MathUtils.clamp(delta, -maxTurn, maxTurn);

    const newYaw = currentYaw + delta;
    this.direction.set(Math.sin(newYaw), 0, Math.cos(newYaw));
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
    const turning = Math.sin(this.gaitPhase * TWO_PI * 0.7) * this.walkBlend;

    // Spring parameters (softened to reduce snap)
    const stiffness = 10.0;
    const damping = 3.2;

    // Compute target offsets for trunk, ears, tail
    const trunkTarget = forwardVel * 0.55 + turning * 0.35;
    const earsTarget = forwardVel * 0.65 + turning * 0.35;
    const tailTarget = forwardVel * -0.75 + turning * 0.4;

    // --- Trunk spring ---
    {
      const s = this._spring.trunk;
      const acc = (trunkTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle = THREE.MathUtils.clamp(s.angle + s.velocity * dt, -0.35, 0.35);

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
      s.angle = THREE.MathUtils.clamp(s.angle + s.velocity * dt, -0.28, 0.28);
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
      s.angle = THREE.MathUtils.clamp(s.angle + s.velocity * dt, -0.32, 0.32);

      if (tailBase) tailBase.rotation.y += s.angle * 0.6;
      if (tailMid) tailMid.rotation.y += s.angle * 0.8;
      if (tailTip) tailTip.rotation.y += s.angle * 1.0;
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

    const avoidance = this.computeAvoidance(root.position, true);
    const desiredDirection = this.direction.clone().add(avoidance);
    this.turnToward(desiredDirection, dt, 3.0);

    // Body bobbing and weight shift: more pronounced than idle
    const bob = Math.sin((this.gaitPhase * TWO_PI) * 2.0) * 0.07 * this.walkBlend;
    const sway = Math.sin((this.gaitPhase + 0.25) * TWO_PI) * 0.035 * this.walkBlend;
    root.position.y = this.baseHeight + bob;
    root.position.x = sway;

    // Forward motion: accelerate/decelerate via walkBlend
    const speed = this.walkSpeed * this.walkBlend;
    this.moveForward(root, speed, dt);
    this.keepWithinBounds(root);

    const yaw = Math.atan2(this.direction.x, this.direction.z);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, yaw, 6.0, dt);

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
    const stance = (p) => Math.max(0, Math.cos(p * TWO_PI)) ** 2;
    const lift = (p) => Math.max(0, Math.sin(p * TWO_PI)) ** 1.5;

    // Front Left
    if (legFLU) legFLU.rotation.x = swing(phaseFL, amplitudeFront * 0.95) - stance(phaseFL) * amplitudeFront * 0.18;
    if (legFLL) legFLL.rotation.x = knee(phaseFL, kneeBendFactor) + lift(phaseFL) * 0.1;

    // Back Left
    if (legBLU) legBLU.rotation.x = swing(phaseBL, amplitudeBack) - stance(phaseBL) * amplitudeBack * 0.22;
    if (legBLL) legBLL.rotation.x = knee(phaseBL, kneeBendFactor * 1.1) + lift(phaseBL) * 0.12;

    // Front Right
    if (legFRU) legFRU.rotation.x = swing(phaseFR, amplitudeFront) - stance(phaseFR) * amplitudeFront * 0.18;
    if (legFRL) legFRL.rotation.x = knee(phaseFR, kneeBendFactor) + lift(phaseFR) * 0.1;

    // Back Right
    if (legBRU) legBRU.rotation.x = swing(phaseBR, amplitudeBack * 1.05) - stance(phaseBR) * amplitudeBack * 0.24;
    if (legBRL) legBRL.rotation.x = knee(phaseBR, kneeBendFactor * 1.05) + lift(phaseBR) * 0.14;
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

    const sway = THREE.MathUtils.clamp(Math.sin(t * 1.0) * 0.32 + Math.sin(phase * Math.PI * 1.4) * 0.22, -0.45, 0.45);
    const dip  = THREE.MathUtils.clamp(Math.sin(t * 0.85 + 1.0) * 0.24, -0.32, 0.32);

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
    const gaitFlap = Math.sin(phase * 1.2) * 0.14;
    const idleFlap = Math.sin(t * 0.65) * 0.06;

    const totalLeft = THREE.MathUtils.clamp(gaitFlap + idleFlap, -0.22, 0.22);
    const totalRight = THREE.MathUtils.clamp(gaitFlap + idleFlap * 0.9, -0.22, 0.22);

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
