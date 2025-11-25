// src/animals/CatLocomotion.js

import * as THREE from 'three';

export class CatLocomotion {
  constructor(cat) {
    this.cat = cat;
    this.state = 'idle'; // 'idle', 'walk', 'jump'

    // --- LOCOMOTION CONFIG ---
    this.baseHeight = 0.35;        // Base Y of spine_base above "ground"
    this.walkSpeed = 0.8;          // Units per second
    this.turnSpeed = 0.6;          // Radians per second
    this.gaitDuration = 0.6;       // Seconds per full gait cycle
    this.gaitPhase = 0;            // 0..2π

    this.worldBoundsRadius = 4.0;  // How far from origin before turning back
    this.idleTimer = 0.5;          // Brief pause before walking starts

    // Forward direction in XZ plane
    this.direction = new THREE.Vector3(1, 0, 0);
    this.tempVec = new THREE.Vector3();

    // --- JUMP / POUNCE CONFIG (NO FLIP) ---
    this.jumpTimer = 0;
    this.jumpDuration = 0.7;        // Quick pounce
    this.jumpCooldown = 3.0;
    this.jumpHeight = 0.9;          // How high the body goes
    this.jumpForwardDistance = 1.8; // How far forward the pounce travels

    // Jump state tracking
    this.jumpInProgress = false;
    this.jumpElapsed = 0;
    this.startPosition = new THREE.Vector3(); // world position of mesh at jump start
    this.startRotation = new THREE.Quaternion(); // root rotation at jump start

    // Scratch helpers
    this.tempQuat = new THREE.Quaternion();
  }

  // Public: ask the cat to jump/pounce forward (no flip)
  tryJump() {
    if (this.jumpInProgress || this.jumpTimer > 0) return false;

    const mesh = this.cat.mesh;
    const root = this.cat.bones['spine_base'];
    if (!mesh || !root) return false;

    this.jumpInProgress = true;
    this.jumpElapsed = 0;

    // Store starting world position for the mesh
    this.startPosition.copy(mesh.position);

    // Capture starting body orientation (used to keep the body aligned)
    this.startRotation.copy(root.quaternion);

    this.state = 'jump';
    if (this.cat.setState) this.cat.setState('jump');
    return true;
  }

  // Main update entry
  update(dt) {
    const bones = this.cat.bones;
    const root = bones['spine_base'];
    const mesh = this.cat.mesh;

    if (!bones || !root || !mesh) return;

    // Cool down jump timer
    if (!this.jumpInProgress) {
      this.jumpTimer = Math.max(0, this.jumpTimer - dt);
    }

    // If jump in progress, handle that first
    if (this.jumpInProgress) {
      this.updateJump(dt, root, mesh);
      return;
    }

    // When not jumping, we are either idle or walking
    if (this.state === 'idle') {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.state = 'walk';
        if (this.cat.setState) this.cat.setState('walk');
      } else {
        // Slight idle sway (breathing)
        this.applyIdlePose(bones, dt);
        return;
      }
    }

    // Low chance of a playful pounce while walking
    if (this.state === 'walk' && this.jumpTimer === 0 && Math.random() < dt * 0.08) {
      if (this.tryJump()) {
        return;
      }
    }

    // Update walking locomotion
    this.updateWalk(dt, root, mesh);
  }

  // -----------------------------
  // WALKING LOCOMOTION
  // -----------------------------
  updateWalk(dt, root, mesh) {
    // Advance gait phase
    const TWO_PI = Math.PI * 2;
    this.gaitPhase = (this.gaitPhase + (dt / this.gaitDuration) * TWO_PI) % TWO_PI;

    // Wander logic: steer gently back toward origin if too far
    const distFromOrigin = Math.sqrt(mesh.position.x ** 2 + mesh.position.z ** 2);
    if (distFromOrigin > this.worldBoundsRadius) {
      // Turn back toward (0,0) in XZ
      this.tempVec.set(-mesh.position.x, 0, -mesh.position.z).normalize();
      this.turnToward(this.tempVec, dt);
    } else if (Math.random() < dt * 0.3) {
      // Small random heading jitter for wandering
      const randomTurn = (Math.random() - 0.5) * this.turnSpeed * dt;
      this.rotateDirection(randomTurn);
    }

    // Move the mesh forward in the current direction
    mesh.position.addScaledVector(this.direction, this.walkSpeed * dt);

    // Align root's Y-rotation to direction
    const heading = Math.atan2(this.direction.x, this.direction.z); // note: (x, z)
    root.rotation.y = heading;

    // Body bob based on gait
    const bob = Math.sin(this.gaitPhase * 2.0) * 0.05;
    root.position.set(0, this.baseHeight + bob, 0);

    // Apply a quadruped gait pose
    this.applyWalkPose(this.gaitPhase);
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

  applyIdlePose(bones, dt) {
    // Very subtle breathing motion when idle
    const root = bones['spine_base'];
    if (!root) return;

    // Use time-based oscillation for breathing
    if (!this._idleTime) this._idleTime = 0;
    this._idleTime += dt;

    const breathe = Math.sin(this._idleTime * 2.0) * 0.02;
    root.position.set(0, this.baseHeight + breathe, 0);

    // Slight head movement
    const head = bones['head'];
    if (head) {
      head.rotation.x = -0.1 + Math.sin(this._idleTime * 0.8) * 0.05;
      head.rotation.y = Math.sin(this._idleTime * 0.5) * 0.08;
    }
  }

  applyWalkPose(phase) {
    const bones = this.cat.bones;
    const TWO_PI = Math.PI * 2;

    // Phases: diagonal pairs offset by π (180°)
    const phaseA = phase;             // front_left + back_right
    const phaseB = (phase + Math.PI) % TWO_PI; // front_right + back_left

    // Helper to get swing from phase
    const swingAmpFront = 0.55;
    const swingAmpBack = 0.7;
    const kneeBendFront = 0.8;
    const kneeBendBack = 1.0;

    // General swing curve: more weight on stance, lighter on swing
    const swingA = Math.sin(phaseA);
    const swingB = Math.sin(phaseB);

    // FRONT LEFT (phaseA)
    const flUpper = bones['front_left_upper_leg'];
    const flLower = bones['front_left_lower_leg'];
    if (flUpper && flLower) {
      flUpper.rotation.x = swingAmpFront * swingA;         // swing forward/back
      flLower.rotation.x = -kneeBendFront * Math.max(0, -swingA); // bend knee when leg moves back
    }

    // BACK RIGHT (phaseA)
    const brUpper = bones['back_right_upper_leg'];
    const brLower = bones['back_right_lower_leg'];
    if (brUpper && brLower) {
      brUpper.rotation.x = swingAmpBack * -swingA;         // opposite direction for back leg
      brLower.rotation.x = kneeBendBack * Math.max(0, swingA);
    }

    // FRONT RIGHT (phaseB)
    const frUpper = bones['front_right_upper_leg'];
    const frLower = bones['front_right_lower_leg'];
    if (frUpper && frLower) {
      frUpper.rotation.x = swingAmpFront * swingB;
      frLower.rotation.x = -kneeBendFront * Math.max(0, -swingB);
    }

    // BACK LEFT (phaseB)
    const blUpper = bones['back_left_upper_leg'];
    const blLower = bones['back_left_lower_leg'];
    if (blUpper && blLower) {
      blUpper.rotation.x = swingAmpBack * -swingB;
      blLower.rotation.x = kneeBendBack * Math.max(0, swingB);
    }

    // Spine & head follow-through (slight counter-motion)
    const spineMid = bones['spine_mid'];
    const spineNeck = bones['spine_neck'];
    const head = bones['head'];

    const bodyRoll = Math.sin(phase * 2.0) * 0.05;
    const bodyPitch = Math.sin(phase) * 0.03;

    if (spineMid) {
      spineMid.rotation.x = bodyPitch;
      spineMid.rotation.z = bodyRoll;
    }
    if (spineNeck) {
      spineNeck.rotation.x = 0.25 + bodyPitch * 0.5;
    }
    if (head) {
      head.rotation.x = -0.2 + bodyPitch * -0.5;
      head.rotation.y = Math.sin(phase * 0.5) * 0.1;
    }

    // Tail swish
    const tailBase = bones['tail_base'];
    const tailMid = bones['tail_mid'];
    const tailTip = bones['tail_tip'];
    const tailSwing = Math.sin(phase * 1.5) * 0.3;

    if (tailBase) tailBase.rotation.y = tailSwing * 0.7;
    if (tailMid) tailMid.rotation.y = tailSwing * 0.4;
    if (tailTip) tailTip.rotation.y = tailSwing * 0.2;
  }

  // -----------------------------
  // JUMP / POUNCE (NO FLIP)
  // -----------------------------
  updateJump(dt, root, mesh) {
    this.jumpElapsed += dt;
    const tRaw = this.jumpElapsed / this.jumpDuration;
    const t = Math.min(1, tRaw);

    // Basic ballistic arc: up then down
    const height = Math.sin(t * Math.PI) * this.jumpHeight;

    // Forward progress along direction
    const forward = this.jumpForwardDistance * t;

    // New world position
    mesh.position.copy(this.startPosition);
    mesh.position.addScaledVector(this.direction, forward);

    // Vertical offset on the root
    root.position.set(0, this.baseHeight + height, 0);

    // Keep body aligned with startRotation, with a bit of pitch for takeoff/landing
    const pitchAmount = (t < 0.5)
      ? THREE.MathUtils.lerp(0, 0.25, t * 2.0)   // lean forward on takeoff
      : THREE.MathUtils.lerp(0.25, -0.15, (t - 0.5) * 2.0); // then lean back to absorb landing

    this.tempQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchAmount);
    root.quaternion.copy(this.startRotation).multiply(this.tempQuat);

    // Pose legs/head for different jump phases
    if (t < 0.25) {
      // Launch
      const launchT = t / 0.25;
      this.applyPose(launchT, 'launch');
    } else if (t < 0.75) {
      // Mid-air tuck (small, natural)
      const midT = (t - 0.25) / 0.5;
      this.applyPose(midT, 'air');
    } else {
      // Landing
      const landT = (t - 0.75) / 0.25;
      this.applyPose(landT, 'land');
    }

    // Reset
    if (t >= 1) {
      this.jumpInProgress = false;
      this.jumpTimer = this.jumpCooldown;
      this.state = 'walk';
      this.resetBones();
      if (this.cat.setState) this.cat.setState('walk');
    }
  }

  applyPose(intensity, type) {
    const bones = this.cat.bones;

    if (type === 'launch') {
      // Slight crouch and prepare to spring
      ['back_left_upper_leg', 'back_right_upper_leg'].forEach(name => {
        const b = bones[name];
        if (b) b.rotation.x = THREE.MathUtils.lerp(0, -1.0, intensity);
      });
      ['front_left_upper_leg', 'front_right_upper_leg'].forEach(name => {
        const b = bones[name];
        if (b) b.rotation.x = THREE.MathUtils.lerp(0, 0.3, intensity);
      });

      const head = bones['head'];
      if (head) head.rotation.x = THREE.MathUtils.lerp(-0.1, 0.05, intensity);
    }

    else if (type === 'air') {
      // Legs tuck slightly toward body for a compact flight
      ['back_left_upper_leg', 'back_right_upper_leg'].forEach(name => {
        const upper = bones[name];
        const lower = bones[name.replace('upper', 'lower')];
        if (upper) upper.rotation.x = -0.6 * intensity;
        if (lower) lower.rotation.x = 0.9 * intensity;
      });

      ['front_left_upper_leg', 'front_right_upper_leg'].forEach(name => {
        const upper = bones[name];
        const lower = bones[name.replace('upper', 'lower')];
        if (upper) upper.rotation.x = 0.4 * intensity;
        if (lower) lower.rotation.x = -0.5 * intensity;
      });

      const tailBase = bones['tail_base'];
      const tailMid = bones['tail_mid'];
      if (tailBase) tailBase.rotation.x = -0.5 * intensity;
      if (tailMid) tailMid.rotation.x = -0.3 * intensity;
    }

    else if (type === 'land') {
      const impact = 1 - intensity;

      // Back legs absorb landing
      ['back_left_upper_leg', 'back_right_upper_leg'].forEach(name => {
        const b = bones[name];
        if (b) b.rotation.x = -0.4 * impact;
      });
      ['back_left_lower_leg', 'back_right_lower_leg'].forEach(name => {
        const b = bones[name];
        if (b) b.rotation.x = 0.8 * impact;
      });

      // Front legs reach forward then settle
      ['front_left_upper_leg', 'front_right_upper_leg'].forEach(name => {
        const b = bones[name];
        if (b) b.rotation.x = 0.2 * impact;
      });

      const head = bones['head'];
      if (head) head.rotation.x = THREE.MathUtils.lerp(0.1, -0.15, intensity);
    }
  }

  resetBones() {
    const bones = this.cat.bones;
    const root = bones['spine_base'];

    if (root) {
      root.rotation.set(0, root.rotation.y, 0); // keep heading, reset pitch/roll
      // Keep root at base height, local to mesh
      root.position.set(0, this.baseHeight, 0);
      root.updateMatrix();
    }

    Object.keys(bones).forEach(k => {
      if (k === 'spine_base') return;
      const b = bones[k];
      if (!b) return;
      // Reset local rotations for non-root bones; walk/jump will reapply poses
      b.rotation.set(0, 0, 0);
    });
  }
}
