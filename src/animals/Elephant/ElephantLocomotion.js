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
    this.sizeScale = 1.0;
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
    this._ikTarget = new THREE.Vector3();

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

    // IK leg chains and ground calibration
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

    // Scale step lengths and avoidance radii with enclosure size so a larger pen
    // gives the elephant room to take proportionally larger steps.
    this.sizeScale = Math.max(0.25, this.enclosureRadius / 10);
    this.obstaclePadding = 0.6 * this.sizeScale;
    this.lookAheadDistance = 2.3 * this.sizeScale;
    this.drinkApproachDistance = 0.8 * this.sizeScale;

    // Re-calibrate IK next frame because the effective leg lengths vs. ground
    // may need to change when the environment changes.
    this._initializedIK = false;
  }

  // ------------------------------------------------------
  // IK SETUP & HELPERS
  // ------------------------------------------------------

  /**
   * Initialize leg chains and calibrate the base height so that the elephant's
   * feet rest on the ground plane (groundHeight) in the current pen.
   *
   * We only do this once the mesh & bones are available, and again whenever
   * the environment changes enough to invalidate the calibration.
   */
  _initializeFromRestPose() {
    if (!this.elephant || !this.elephant.bones || !this.elephant.mesh) return;
    if (this._initializedIK && this._groundCalibrated) return;

    const bones = this.elephant.bones;
    const mesh = this.elephant.mesh;
    const root = bones['spine_base'];
    if (!root) return;

    // Remember the original root height the first time we calibrate so we can
    // preserve the relative offset between the hips and the feet.
    if (this._rootInitialY === null) {
      this._rootInitialY = root.position.y;
    }

    // Build IK leg chains from the current bind pose.
    this._initLegChains();

    // Ensure world matrices & bounding box are up to date.
    mesh.updateMatrixWorld(true);

    // Use the visual mesh bounds to find the lowest point of the elephant.
    // In practice this is the bottom of the feet in the default pose, so we
    // treat that as the contact point with the ground plane.
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

  /**
   * Build simple two-segment IK chains for each leg from the current bones.
   * We use the "upper" and "lower" leg bones and approximate the foot target
   * at the end of the lower bone (or its first child if present).
   */
  _initLegChains() {
    const elephant = this.elephant;
    if (!elephant || !elephant.bones || !elephant.mesh) return;

    const bones = elephant.bones;
    const mesh = elephant.mesh;
    const skeleton = elephant.skeleton;

    const legDefs = [
      { key: 'FL', upper: 'front_left_upper',  lower: 'front_left_lower',  foot: 'front_left_foot',  isFront: true,  isLeft: true  },
      { key: 'FR', upper: 'front_right_upper', lower: 'front_right_lower', foot: 'front_right_foot', isFront: true,  isLeft: false },
      { key: 'BL', upper: 'back_left_upper',   lower: 'back_left_lower',   foot: 'back_left_foot',   isFront: false, isLeft: true  },
      { key: 'BR', upper: 'back_right_upper',  lower: 'back_right_lower',  foot: 'back_right_foot',  isFront: false, isLeft: false }
    ];

    const legs = {};
    const hipWorld   = new THREE.Vector3();
    const kneeWorld  = new THREE.Vector3();
    const ankleWorld = new THREE.Vector3();
    const footLocal  = new THREE.Vector3();
    const invUpper   = new THREE.Matrix4();

    // Make sure world matrices are fresh before sampling positions.
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
        restDistance: restDistance > 0.0001 ? restDistance : (len1 + len2) * 0.7,
        swingLift: def.isFront ? 0.28 : 0.32,
        restUpperRotX: upper.rotation.x,
        restLowerRotX: lower.rotation.x,
        restFootRotX: foot.rotation.x
      };
    }

    this.legs = legs;
  }

  /**
   * Solve a planar two-segment IK problem for a given leg, interpreting the
   * leg's local Y/Z plane as the IK plane:
   *   - local -Y is "down" toward the ground
   *   - local +Z is "forward" in the elephant's walk direction.
   *
   * targetLocal is expressed in the upper-bone's local space.
   */
  _solveLegIKFromLocalTarget(leg, targetLocal) {
    if (!leg || !leg.upper || !leg.lower || !leg.foot || !leg.restFootLocal) return;

    const len1 = leg.len1;
    const len2 = leg.len2;
    if (!Number.isFinite(len1) || !Number.isFinite(len2)) return;

    const upper = leg.upper;
    const lower = leg.lower;
    const foot = leg.foot;

    // Project into the 2D IK plane (Y/Z of the upper-bone space).
    const y = targetLocal.y;
    const z = targetLocal.z;

    let u = -y; // downwards
    let v = z;  // forward

    const dSq = u * u + v * v;
    if (dSq < 1e-6) {
      upper.rotation.x = leg.restUpperRotX;
      lower.rotation.x = leg.restLowerRotX;
      foot.rotation.x  = leg.restFootRotX;
      return;
    }

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

  /**
   * Helper: subtle idle pose where each foot stays very close to its bind
   * position but shifts a little to keep the elephant from looking frozen.
   */
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

    // Tiny forward/back & vertical motion.
    target.z += Math.sin(p * 1.2) * radius;
    target.y += Math.sin(p * 1.7) * lift;

    this._solveLegIKFromLocalTarget(leg, target);
  }

  /**
   * Helper: walking pose, where the foot moves through a smooth arc in the
   * Y/Z plane while the IK solver handles the actual joint angles.
   */
  _poseLegWalk(legKey, phase, stepLength, liftHeight) {
    if (!this.legs) return;
    const leg = this.legs[legKey];
    if (!leg || !leg.restFootLocal) return;

    const base = leg.restFootLocal;
    const target = this._ikTarget;
    target.copy(base);

    const TWO_PI = Math.PI * 2;
    let u = phase % 1;
    if (u < 0) u += 1;

    // Use a simple sinusoidal stride: s < 0 is stance, s > 0 is swing.
    const s = Math.sin(u * TWO_PI);

    // Forward/back along local Z relative to the bind-pose position.
    target.z = base.z + stepLength * s;

    // Vertical lift only during the swing phase so feet stay on the ground
    // while in stance.
    const liftPhase = Math.max(0, s);
    target.y = base.y + liftHeight * liftPhase;

    this._solveLegIKFromLocalTarget(leg, target);
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

    // Initialize IK leg chains and ground offset lazily once the mesh & bones
    // are available (and whenever the environment changes).
    if (!this._initializedIK || !this._groundCalibrated) {
      this._initializeFromRestPose();
    }

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
    const drinkZone = this.pondRadius + 2.2 * this.sizeScale;

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
   * IK-driven idle: keep the feet essentially in place but add a soft
   * micro-motion so the elephant gently shifts its weight.
   */
  applyLegIdle(bones, t) {
    // IK-driven idle: keep the feet essentially in place but add a soft
    // micro-motion so the elephant gently shifts its weight.
    if (!this.legs || Object.keys(this.legs).length === 0) {
      return;
    }

    const baseRadius = 0.04 * this.sizeScale;
    const baseLift   = 0.02 * this.sizeScale;

    this._poseLegIdle('FL', t,          baseRadius * 1.0,  baseLift * 1.0);
    this._poseLegIdle('FR', t + 0.6,    baseRadius * 0.9,  baseLift * 0.9);
    this._poseLegIdle('BL', t + 0.3,    baseRadius * 1.05, baseLift * 1.05);
    this._poseLegIdle('BR', t + 0.9,    baseRadius * 0.95, baseLift * 0.95);
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

    // Leg stepping pattern (lateral sequence) via IK.
    this.applyLegWalk(bones, this.gaitPhase);

    // Trunk sway & dip while walking
    this.applyTrunkWalk(bones, this._idleTime, this.gaitPhase);

    // Ears: more active flapping when walking
    this.applyEarWalk(bones, this._idleTime, this.gaitPhase);
  }

  /**
   * IK-driven lateral-sequence gait. Each leg gets a phase-offset stride
   * that keeps at least two legs planted at all times for a heavy, stable
   * walk. Step length and lift scale with the enclosure size so a larger
   * pen allows longer strides.
   */
  applyLegWalk(bones, phase) {
    // IK-driven lateral-sequence gait. Each leg gets a phase-offset stride
    // that keeps at least two legs planted at all times for a heavy, stable
    // walk. Step length and lift scale with the enclosure size so a larger
    // pen allows longer strides.
    if (!this.legs || Object.keys(this.legs).length === 0) {
      return;
    }

    const basePhase = (phase % 1 + 1) % 1;

    const baseStride = 0.35 * this.sizeScale * this.walkBlend;
    const baseLift   = 0.22 * this.sizeScale * this.walkBlend;

    // Phase offsets for a lateral sequence: FL -> BL -> FR -> BR
    this._poseLegWalk('FL', basePhase + 0.0,  baseStride * 1.0,  baseLift * 1.0);
    this._poseLegWalk('BL', basePhase + 0.25, baseStride * 0.95, baseLift * 1.05);
    this._poseLegWalk('FR', basePhase + 0.5,  baseStride * 1.0,  baseLift * 1.0);
    this._poseLegWalk('BR', basePhase + 0.75, baseStride * 0.95, baseLift * 1.05);
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
