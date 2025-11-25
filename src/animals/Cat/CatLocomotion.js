// src/animals/Cat/CatLocomotion.js

import * as THREE from 'three';

/**
 * CatLocomotion
 *
 * Natural, heavy quadruped locomotion for the CatCreature:
 * - Slow, weighty walk with pronounced body bob
 * - Lateral-sequence gait (left side, then right side)
 * - Trunk sway and ear flapping, more noticeable while walking
 * - Soft idle breathing with subtle trunk/ear motion
 *
 * Expected bone keys (any missing ones are safely ignored):
 * - 'spine_base' (root / hips)
 * - 'spine_mid', 'spine_neck', 'head'
 * - 'front_left_upper_leg', 'front_left_lower_leg'
 * - 'front_right_upper_leg', 'front_right_lower_leg'
 * - 'back_left_upper_leg',  'back_left_lower_leg'
 * - 'back_right_upper_leg', 'back_right_lower_leg'
 * - 'trunk_base', 'trunk_mid', 'trunk_tip'
 * - 'ear_left', 'ear_right'
 */
export class CatLocomotion {
  constructor(cat) {
    this.cat = cat;

    // Finite state machine: idle, wander, curious.  Start in idle.
    this.state = 'idle';
    // A timer controlling when to switch states.  When it reaches 0 the
    // locomotion logic will decide the next state.
    this._stateTimer = 0;
    // Time elapsed in the current state (used for curious animation)
    this._stateTime = 0;

    // --- LOCOMOTION CONFIG ---
    this.baseHeight = 0.45;         // Base Y for spine_base above "ground"
    this.walkSpeed = 0.5;           // Units per second (default)
    this.wanderSpeed = 0.35;        // Units per second during wander
    this.turnSpeed = 0.4;           // Radians per second (slow turning)
    this.gaitDuration = 1.1;        // Seconds per full gait cycle (heavier pace)
    this.gaitPhase = 0;             // 0..2π

    this.worldBoundsRadius = 5.0;   // How far from origin before turning back
    this.idleTimer = 1.2;           // Legacy idle timer (not used in FSM)

    // Forward direction in XZ plane
    this.direction = new THREE.Vector3(0, 0, 1);
    this.tempVec = new THREE.Vector3();

    // Internal timers
    this._idleTime = 0;

    // Scratch quaternion
    this.tempQuat = new THREE.Quaternion();

    // Secondary motion spring states for trunk, ears and tail
    this._spring = {
      trunk: { angle: 0, velocity: 0 },
      ears: { angle: 0, velocity: 0 },
      tail: { angle: 0, velocity: 0 }
    };
  }

  /**
   * Main update entry. Call once per frame with delta time in seconds.
   */
  update(dt) {
    const bones = this.cat.bones;
    const root = bones['spine_base'];
    const mesh = this.cat.mesh;

    if (!bones || !root || !mesh) return;
    // Update state timers
    this._stateTime += dt;
    this._stateTimer -= dt;

    // When the state timer expires choose a new state.  Idle mostly,
    // occasionally wander or curious.  After a wander or curious
    // sequence we always return to idle to avoid endless loops.
    if (this._stateTimer <= 0) {
      if (this.state === 'idle') {
        const r = Math.random();
        if (r < 0.65) {
          // remain idle for another interval
          this.state = 'idle';
          this._stateTimer = 4 + Math.random() * 3; // 4–7s
        } else if (r < 0.9) {
          // wander
          this.state = 'wander';
          this._stateTimer = 5 + Math.random() * 4; // 5–9s
        } else {
          // curious
          this.state = 'curious';
          this._stateTimer = 3 + Math.random() * 2; // 3–5s
        }
      } else {
        // After wander or curious always return to idle
        this.state = 'idle';
        this._stateTimer = 4 + Math.random() * 3;
      }
      // Reset state time counter when switching states
      this._stateTime = 0;
      // Notify parent behaviour (optional)
      if (this.cat.setState) this.cat.setState(this.state);
    }

    // Dispatch update based on current state
    switch (this.state) {
      case 'wander':
        this.updateWander(dt, root, mesh, bones);
        break;
      case 'curious':
        this.updateCurious(dt, root, bones);
        break;
      case 'idle':
      default:
        this.updateIdle(dt, root, bones);
        break;
    }

    // Apply secondary motion springs to trunk, ears and tail
    this.applySecondaryMotion(dt, bones);
  }

  // -----------------------------
  // IDLE STATE
  // -----------------------------
  updateIdle(dt, root, bones) {
    this._idleTime += dt;
    // Breathing: slow up/down motion of body.  The amplitude is
    // increased slightly and phase offset by a small random value to
    // avoid repetition.
    const breathe = Math.sin(this._idleTime * 1.0 + 0.3) * 0.025;
    // Occasional tiny weight shifts left/right using a slow sine
    const sway = Math.sin(this._idleTime * 0.3) * 0.02;
    root.position.set(sway, this.baseHeight + breathe, 0);

    // Head: very slight sway & nod
    const head = bones['head'];
    const spineNeck = bones['spine_neck'];
    const spineMid = bones['spine_mid'];

    if (spineMid) {
      spineMid.rotation.x = 0.03 * Math.sin(this._idleTime * 0.7);
      spineMid.rotation.z = 0.02 * Math.sin(this._idleTime * 0.5);
    }

    if (spineNeck) {
      spineNeck.rotation.x = 0.05 + 0.03 * Math.sin(this._idleTime * 0.8);
      spineNeck.rotation.y = 0.05 * Math.sin(this._idleTime * 0.6);
    }

    if (head) {
      head.rotation.x = -0.15 + 0.05 * Math.sin(this._idleTime * 0.9);
      head.rotation.y = 0.05 * Math.sin(this._idleTime * 0.7);
    }

    // Idle trunk and ear motion is handled by secondary springs; remove explicit calls.
  }

  /**
   * Wander state: the cat ambles slowly around the pen.  We reuse
   * the existing walking implementation but substitute the wander
   * speed for the usual walk speed.
   */
  updateWander(dt, root, mesh, bones) {
    // Temporarily override walkSpeed while wandering
    const prevSpeed = this.walkSpeed;
    this.walkSpeed = this.wanderSpeed;
    // Use existing walking logic
    this.updateWalk(dt, root, mesh, bones);
    // Restore original walking speed
    this.walkSpeed = prevSpeed;
  }

  /**
   * Curious state: the cat pauses and raises its head and trunk as
   * if inspecting something.  No forward movement takes place.
   */
  updateCurious(dt, root, bones) {
    // Keep the body stationary at base height
    root.position.set(0, this.baseHeight, 0);
    // Slow idle sway of the body
    root.rotation.z = 0.02 * Math.sin(this._stateTime * 1.5);

    const spineNeck = bones['spine_neck'];
    const head = bones['head'];
    const trunkBase = bones['trunk_base'];
    const trunkMid = bones['trunk_mid'];
    const trunkTip = bones['trunk_tip'];

    // Raise the head and look around gently
    if (spineNeck) {
      spineNeck.rotation.x = 0.1 + 0.05 * Math.sin(this._stateTime * 2.0);
      spineNeck.rotation.y = 0.1 * Math.sin(this._stateTime * 1.0);
    }
    if (head) {
      head.rotation.x = -0.05 + 0.07 * Math.sin(this._stateTime * 2.5);
      head.rotation.y = 0.08 * Math.sin(this._stateTime * 1.7);
    }
    // Lift the trunk
    const lift = 0.3 + 0.1 * Math.sin(this._stateTime * 2.2);
    if (trunkBase) {
      trunkBase.rotation.x = -lift * 0.5;
      trunkBase.rotation.y = 0.0;
    }
    if (trunkMid) {
      trunkMid.rotation.x = -lift * 0.8;
      trunkMid.rotation.y = 0.0;
    }
    if (trunkTip) {
      trunkTip.rotation.x = -lift;
      trunkTip.rotation.y = 0.0;
    }
    // Ears flick slightly during curiosity
    const earLeft = bones['ear_left'];
    const earRight = bones['ear_right'];
    const flap = 0.15 * Math.sin(this._stateTime * 3.0);
    if (earLeft) earLeft.rotation.z = flap;
    if (earRight) earRight.rotation.z = -flap;
  }

  /**
   * Apply damped spring secondary motion to the trunk, ears and tail.
   * This introduces a lagging motion that follows the cat's
   * forward velocity and turning rate.  The springs integrate simple
   * physics each frame: acceleration is proportional to the difference
   * between the target and current angle minus a damping term.
   */
  applySecondaryMotion(dt, bones) {
    // Determine the desired amplitude based on current state.  When
    // wandering we use the wanderSpeed; otherwise the target speed is 0
    const speed = this.state === 'wander' ? this.wanderSpeed : 0;
    // Target swing for trunk/ears/tail scales with speed
    const trunkTarget = speed * 0.4;
    const earsTarget  = speed * 0.3;
    const tailTarget  = speed * 0.5;
    // Spring constants
    const stiffness = 10.0;
    const damping = 5.0;

    // --- Trunk spring ---
    {
      const s = this._spring.trunk;
      const acc = (trunkTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle += s.velocity * dt;
      // Apply to trunk bones if they exist
      const trunkBase = bones['trunk_base'];
      const trunkMid1 = bones['trunk_mid1'] || bones['trunk_mid'];
      const trunkMid2 = bones['trunk_mid2'];
      const trunkTip = bones['trunk_tip'];
      if (trunkBase) trunkBase.rotation.y += s.angle * 0.7;
      if (trunkMid1) trunkMid1.rotation.y += s.angle * 0.5;
      if (trunkMid2) trunkMid2.rotation.y += s.angle * 0.35;
      if (trunkTip) trunkTip.rotation.y += s.angle * 0.2;
    }
    // --- Ears spring ---
    {
      const s = this._spring.ears;
      const acc = (earsTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle += s.velocity * dt;
      // Apply symmetrical ear swing around Z axis
      const earLeft = bones['ear_left'];
      const earRight = bones['ear_right'];
      if (earLeft) earLeft.rotation.z += s.angle;
      if (earRight) earRight.rotation.z -= s.angle;
    }
    // --- Tail spring ---
    {
      const s = this._spring.tail;
      const acc = (tailTarget - s.angle) * stiffness - s.velocity * damping;
      s.velocity += acc * dt;
      s.angle += s.velocity * dt;
      const tailBase = bones['tail_base'];
      const tailMid = bones['tail_mid'];
      const tailTip = bones['tail_tip'];
      if (tailBase) tailBase.rotation.y += s.angle * 0.6;
      if (tailMid) tailMid.rotation.y += s.angle * 0.4;
      if (tailTip) tailTip.rotation.y += s.angle * 0.2;
    }
  }

  applyTrunkIdle(bones, t) {
    const trunkBase = bones['trunk_base'];
    const trunkMid = bones['trunk_mid'];
    const trunkTip = bones['trunk_tip'];

    if (!trunkBase && !trunkMid && !trunkTip) return;

    // Very gentle rhythmic sway
    const swaySlow = Math.sin(t * 0.5) * 0.15;  // horizontal yaw
    const dipSlow = Math.sin(t * 0.65) * 0.08;  // pitch

    if (trunkBase) {
      trunkBase.rotation.y = swaySlow * 0.7;
      trunkBase.rotation.x = dipSlow * 0.4;
    }
    if (trunkMid) {
      trunkMid.rotation.y = swaySlow * 0.4;
      trunkMid.rotation.x = dipSlow * 0.7;
    }
    if (trunkTip) {
      trunkTip.rotation.y = swaySlow * 0.3;
      trunkTip.rotation.x = dipSlow * 0.9;
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
      // Rotate around local Z or X depending on your rig; here use Z
      earLeft.rotation.z = totalFlapLeft;
    }
    if (earRight) {
      earRight.rotation.z = -totalFlapRight;
    }
  }

  // -----------------------------
  // WALK STATE
  // -----------------------------
  updateWalk(dt, root, mesh, bones) {
    // Advance local walk time
    this._idleTime += dt; // reuse same clock for trunk/ears

    // Advance gait phase (0..2π)
    const TWO_PI = Math.PI * 2;
    this.gaitPhase = (this.gaitPhase + (dt / this.gaitDuration) * TWO_PI) % TWO_PI;

    // Wander logic: steer gently back toward origin if too far
    const distFromOrigin = Math.sqrt(mesh.position.x ** 2 + mesh.position.z ** 2);
    if (distFromOrigin > this.worldBoundsRadius) {
      // Turn back toward (0,0) in XZ
      this.tempVec.set(-mesh.position.x, 0, -mesh.position.z).normalize();
      this.turnToward(this.tempVec, dt);
    } else if (Math.random() < dt * 0.2) {
      // Small random heading jitter for wandering
      const randomTurn = (Math.random() - 0.5) * this.turnSpeed * dt;
      this.rotateDirection(randomTurn);
    }

    // Move the mesh forward in the current direction
    mesh.position.addScaledVector(this.direction, this.walkSpeed * dt);

    // Align root's Y-rotation to direction
    const heading = Math.atan2(this.direction.x, this.direction.z); // (x, z)
    root.rotation.y = heading;

    // Body bob: heavy, slow vertical & slight roll
    const bobMain = Math.sin(this.gaitPhase * 2.0) * 0.06;   // vertical
    const roll = Math.sin(this.gaitPhase * 1.0) * 0.03;      // side-to-side
    root.position.set(0, this.baseHeight + bobMain, 0);
    root.rotation.z = roll;

    // Apply quadruped cat walk pose
    this.applyWalkPose(this.gaitPhase, bones);

    // Add trunk and ears reacting to walk
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
    const currentHeading = Math.atan2(this.direction.x, this.direction.z);
    const targetHeading = Math.atan2(targetDir.x, targetDir.z);
    let delta = targetHeading - currentHeading;

    // Wrap to [-π, π]
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    const maxTurn = this.turnSpeed * dt;
    delta = THREE.MathUtils.clamp(delta, -maxTurn, maxTurn);

    this.rotateDirection(delta);
  }

  applyWalkPose(phase, bones) {
    const TWO_PI = Math.PI * 2;

    // Cats have a lateral sequence gait:
    // - Left hind -> Left fore -> Right hind -> Right fore
    // We'll approximate by having left side share one phase,
    // right side the opposite (phase + π), but with heavier, slower swings.

    const phaseLeft = phase;                      // left limbs
    const phaseRight = (phase + Math.PI) % TWO_PI; // right limbs

    // Helper to get swing
    const swingAmpFront = 0.4;  // smaller front swing
    const swingAmpBack = 0.5;   // slightly stronger back swing
    const kneeBendFront = 0.7;
    const kneeBendBack = 0.9;

    const swingLeft = Math.sin(phaseLeft);
    const swingRight = Math.sin(phaseRight);

    // BACK LEFT (phaseLeft)
    const blUpper = bones['back_left_upper_leg'];
    const blLower = bones['back_left_lower_leg'];
    if (blUpper && blLower) {
      // Upper swings forward/back
      blUpper.rotation.x = swingAmpBack * swingLeft;
      // Lower bends more when leg is behind
      blLower.rotation.x = kneeBendBack * Math.max(0, -swingLeft);
    }

    // FRONT LEFT (phaseLeft, but with smaller amplitude and phase lag)
    const flUpper = bones['front_left_upper_leg'];
    const flLower = bones['front_left_lower_leg'];
    const swingLeftFront = Math.sin(phaseLeft + 0.3); // a bit offset from hind
    if (flUpper && flLower) {
      flUpper.rotation.x = swingAmpFront * swingLeftFront;
      flLower.rotation.x = kneeBendFront * Math.max(0, -swingLeftFront);
    }

    // BACK RIGHT (phaseRight)
    const brUpper = bones['back_right_upper_leg'];
    const brLower = bones['back_right_lower_leg'];
    if (brUpper && brLower) {
      brUpper.rotation.x = swingAmpBack * swingRight;
      brLower.rotation.x = kneeBendBack * Math.max(0, -swingRight);
    }

    // FRONT RIGHT (phaseRight with small offset)
    const frUpper = bones['front_right_upper_leg'];
    const frLower = bones['front_right_lower_leg'];
    const swingRightFront = Math.sin(phaseRight + 0.3);
    if (frUpper && frLower) {
      frUpper.rotation.x = swingAmpFront * swingRightFront;
      frLower.rotation.x = kneeBendFront * Math.max(0, -swingRightFront);
    }

    // Spine follow-through: gentle nod & sway
    const spineMid = bones['spine_mid'];
    const spineNeck = bones['spine_neck'];
    const head = bones['head'];

    const bodyPitch = Math.sin(phase * 1.0) * 0.03;
    const bodyYaw = Math.sin(phase * 0.5) * 0.02;

    if (spineMid) {
      spineMid.rotation.x = bodyPitch;
      spineMid.rotation.y = bodyYaw * 0.7;
    }
    if (spineNeck) {
      spineNeck.rotation.x = 0.1 + bodyPitch * 0.5;
      spineNeck.rotation.y = bodyYaw;
    }
    if (head) {
      head.rotation.x = -0.2 + bodyPitch * -0.3;
      head.rotation.y = bodyYaw * 1.2;
    }
  }

  applyTrunkWalk(bones, t, phase) {
    const trunkBase = bones['trunk_base'];
    const trunkMid = bones['trunk_mid'];
    const trunkTip = bones['trunk_tip'];

    if (!trunkBase && !trunkMid && !trunkTip) return;

    // Walking adds a rhythmic trunk swing synchronized with gait
    const gaitSway = Math.sin(phase) * 0.25;      // left/right
    const gaitDip = Math.sin(phase * 2.0) * 0.1;  // up/down

    // Idle baseline sway layered in for organic motion
    const idleSway = Math.sin(t * 0.6) * 0.08;
    const idleDip = Math.sin(t * 0.8) * 0.05;

    const sway = gaitSway + idleSway;
    const dip = gaitDip + idleDip;

    if (trunkBase) {
      trunkBase.rotation.y = sway * 0.8;
      trunkBase.rotation.x = dip * 0.4;
    }
    if (trunkMid) {
      trunkMid.rotation.y = sway * 0.6;
      trunkMid.rotation.x = dip * 0.8;
    }
    if (trunkTip) {
      trunkTip.rotation.y = sway * 0.5;
      trunkTip.rotation.x = dip * 1.0;
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
      earLeft.rotation.z = totalLeft;
    }
    if (earRight) {
      earRight.rotation.z = -totalRight;
    }
  }

  // -----------------------------
  // RESET (if you need it)
  // -----------------------------
  resetBones() {
    const bones = this.cat.bones;
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
