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

    // Base speed. 
    this.walkSpeed = 0.6; 
    this._gaitFrequency = this.walkSpeed * 0.8; // Slower frequency for heavy look

    // Base height offset for the root (hips).
    this.baseHeight = 1.0;

    // Timer for idle breathing / subtle motion
    this._idleTime = 0;

    // Heading management
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
  }

  setEnvironment(env) {
    this.environment = env || null;
    if (!env) return;

    if (typeof env.groundHeight === 'number') {
      this.groundHeight = env.groundHeight;
      this._groundCalibrated = false;
    }

    if (env.enclosureCenter) this.enclosureCenter.copy(env.enclosureCenter);
    if (typeof env.enclosureRadius === 'number') this.enclosureRadius = env.enclosureRadius;
    if (env.pondCenter) this.pondCenter.copy(env.pondCenter);
    if (typeof env.pondRadius === 'number') this.pondRadius = env.pondRadius;

    this.sizeScale = Math.max(0.25, this.enclosureRadius / 10);
    this.obstaclePadding = 0.6 * this.sizeScale;
    this.lookAheadDistance = 2.3 * this.sizeScale;
    this.drinkApproachDistance = 0.8 * this.sizeScale;

    this._initializedIK = false;
  }

  // ------------------------------------------------------
  // IK SETUP & HELPERS
  // ------------------------------------------------------

  _initializeFromRestPose() {
    if (!this.elephant || !this.elephant.bones || !this.elephant.mesh) return;
    if (this._initializedIK && this._groundCalibrated) return;

    const bones = this.elephant.bones;
    const mesh = this.elephant.mesh;
    const root = bones['spine_base'];
    if (!root) return;

    if (this._rootInitialY === null) {
      this._rootInitialY = root.position.y;
    }

    this._initLegChains();
    mesh.updateMatrixWorld(true);

    const bbox = new THREE.Box3().setFromObject(mesh);
    const minY = bbox.min.y;

    if (Number.isFinite(minY)) {
      const offsetFromRoot = this._rootInitialY - minY;
      this.baseHeight = this.groundHeight + offsetFromRoot;
      root.position.y = this.baseHeight;
    }

    this._initializedIK = true;
    this._groundCalibrated = true;
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

    for (const def of legDefs) {
      const upper = bones[def.upper];
      const lower = bones[def.lower];
      const foot  = bones[def.foot];
      if (!upper || !lower || !foot) continue;

      upper.getWorldPosition(hipWorld);
      lower.getWorldPosition(kneeWorld);
      foot.getWorldPosition(ankleWorld);

      const len1 = hipWorld.distanceTo(kneeWorld);
      const len2 = Math.max(kneeWorld.distanceTo(ankleWorld), 0.0001);

      invUpper.copy(upper.matrixWorld).invert();
      footLocal.copy(ankleWorld).applyMatrix4(invUpper);

      const restDistance = Math.sqrt(footLocal.y * footLocal.y + footLocal.z * footLocal.z);

      legs[def.key] = {
        ...def,
        upper,
        lower,
        foot,
        len1: Math.max(len1, 0.001),
        len2: Math.max(len2, 0.001),
        restFootLocal: footLocal.clone(),
        restUpperRotX: upper.rotation.x,
        restLowerRotX: lower.rotation.x,
        restFootRotX: foot.rotation.x
      };
    }

    this.legs = legs;
  }

  _solveLegIKFromLocalTarget(leg, targetLocal) {
    if (!leg || !leg.upper || !leg.lower || !leg.foot || !leg.restFootLocal) return;

    const len1 = leg.len1;
    const len2 = leg.len2;
    const upper = leg.upper;
    const lower = leg.lower;
    const foot = leg.foot;

    // 2D IK Plane: Y is down/up, Z is forward/back
    const y = targetLocal.y;
    const z = targetLocal.z;

    let u = -y; // downwards
    let v = z;  // forward

    const dSq = u * u + v * v;
    let d = Math.sqrt(dSq);
    const maxReach = len1 + len2 * 0.999;
    d = Math.min(Math.max(d, 0.0001), maxReach);

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
   * Helper: Natural Quadruped walking pose.
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
    // Swing Phase: ~35% of cycle (fast forward movement through air)
    // Stance Phase: ~65% of cycle (slow backward movement on ground)
    const swingDuration = 0.35; 
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
    this._gaitFrequency = this.walkSpeed * 0.8;
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

  maybeTriggerExcitement(dt = 0) {
    const timeSinceExcited = this._time - this.lastExcitedTime;
    if (timeSinceExcited < this.excitedCooldown) return;
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

  /**
   * Move the root forward in local +Z space.
   * Calculates the specific forward vector from the root's current world rotation
   * to ensure strict relative movement.
   */
  moveForward(root, speed, dt, maxDistance = null) {
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
  // STATES
  // -----------------------------

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

    // Sync rotation before movement to ensure Relative +Z works
    const yaw = Math.atan2(this.direction.x, this.direction.z);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, yaw, 6.0, dt);

    const forwardSpeed = this.walkSpeed * 0.7;
    this.moveForward(root, forwardSpeed, dt);
    this.keepWithinBounds(root);

    // Body bobbing (2 ups per gait cycle)
    const time = this._idleTime * 1.4;
    const bob = Math.sin((time + this.gaitPhase * Math.PI * 2) * 2.0) * 0.05;
    root.position.y = this.baseHeight + bob;

    const leanForward = Math.sin(this.gaitPhase * Math.PI * 2) * 0.05;
    const leanSide = Math.sin(this.gaitPhase * Math.PI * 4) * 0.03;
    root.rotation.x = leanForward;
    root.rotation.z = leanSide;

    this.applyLegWalk(bones, this.gaitPhase);
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

      const speed = this.walkSpeed * 0.55;
      const remaining = Math.max(0, distance - targetDist);
      this.moveForward(root, speed, dt, remaining);
      this.keepWithinBounds(root);

      const bob = Math.sin((this._idleTime + this.gaitPhase * Math.PI * 2) * 2.0) * 0.04;
      root.position.y = this.baseHeight + bob;
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
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];

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

  updateCurious(dt, root, bones) {
    const t = this._idleTime;
    const bob = Math.sin(t * 1.3) * 0.03;
    root.position.y = this.baseHeight + bob;

    const swaySide = Math.sin(t * 0.9) * 0.04;
    root.rotation.z = swaySide;

    const pitch = Math.sin(t * 0.7) * 0.05;
    root.rotation.x = pitch;

    const yaw = Math.sin(t * 0.45) * 0.25;
    const head = bones['head'];
    const neck = bones['spine_neck'];
    if (neck) neck.rotation.y = yaw * 0.4;
    if (head) head.rotation.y = yaw * 0.6;

    this.applyTrunkIdle(bones, t);
    this.applyEarIdle(bones, t);

    if (neck) neck.rotation.x = Math.sin(t * 0.8) * 0.05;
    if (head) head.rotation.x = Math.sin(t * 0.8 + 1.0) * 0.08;

    const earLeft  = bones['ear_left'];
    const earRight = bones['ear_right'];
    const flap = 0.15 * Math.sin(this._stateTime * 3.0);
    if (earLeft)  earLeft.rotation.y = flap;
    if (earRight) earRight.rotation.y = -flap;
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

    const forwardVel = this.walkBlend * this.walkSpeed;
    const turning = Math.sin(this.gaitPhase * TWO_PI * 0.7) * this.walkBlend;

    const stiffness = 10.0;
    const damping = 3.2;

    const trunkTarget = forwardVel * 0.55 + turning * 0.35;
    const earsTarget = forwardVel * 0.65 + turning * 0.35;
    const tailTarget = forwardVel * -0.75 + turning * 0.4;

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

    {
      const s = this._spring.ears;
      const acc = (earsTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle = THREE.MathUtils.clamp(s.angle + s.velocity * dt, -0.28, 0.28);
      
      const earLeft = bones['ear_left'];
      const earRight = bones['ear_right'];
      if (earLeft) earLeft.rotation.y += s.angle;
      if (earRight) earRight.rotation.y -= s.angle;
    }

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

  updateIdle(dt, root, bones) {
    const t = this._idleTime;

    const bob = Math.sin(t * 1.2) * 0.03;
    root.position.y = this.baseHeight + bob;

    const sway = Math.sin(t * 0.7) * 0.02;
    root.rotation.z = sway;

    const pitch = Math.sin(t * 0.5) * 0.03;
    root.rotation.x = pitch;

    this.applyLegIdle(bones, t);
    this.applyTrunkIdle(bones, t);
    this.applyEarIdle(bones, t);
  }

  applyLegIdle(bones, t) {
    if (!this.legs || Object.keys(this.legs).length === 0) return;

    const baseRadius = 0.04 * this.sizeScale;
    const baseLift   = 0.02 * this.sizeScale;

    this._poseLegIdle('FL', t,          baseRadius * 1.0,  baseLift * 1.0);
    this._poseLegIdle('FR', t + 0.6,    baseRadius * 0.9,  baseLift * 0.9);
    this._poseLegIdle('BL', t + 0.3,    baseRadius * 1.05, baseLift * 1.05);
    this._poseLegIdle('BR', t + 0.9,    baseRadius * 0.95, baseLift * 0.95);
  }

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

    const baseFlap = Math.sin(t * 0.7) * 0.1;
    const pulse = Math.max(0, Math.sin(t * 0.3)) ** 2; 
    const strongFlap = pulse * 0.25;

    const totalFlapLeft = baseFlap + strongFlap;
    const totalFlapRight = baseFlap + strongFlap * 0.9; 

    if (earLeft) earLeft.rotation.y = totalFlapLeft;
    if (earRight) earRight.rotation.y = -totalFlapRight;
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
    const strideLength = 0.26 * this.sizeScale;
    const gaitSpeed = strideLength * this._gaitFrequency * this.walkBlend * 0.95;
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

  /**
   * Lateral-Sequence Gait (Heavy Quadruped)
   * Order: Back Left (0) -> Front Left (0.15) -> Back Right (0.5) -> Front Right (0.65)
   * This ensures there is always a triangle of support or at least 2 legs grounded.
   */
  applyLegWalk(bones, phase) {
    if (!this.legs || Object.keys(this.legs).length === 0) return;

    // Use modulo 1 to wrap phase cleanly
    const p = phase % 1;

    const baseStride = 0.26 * this.sizeScale * this.walkBlend;
    const baseLift   = 0.14 * this.sizeScale * this.walkBlend;

    // Lateral Sequence Offsets
    // BL hits ground at 0.0
    // FL hits ground shortly after (0.15)
    // BR hits ground at 0.5
    // FR hits ground shortly after (0.65)
    
    this._poseLegWalk('BL', p + 0.0,  baseStride * 0.95, baseLift * 1.05);
    this._poseLegWalk('FL', p - 0.15, baseStride * 1.0,  baseLift * 1.0);
    this._poseLegWalk('BR', p - 0.5,  baseStride * 0.95, baseLift * 1.05);
    this._poseLegWalk('FR', p - 0.65, baseStride * 1.0,  baseLift * 1.0);
  }

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

    const gaitFlap = Math.sin(phase * 1.2) * 0.14;
    const idleFlap = Math.sin(t * 0.65) * 0.06;

    const totalLeft = THREE.MathUtils.clamp(gaitFlap + idleFlap, -0.22, 0.22);
    const totalRight = THREE.MathUtils.clamp(gaitFlap + idleFlap * 0.9, -0.22, 0.22);

    if (earLeft) earLeft.rotation.y = totalLeft;
    if (earRight) earRight.rotation.y = -totalRight;
  }

  resetBones() {
    const bones = this.elephant.bones;
    const root = bones['spine_base'];

    if (root) {
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