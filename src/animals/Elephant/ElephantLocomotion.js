// src/animals/Elephant/ElephantLocomotion.js

import * as THREE from 'three';

/**
 * ElephantLocomotion
 *
 * Natural, heavy quadruped locomotion for the ElephantCreature:
 * - Slow, weighty walk with pronounced body bob
 * - Lateral-sequence gait (Back-Left -> Front-Left -> Back-Right -> Front-Right)
 * - Stance/Swing phase logic to ensure feet stay planted longer than they are in the air
 * - Trunk sway and ear flapping, more noticeable while walking
 * - Moves strictly in relative +Z direction of the root bone
 *
 * Expected bone keys (any missing ones are safely ignored):
 * - 'spine_base' (root / hips)
 * - 'spine_mid', 'spine_neck', 'head'
 * - Front legs: 'front_left_upper', 'front_left_lower', 'front_left_foot'
 * - Front legs: 'front_right_upper', 'front_right_lower', 'front_right_foot'
 * - Back legs:  'back_left_upper',  'back_left_lower',  'back_left_foot'
 * - Back legs:  'back_right_upper', 'back_right_lower', 'back_right_foot'
 * - 'trunk_base', 'trunk_mid1', 'trunk_mid2', 'trunk_tip'
 * - 'ear_left', 'ear_right'
 * - 'tail_base', 'tail_mid', 'tail_tip'
 */
export class ElephantLocomotion {
  constructor(elephant) {
    this.elephant = elephant;

    // Finite state machine for high-level motion
    this.state = 'idle';   // 'idle' | 'walk' | 'curious' | 'wander' | 'drink' | 'excited'

    // Walk cycle phase: 0..1
    this.gaitPhase = 0;

    // Base speed. We interpret this as "cycles per second" (step frequency).
    this.walkSpeed = 0.6;
    // Gait frequency (cycles per second). For a heavy animal we keep this fairly low.
    this._gaitFrequency = this.walkSpeed;

    // Direction (XZ plane). We'll move the root along +Z in its local space,
    // but we keep a stable "desired direction" for heading logic.
    this.direction = new THREE.Vector3(0, 0, 1);

    // Environment / enclosure settings
    this.environment = null;
    this.enclosureCenter = new THREE.Vector3();
    this.enclosureRadius = 8.0;
    this.pondCenter = new THREE.Vector3();
    this.pondRadius = 1.4;
    this.sizeScale = 1.0;
    this.boundarySoftRadius = 0.75;

    // Behaviour timers
    this.lastDrinkTime = -Infinity;
    this.drinkCooldown = 25;
    this.drinkDuration = 6.0;
    this.drinkApproachDistance = 0.8;

    this.lastExcitedTime = -Infinity;
    this.excitedCooldown = 14;
    this.excitedDuration = 3.5;
    this.excitedChance = 0.12;

    // Global time tracker
    this._time = 0;

    // Reusable temp vectors
    this.tempVec = new THREE.Vector3();
    this.tempVec2 = new THREE.Vector3();
    this._ikTarget = new THREE.Vector3();

    // Internal timers
    this._stateTime = 0;

    // For transitional soft-start / soft-stop of walking
    this.walkBlend = 0; // 0=not walking, 1=fully walking

    // Pathing helpers
    this.obstaclePadding = 0.6;
    this.lookAheadDistance = 2.3;

    // Curiosity
    this.curiousBlend = 0;

    // Secondary motion springs
    this._spring = {
      trunk: { angle: 0, velocity: 0 },
      ears:  { angle: 0, velocity: 0 },
      tail:  { angle: 0, velocity: 0 }
    };

    // IK leg chains
    this.legs = {};
    this._initializedIK = false;
    this._rootInitialY = null;
    this.groundHeight = 0;
    this._groundCalibrated = false;

    // Idle timer for subtle motion
    this._idleTime = 0;

    this._footfallListener = null;
    this._footstepListeners = new Set();
    this._legSwingState = {};

    // Gait parameters
    this.gait = {
      // Fraction of the cycle spent in swing (foot in the air).
      // Elephants have a high duty factor, so stance > swing.
      swingDuration: 0.3,
      // Lateral-sequence phase offsets (0..1)
      // BL -> FL -> BR -> FR
      phaseOffsets: {
        BL: 0.0,
        FL: 0.25,
        BR: 0.5,
        FR: 0.75,
      },
      // Base stride and lift at sizeScale = 1; both scaled by size and walkBlend.
      strideLengthBase: 0.26,
      liftHeightBase: 0.14,
    };

    // Base height of the root bone above ground (populated from rest pose).
    this.baseHeight = 2.1; // Fallback; will be overridden by calibration
  }

  // ------------------------------------------------------
  // CONFIGURATION
  // ------------------------------------------------------

  setEnvironment(env) {
    this.environment = env || null;

    if (env) {
      if (env.enclosureCenter) this.enclosureCenter.copy(env.enclosureCenter);
      if (typeof env.enclosureRadius === 'number') this.enclosureRadius = env.enclosureRadius;

      if (env.pondCenter) this.pondCenter.copy(env.pondCenter);
      if (typeof env.pondRadius === 'number') this.pondRadius = env.pondRadius;

      if (typeof env.sizeScale === 'number') this.sizeScale = env.sizeScale;
    }
  }

  // Called by ElephantBehavior when the rest pose is set up.
  _initializeFromRestPose() {
    const elephant = this.elephant;
    if (!elephant || !elephant.bones) return;

    const bones = elephant.bones;
    const root = bones['spine_base'];
    if (!root) return;

    // Initialize base height from rest pose relative to ground.
    this._calibrateGround(root);
    this._initLegChains();
    this._initializedIK = true;
    this._groundCalibrated = true;
  }

  _calibrateGround(root) {
    const mesh = this.elephant.mesh;
    if (!mesh) return;

    mesh.updateMatrixWorld(true);

    const bbox = new THREE.Box3().setFromObject(mesh);
    const minY = bbox.min.y;

    // Assume groundHeight (world) is at 0 for the ElephantPen.
    this.groundHeight = 0;

    // Root initial Y is chosen so that the lowest point of the Elephant sits on ground.
    const worldRootY = root.getWorldPosition(new THREE.Vector3()).y;
    const deltaMeshToRoot = worldRootY - minY;

    this._rootInitialY = this.groundHeight + deltaMeshToRoot;
    root.position.y = this._rootInitialY;
    this.baseHeight = root.position.y;
  }

  _initLegChains() {
    const elephant = this.elephant;
    if (!elephant || !elephant.bones || !elephant.mesh) return;

    const bones = elephant.bones;
    const mesh = elephant.mesh;
    const skeleton = elephant.skeleton;

    const legDefs = [
      { key: 'FL', upper: 'front_left_upper',  lower: 'front_left_lower',  foot: 'front_left_foot',  isFront: true },
      { key: 'FR', upper: 'front_right_upper', lower: 'front_right_lower', foot: 'front_right_foot', isFront: true },
      { key: 'BL', upper: 'back_left_upper',   lower: 'back_left_lower',   foot: 'back_left_foot',   isFront: false },
      { key: 'BR', upper: 'back_right_upper',  lower: 'back_right_lower',  foot: 'back_right_foot',  isFront: false }
    ];

    const legs = {};
    const hipWorld   = new THREE.Vector3();
    const kneeWorld  = new THREE.Vector3();
    const ankleWorld = new THREE.Vector3();
    const footLocal  = new THREE.Vector3();
    const invUpper   = new THREE.Matrix4();

    if (skeleton && skeleton.bones) {
      skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
    } else {
      Object.values(bones).forEach((b) => b.updateMatrixWorld(true));
    }

    mesh.updateMatrixWorld(true);

    legDefs.forEach((def) => {
      const upper = bones[def.upper];
      const lower = bones[def.lower];
      const foot  = bones[def.foot];
      if (!upper || !lower || !foot) return;

      upper.getWorldPosition(hipWorld);
      lower.getWorldPosition(kneeWorld);
      foot.getWorldPosition(ankleWorld);

      const len1 = hipWorld.distanceTo(kneeWorld);
      const len2 = kneeWorld.distanceTo(ankleWorld);

      invUpper.copy(upper.parent.matrixWorld).invert();
      footLocal.copy(ankleWorld).applyMatrix4(invUpper);

      const restUpperRotX = upper.rotation.x;
      const restLowerRotX = lower.rotation.x;
      const restFootRotX  = foot.rotation.x;

      legs[def.key] = {
        key: def.key,
        isFront: def.isFront,
        upper,
        lower,
        foot,
        len1,
        len2,
        restFootLocal: footLocal.clone(),
        restUpperRotX,
        restLowerRotX,
        restFootRotX
      };
    });

    this.legs = legs;
  }

  // ------------------------------------------------------
  // IK SOLVER
  // ------------------------------------------------------

  _solveLegIKFromLocalTarget(leg, targetLocal) {
    if (!leg) return;
    const upper = leg.upper;
    const lower = leg.lower;
    const foot  = leg.foot;
    if (!upper || !lower || !foot) return;

    const base = leg.restFootLocal;
    if (!base) return;

    const y = targetLocal.y;
    const z = targetLocal.z;

    let u = -y; // downwards
    let v = z;  // forward

    const dSq = u * u + v * v;
    let d = Math.sqrt(dSq);
    const maxReach = leg.len1 + leg.len2 * 0.999;
    d = Math.min(Math.max(d, 0.0001), maxReach);

    const len1 = leg.len1;
    const len2 = leg.len2;
    const cosK = (len1 * len1 + len2 * len2 - d * d) / (2 * len1 * len2);
    const kneeInternal = Math.acos(THREE.MathUtils.clamp(cosK, -1, 1));

    const targetAngle = Math.atan2(v, u);
    const hipAngle = targetAngle - Math.atan2(
      len2 * Math.sin(kneeInternal),
      len1 + len2 * Math.cos(kneeInternal)
    );

    const kneeBend = Math.PI - kneeInternal;

    upper.rotation.x = leg.restUpperRotX + hipAngle;
    lower.rotation.x = leg.restLowerRotX + kneeBend;

    const footComp = -(hipAngle + kneeBend) * 0.3;
    foot.rotation.x = leg.restFootRotX + footComp;
  }

  _poseLegIdle(legKey, t, radius, lift) {
    if (!this.legs) return;
    const leg = this.legs[legKey];
    if (!leg || !leg.restFootLocal) return;

    const base = leg.restFootLocal;
    const target = this._ikTarget;
    target.copy(base);

    let phaseOffset = 0;
    switch (legKey) {
      case 'FL': phaseOffset = 0.0; break;
      case 'FR': phaseOffset = 0.6; break;
      case 'BL': phaseOffset = 0.3; break;
      case 'BR': phaseOffset = 0.9; break;
      default: break;
    }

    const p = t * 0.8 + phaseOffset;
    target.z += Math.sin(p * 1.2) * radius;
    target.y += Math.sin(p * 1.7) * lift;

    this._solveLegIKFromLocalTarget(leg, target);
  }

  /**
   * Poses a leg in a walking cycle with stance/swing phases.
   * phase: 0..1
   * stepLength: approximate step length in local Z
   * liftHeight: how high the hoof lifts in swing phase.
   *
   * Splits cycle into STANCE (foot on ground moving back) and SWING (foot in air moving forward).
   */
  _poseLegWalk(legKey, phase, stepLength, liftHeight) {
    if (!this.legs) return;
    const leg = this.legs[legKey];
    if (!leg || !leg.restFootLocal) return;

    const base = leg.restFootLocal;
    const target = this._ikTarget;
    target.copy(base);

    // Normalize phase 0..1
    let u = phase % 1;
    if (u < 0) u += 1;

    // Gait Definition:
    // Swing Phase: ~30% of cycle (fast forward movement through air)
    // Stance Phase: ~70% of cycle (slow backward movement on ground)
    const swingDuration = THREE.MathUtils.clamp(this.gait.swingDuration, 0.2, 0.4);
    const stanceDuration = 1.0 - swingDuration;

    if (u < swingDuration) {
      // --- SWING PHASE ---
      // Normalize u to 0..1 within the swing window
      const swingT = u / swingDuration;

      // Horizontal Motion: Move from -step (back) to +step (front)
      // We use a cosine interpolation for smooth acceleration/deceleration
      const zProgress = (1 - Math.cos(swingT * Math.PI)) * 0.5; // 0 to 1
      target.z = base.z - stepLength + (zProgress * (stepLength * 2));

      // Vertical Motion: Parabola lift
      // sin(0..PI) goes 0 -> 1 -> 0
      target.y = base.y + Math.sin(swingT * Math.PI) * liftHeight;

    } else {
      // --- STANCE PHASE ---
      // Normalize u to 0..1 within the stance window
      const stanceT = (u - swingDuration) / stanceDuration;

      // Horizontal Motion: Move from +step (front) to -step (back) linearly
      // Linear is important here so ground speed matches body speed constantly
      target.z = base.z + stepLength - (stanceT * (stepLength * 2));

      // Vertical Motion: Flat on ground
      target.y = base.y;
    }

    this._solveLegIKFromLocalTarget(leg, target);

    const inSwing = u < swingDuration;
    const wasSwinging = this._legSwingState[legKey];
    this._legSwingState[legKey] = inSwing;

    if (wasSwinging === true && !inSwing) {
      this._emitFootfall(legKey, u, swingDuration);
    }
  }

  // Stride & speed helpers so translational speed matches the leg cycle.
  _getStrideLength() {
    const base = (this.gait && typeof this.gait.strideLengthBase === 'number')
      ? this.gait.strideLengthBase
      : 0.26;
    return base * this.sizeScale;
  }

  _getGaitSpeed(blend = this.walkBlend) {
    // Ensure legs and body translation stay in sync so feet do not "moonwalk".
    // We treat _getStrideLength() as the per-leg step length (distance from
    // neutral to maximum forward placement in root space) and solve for the
    // body speed that keeps stance-phase feet roughly planted in world space.
    //
    // During stance, a foot moves from +stepLength to -stepLength in root
    // space while the body moves forward. To keep the foot stationary in
    // world space, the body must travel 2 * stepLength over the stance
    // portion of the cycle. If the gait frequency is F cycles/second and
    // stanceDuration is S (0..1 of the cycle), then:
    //
    //   speed ≈ (2 * stepLength / S) * F
    //
    // Using the same "blend" both for step amplitude and for speed keeps the
    // legs and root motion tightly matched across slow/fast walks.
    const b = THREE.MathUtils.clamp(blend, 0, 1);
    const stepLength = this._getStrideLength() * b;
    const freq = this._gaitFrequency;
    const swing = THREE.MathUtils.clamp(
      this.gait && typeof this.gait.swingDuration === 'number' ? this.gait.swingDuration : 0.3,
      0.05,
      0.9
    );
    const stance = 1.0 - swing;
    if (stance <= 0.0001 || freq <= 0 || stepLength <= 0) return 0;
    return (2 * stepLength * freq) / stance;
  }

  setFootfallListener(listener) {
    this._footfallListener = typeof listener === 'function' ? listener : null;
  }

  onFootstep(listener) {
    if (typeof listener !== 'function') return () => {};
    this._footstepListeners.add(listener);
    return () => {
      this._footstepListeners.delete(listener);
    };
  }

  _emitFootfall(legKey, phase, swingDuration) {
    const strideSpeed = this._gaitFrequency;
    const strideDuration = strideSpeed > 0 ? 1 / strideSpeed : 0;
    const strideLength = this._getStrideLength() * this.walkBlend;
    const limbId = this._legKeyToLimbId(legKey);
    const phaseTime = strideDuration * phase;

    const payload = {
      animalId: this.elephant?.id || 'elephant',
      legId: legKey,
      limbId,
      phase,
      phaseTime,
      audioHintTime: 0,
      gait: this.state,
      strideSpeed,
      swingDuration,
      timestamp
    });
  }

  _legKeyToLimbId(legKey) {
    switch (legKey) {
      case 'FL':
        return 'front_left';
      case 'FR':
        return 'front_right';
      case 'BL':
        return 'back_left';
      case 'BR':
        return 'back_right';
      default:
        return legKey;
    }
  }

  _getLegPhase(legKey, globalPhase) {
    const offsets = (this.gait && this.gait.phaseOffsets) ? this.gait.phaseOffsets : {};
    const offset = (legKey in offsets) ? offsets[legKey] : 0.0;
    let u = (globalPhase + offset) % 1;
    if (u < 0) u += 1;
    return u;
  }

  // ------------------------------------------------------
  // MAIN UPDATE
  // ------------------------------------------------------

  update(dt) {
    if (!this.elephant || !this.elephant.bones) return;

    const bones = this.elephant.bones;
    const root = bones['spine_base'];
    const mesh = this.elephant.mesh;

    if (!root || !mesh) return;

    if (!this._initializedIK || !this._groundCalibrated) {
      this._initializeFromRestPose();
    }

    this.ensureDirectionNormalized();

    this._time += dt;
    this._idleTime += dt;
    this._stateTime += dt;

    if (this.state !== 'drink' && this.state !== 'excited') {
      this.maybeTriggerExcitement(dt);
      this.maybeTriggerDrink(root);
    }

    const walkTarget = (this.state === 'walk' || this.state === 'wander' || this.state === 'drink') ? 1 : 0;
    this.walkBlend = THREE.MathUtils.damp(this.walkBlend, walkTarget, 2.5, dt);

    const curiousTarget = (this.state === 'curious') ? 1 : 0;
    this.curiousBlend = THREE.MathUtils.damp(this.curiousBlend, curiousTarget, 2.0, dt);

    // Gait frequency
    // Keep gait frequency anchored to walkSpeed; we can later
    // modulate this if we add true speed controls.
    this._gaitFrequency = this.walkSpeed;
    if (this.walkBlend > 0.001) {
      this.gaitPhase = (this.gaitPhase + dt * this._gaitFrequency) % 1.0;
    }

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

    this.applySecondaryMotion(dt, bones);
  }

  setState(newState) {
    if (newState === this.state) return;
    this.state = newState;
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
    const drinkZone = this.pondRadius + 2.2 * this.sizeScale;

    if (distance < drinkZone) {
      this.setState('drink');
    }
  }

  maybeTriggerExcitement(dt) {
    if (!this.environment) return;
    const timeSince = this._time - this.lastExcitedTime;
    if (timeSince < this.excitedCooldown) return;

    if (Math.random() < this.excitedChance * dt) {
      this.setState('excited');
    }
  }

  // ------------------------------------------------------
  // PATHING & BOUNDS
  // ------------------------------------------------------

  turnToward(desired, dt, turnRate = 2.0) {
    if (!desired || desired.lengthSq() < 0.0001) return;

    const desiredDir = desired.clone();
    desiredDir.y = 0;
    if (desiredDir.lengthSq() < 0.0001) return;
    desiredDir.normalize();

    const currentDir = this.direction.clone();
    currentDir.y = 0;
    if (currentDir.lengthSq() < 0.0001) {
      this.direction.copy(desiredDir);
      return;
    }
    currentDir.normalize();

    const currentYaw = Math.atan2(currentDir.x, currentDir.z);
    const targetYaw = Math.atan2(desiredDir.x, desiredDir.z);
    let delta = targetYaw - currentYaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const maxTurn = Math.max(0.0001, turnRate * dt);
    delta = THREE.MathUtils.clamp(delta, -maxTurn, maxTurn);

    const newYaw = currentYaw + delta;
    this.direction.set(Math.sin(newYaw), 0, Math.cos(newYaw));
  }

  moveForward(root, speed, dt, maxDistance = null) {
    if (!root || speed <= 0 || dt <= 0) return;

    const step = speed * dt;
    const clampedStep = maxDistance !== null ? Math.min(step, maxDistance) : step;

    // Calculate the strictly relative Forward vector (Local +Z)
    // We use the root's quaternion so movement exactly matches rotation
    const relativeForward = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
    relativeForward.y = 0; // Flatten so we don't walk into the sky/ground
    relativeForward.normalize();

    root.position.addScaledVector(relativeForward, clampedStep);
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

      const future = this.tempVec.copy(position)
        .add(this.direction.clone().setY(0).normalize().multiplyScalar(this.lookAheadDistance));
      const futureDistance = future.sub(obsPos).setY(0).length();
      const effectiveDist = Math.min(distance, futureDistance);

      if (effectiveDist < radius) {
        const push = toObstacle.normalize().multiplyScalar((radius - effectiveDist) / radius);
        steering.add(push);
      }
    });

    return steering;
  }

  // ------------------------------------------------------
  // STATE UPDATES
  // ------------------------------------------------------

  updateIdle(dt, root, bones) {
    this._idleTime += dt;

    root.position.y = this.baseHeight + Math.sin(this._idleTime * 0.6) * 0.03;
    root.rotation.x = Math.sin(this._idleTime * 0.4) * 0.02;
    root.rotation.z = Math.sin(this._idleTime * 0.5 + 0.7) * 0.02;

    const t = this._idleTime;
    if (this.legs.BL) this._poseLegIdle('BL', t, 0.03, 0.02);
    if (this.legs.FL) this._poseLegIdle('FL', t, 0.03, 0.02);
    if (this.legs.BR) this._poseLegIdle('BR', t, 0.03, 0.02);
    if (this.legs.FR) this._poseLegIdle('FR', t, 0.03, 0.02);

    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip  = bones['trunk_tip'];

    const sway = Math.sin(t * 0.6) * 0.12;
    const dip  = Math.sin(t * 0.5 + 0.5) * 0.08;

    if (trunkBase) {
      trunkBase.rotation.y = sway * 0.4;
      trunkBase.rotation.x = dip * 0.3;
    }
    if (trunkMid1) {
      trunkMid1.rotation.y = sway * 0.7;
      trunkMid1.rotation.x = dip * 0.5;
    }
    if (trunkMid2) {
      trunkMid2.rotation.y = sway * 0.9;
      trunkMid2.rotation.x = dip * 0.7;
    }
    if (trunkTip) {
      trunkTip.rotation.y = sway * 1.0;
      trunkTip.rotation.x = dip * 0.9;
    }

    const earLeft  = bones['ear_left'];
    const earRight = bones['ear_right'];
    if (earLeft) {
      earLeft.rotation.y = Math.sin(t * 0.8) * 0.15;
    }
    if (earRight) {
      earRight.rotation.y = -Math.sin(t * 0.8 + 0.2) * 0.15;
    }
  }

  updateWander(dt, root, mesh, bones) {
    const drift = this.tempVec2.set(
      (Math.random() - 0.5) * 0.35,
      0,
      (Math.random() - 0.5) * 0.35
    );

    const avoidance = this.computeAvoidance(root.position, true);

    // Blend current heading, random drift, and avoidance
    const desiredDirection = this.direction.clone()
      .add(drift.multiplyScalar(0.25))
      .add(avoidance);

    this.turnToward(desiredDirection, dt, 2.6);

    // Sync rotation before movement to ensure Relative +Z works
    const yaw = Math.atan2(this.direction.x, this.direction.z);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, yaw, 6.0, dt);

    // Use gait-based speed so feet and translation stay in sync.
    // We pass the same blend used for leg amplitude so stance feet stay planted.
    const forwardSpeed = this._getGaitSpeed(this.walkBlend);
    this.moveForward(root, forwardSpeed, dt);
    this.keepWithinBounds(root);

    // Body bobbing (2 ups per gait cycle)
    const time = this._idleTime * 1.4;
    const bob = Math.sin((time + this.gaitPhase * Math.PI * 2) * 2.0) * 0.05 * this.walkBlend;
    root.position.y = this.baseHeight + bob;

    const leanForward = Math.sin(this.gaitPhase * Math.PI * 2) * 0.05 * this.walkBlend;
    const leanSide = Math.sin(this.gaitPhase * Math.PI * 4) * 0.03 * this.walkBlend;
    root.rotation.x = leanForward;
    root.rotation.z = leanSide;

    this.applyLegWalk(bones, this.gaitPhase);
    this.applyTrunkWalk(bones, this._idleTime, this.gaitPhase);
    this.applyEarWalk(bones, this._idleTime, this.gaitPhase);
  }

  updateDrink(dt, root, mesh, bones) {
    const t = this._stateTime;

    const toWater = this.tempVec.copy(this.pondCenter).sub(root.position);
    toWater.y = 0;
    const distance = toWater.length();

    const approach = toWater.clone().normalize();
    const avoidance = this.computeAvoidance(root.position, false);
    const desiredDir = approach.clone().add(avoidance.multiplyScalar(0.8));
    this.turnToward(desiredDir, dt, 3.3);

    const targetDist = this.pondRadius + this.drinkApproachDistance;
    if (distance > targetDist) {
      // Still walking towards water
      // Sync rotation first
      root.rotation.y = THREE.MathUtils.damp(
        root.rotation.y,
        Math.atan2(this.direction.x, this.direction.z),
        6.0,
        dt
      );

      // Match leg cycle and translation while approaching. We use the
      // same blend for speed and leg amplitude to keep feet grounded.
      const speed = this._getGaitSpeed(this.walkBlend);
      const remaining = Math.max(0, distance - targetDist);
      this.moveForward(root, speed, dt, remaining);
      this.keepWithinBounds(root);

      const bob = Math.sin((this._idleTime + this.gaitPhase * Math.PI * 2) * 2.0) * 0.04 * this.walkBlend;
      root.position.y = this.baseHeight + bob;
      root.rotation.x = -0.05 * this.walkBlend;

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
    const trunkTip  = bones['trunk_tip'];

    root.position.y = THREE.MathUtils.damp(root.position.y, this.groundHeight + 1.9 * this.sizeScale, 4.0, dt);
    root.rotation.x = THREE.MathUtils.damp(root.rotation.x, -0.35, 4.0, dt);

    if (neck) {
      neck.rotation.x = THREE.MathUtils.damp(neck.rotation.x, -0.4, 4.0, dt) * settle;
    }
    if (head) {
      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, -0.35, 4.0, dt) * settle;
    }

    const trunkDown = -0.9;
    if (trunkBase) trunkBase.rotation.x = THREE.MathUtils.damp(trunkBase.rotation.x, trunkDown * 0.35, 4.0, dt);
    if (trunkMid1) trunkMid1.rotation.x = THREE.MathUtils.damp(trunkMid1.rotation.x, trunkDown * 0.6, 4.0, dt);
    if (trunkMid2) trunkMid2.rotation.x = THREE.MathUtils.damp(trunkMid2.rotation.x, trunkDown * 0.85, 4.0, dt);
    if (trunkTip)  trunkTip.rotation.x  = THREE.MathUtils.damp(trunkTip.rotation.x,  trunkDown * 1.1, 4.0, dt);

    if (head) head.rotation.y = Math.sin(t * 0.8) * 0.06;
    if (trunkTip) trunkTip.rotation.y = Math.sin(t * 0.9) * 0.12;

    const earLeft  = bones['ear_left'];
    const earRight = bones['ear_right'];
    const flare = Math.sin(t * 0.6) * 0.15;
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

    if (this.legs.BL) this._poseLegIdle('BL', t * 1.8, 0.07, 0.05);
    if (this.legs.FL) this._poseLegIdle('FL', t * 2.0, 0.08, 0.05);
    if (this.legs.BR) this._poseLegIdle('BR', t * 1.8, 0.07, 0.05);
    if (this.legs.FR) this._poseLegIdle('FR', t * 2.0, 0.08, 0.05);

    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip  = bones['trunk_tip'];

    const sway = Math.sin(t * 4.0) * 0.35;
    const dip  = Math.sin(t * 3.0) * 0.25;

    if (trunkBase) {
      trunkBase.rotation.y = sway * 0.5;
      trunkBase.rotation.x = dip * 0.3;
    }
    if (trunkMid1) {
      trunkMid1.rotation.y = sway * 0.7;
      trunkMid1.rotation.x = dip * 0.5;
    }
    if (trunkMid2) {
      trunkMid2.rotation.y = sway * 0.9;
      trunkMid2.rotation.x = dip * 0.7;
    }
    if (trunkTip) {
      trunkTip.rotation.y = sway * 1.1;
      trunkTip.rotation.x = dip * 0.9;
    }

    const earLeft  = bones['ear_left'];
    const earRight = bones['ear_right'];
    const flap = Math.sin(t * 10.0) * 0.4;
    if (earLeft) earLeft.rotation.y = flap;
    if (earRight) earRight.rotation.y = -flap;

    if (this._stateTime > this.excitedDuration) {
      this.setState('wander');
    }
  }

  updateCurious(dt, root, bones) {
    const t = this._stateTime;
    root.position.y = this.baseHeight + Math.sin(t * 1.4) * 0.04 * this.curiousBlend;

    const neck = bones['spine_neck'];
    const head = bones['head'];
    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip  = bones['trunk_tip'];

    const look = Math.sin(t * 0.7) * 0.3;
    if (neck) neck.rotation.y = look * 0.4 * this.curiousBlend;
    if (head) head.rotation.y = look * 0.7 * this.curiousBlend;

    const coil = Math.sin(t * 0.9) * 0.5 * this.curiousBlend;
    if (trunkBase) trunkBase.rotation.x = -0.25 + coil * 0.25;
    if (trunkMid1) trunkMid1.rotation.x = -0.3 + coil * 0.3;
    if (trunkMid2) trunkMid2.rotation.x = -0.35 + coil * 0.35;
    if (trunkTip)  trunkTip.rotation.x = -0.4 + coil * 0.4;

    const earLeft  = bones['ear_left'];
    const earRight = bones['ear_right'];
    const perk = 0.15 + Math.sin(t * 1.5) * 0.12 * this.curiousBlend;
    if (earLeft) earLeft.rotation.y = perk;
    if (earRight) earRight.rotation.y = -perk;
  }

  // -----------------------------
  // WALK STATE
  // -----------------------------
  updateWalk(dt, root, mesh, bones) {
    const TWO_PI = Math.PI * 2;

    const avoidance = this.computeAvoidance(root.position, true);
    const desiredDirection = this.direction.clone().add(avoidance);
    this.turnToward(desiredDirection, dt, 3.0);

    // Apply Rotation First (Steer)
    const yaw = Math.atan2(this.direction.x, this.direction.z);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, yaw, 6.0, dt);

    // Body bobbing and weight shift
    const bob = Math.sin((this.gaitPhase * TWO_PI) * 2.0) * 0.045 * this.walkBlend;
    const sway = Math.sin((this.gaitPhase + 0.25) * TWO_PI) * 0.02 * this.walkBlend;
    root.position.y = this.baseHeight + bob;
    root.position.x = sway;

    // Apply Movement Second (Move relative to new rotation)
    // Advance root so that stance-phase feet stay approximately planted
    // in world space for the current gait phase.
    const gaitSpeed = this._getGaitSpeed(this.walkBlend);
    this.moveForward(root, gaitSpeed, dt);

    this.keepWithinBounds(root);

    // Lean
    const leanForward = Math.sin(this.gaitPhase * TWO_PI) * 0.08 * this.walkBlend;
    const roll = Math.sin(this.gaitPhase * TWO_PI * 2) * 0.04 * this.walkBlend;
    root.rotation.x = leanForward;
    root.rotation.z = roll;

    this.applyLegWalk(bones, this.gaitPhase);
    this.applyTrunkWalk(bones, this._idleTime, this.gaitPhase);
    this.applyEarWalk(bones, this._idleTime, this.gaitPhase);
  }

  applyLegWalk(bones, phase) {
    if (!this.legs || Object.keys(this.legs).length === 0) return;

    // Use modulo 1 to wrap phase cleanly
    const p = phase % 1;

    const baseStride = this._getStrideLength() * this.walkBlend;
    const baseLift   = this.gait.liftHeightBase * this.sizeScale * this.walkBlend;

    // Lateral sequence phase offsets are pulled from this.gait.phaseOffsets
    const pBL = this._getLegPhase('BL', p);
    const pFL = this._getLegPhase('FL', p);
    const pBR = this._getLegPhase('BR', p);
    const pFR = this._getLegPhase('FR', p);

    this._poseLegWalk('BL', pBL, baseStride * 0.95, baseLift * 1.05);
    this._poseLegWalk('FL', pFL, baseStride * 1.0,  baseLift * 1.0);
    this._poseLegWalk('BR', pBR, baseStride * 0.95, baseLift * 1.05);
    this._poseLegWalk('FR', pFR, baseStride * 1.0,  baseLift * 1.0);
  }

  applyTrunkWalk(bones, t, phase) {
    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip = bones['trunk_tip'];

    const sway = THREE.MathUtils.clamp(Math.sin(t * 1.0) * 0.32 + Math.sin(phase * Math.PI * 1.4) * 0.22, -0.45, 0.45);
    const dip  = THREE.MathUtils.clamp(Math.sin(t * 0.8) * 0.24 + Math.sin(phase * Math.PI * 0.9) * 0.18, -0.35, 0.35);

    if (trunkBase) {
      trunkBase.rotation.y = sway * 0.45;
      trunkBase.rotation.x = dip * 0.35;
    }
    if (trunkMid1) {
      trunkMid1.rotation.y = sway * 0.75;
      trunkMid1.rotation.x = dip * 0.55;
    }
    if (trunkMid2) {
      trunkMid2.rotation.y = sway * 0.9;
      trunkMid2.rotation.x = dip * 0.75;
    }
    if (trunkTip) {
      trunkTip.rotation.y = sway * 1.05;
      trunkTip.rotation.x = dip * 0.95;
    }
  }

  applyEarWalk(bones, t, phase) {
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];
    if (!earLeft && !earRight) return;

    const flap = Math.sin(t * 2.4) * 0.18 + Math.sin(phase * Math.PI * 2.0) * 0.12;
    const flapClamped = THREE.MathUtils.clamp(flap, -0.4, 0.4);

    if (earLeft) earLeft.rotation.y = flapClamped;
    if (earRight) earRight.rotation.y = -flapClamped * 0.95;
  }

  applyTrunkIdle(bones, t) {
    const trunkBase = bones['trunk_base'];
    const trunkMid1 = bones['trunk_mid1'];
    const trunkMid2 = bones['trunk_mid2'];
    const trunkTip  = bones['trunk_tip'];

    const sway = Math.sin(t * 0.7) * 0.18;
    const dip  = THREE.MathUtils.clamp(Math.sin(t * 0.6 + 0.5) * 0.22, -0.3, 0.3);

    if (trunkBase) {
      trunkBase.rotation.y = sway * 0.45;
      trunkBase.rotation.x = dip * 0.3;
    }
    if (trunkMid1) {
      trunkMid1.rotation.y = sway * 0.7;
      trunkMid1.rotation.x = dip * 0.5;
    }
    if (trunkMid2) {
      trunkMid2.rotation.y = sway * 0.85;
      trunkMid2.rotation.x = dip * 0.75;
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

    const baseFlap = Math.sin(t * 0.7) * 0.1;
    const pulse = Math.max(0, Math.sin(t * 0.3)) ** 2;
    const strongFlap = pulse * 0.25;

    const totalFlapLeft = baseFlap + strongFlap;
    const totalFlapRight = baseFlap + strongFlap * 0.9;

    if (earLeft) earLeft.rotation.y = totalFlapLeft;
    if (earRight) earRight.rotation.y = -totalFlapRight;
  }

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

    const forwardVel = this._getGaitSpeed(this.walkBlend);
    const turning = Math.sin(this.gaitPhase * TWO_PI * 0.7) * this.walkBlend;

    const stiffness = 10.0;
    const damping = 3.2;

    const trunkTarget = (forwardVel * 0.55) + (turning * 0.35);
    const earsTarget = (forwardVel * 0.65) + (turning * 0.35);
    const tailTarget = (forwardVel * -0.75) + (turning * 0.4);

    {
      const s = this._spring.trunk;
      const acc = (trunkTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle = THREE.MathUtils.clamp(s.angle + s.velocity * dt, -0.35, 0.35);

      if (trunkBase) trunkBase.rotation.x += s.angle * 0.12;
      if (trunkMid1) trunkMid1.rotation.x += s.angle * 0.45;
      if (trunkMid2) trunkMid2.rotation.x += s.angle * 0.75;
      if (trunkTip)  trunkTip.rotation.x  += s.angle * 0.95;
    }

    {
      const s = this._spring.ears;
      const acc = (earsTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle = THREE.MathUtils.clamp(s.angle + s.velocity * dt, -0.4, 0.4);

      if (earLeft)  earLeft.rotation.y  += s.angle;
      if (earRight) earRight.rotation.y -= s.angle * 0.9;
    }

    {
      const s = this._spring.tail;
      const acc = (tailTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle = THREE.MathUtils.clamp(s.angle + s.velocity * dt, -0.35, 0.35);

      if (tailBase) tailBase.rotation.y += s.angle * 0.4;
      if (tailMid)  tailMid.rotation.y  += s.angle * 0.7;
      if (tailTip)  tailTip.rotation.y  += s.angle * 0.9;
    }
  }
}
