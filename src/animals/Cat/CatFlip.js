// src/animals/CatLocomotion.js

import * as THREE from 'three';

export class CatLocomotion {
  constructor(cat) {
    this.cat = cat;
    this.state = 'ground'; 
    
    // --- CONFIGURATION ---
    this.jumpTimer = 0;
    this.jumpDuration = 1.4;  // Good speed for a standing flip
    this.jumpCooldown = 2.0;
    this.jumpHeight = 3.5;    // Higher jump since we aren't moving forward
    
    // State tracking
    this.jumpInProgress = false;
    this.jumpElapsed = 0;
    
    // Physics helpers
    this.startPosition = new THREE.Vector3();
    
    // QUATERNION HELPERS
    this.startRotation = new THREE.Quaternion();
    this.flipAxis = new THREE.Vector3(1, 0, 0); // X-axis for forward flip
    this.tempQuat = new THREE.Quaternion();
  }

  tryJump() {
    if (this.jumpInProgress || this.jumpTimer > 0) return false;

    this.jumpInProgress = true;
    this.jumpElapsed = 0;
    
    // 1. Lock the Start Position (We will stay here on X/Z)
    this.startPosition.copy(this.cat.mesh.position);
    
    const root = this.cat.bones['spine_base'];
    if (root) {
      this.startRotation.copy(root.quaternion);
    }

    if (this.cat.setState) this.cat.setState('jump');
    return true;
  }

  update(dt) {
    if (!this.jumpInProgress) {
      this.jumpTimer = Math.max(0, this.jumpTimer - dt);
      // Random jump chance
      if (this.jumpTimer === 0 && Math.random() < dt * 0.05) this.tryJump();
      return;
    }

    this.jumpElapsed += dt;
    const t = Math.min(1, this.jumpElapsed / this.jumpDuration);
    const root = this.cat.bones['spine_base'];
    if (!root) return; 

    // === LOCK X & Z POSITIONS (Jump in Place) ===
    // This ensures the cat lands exactly where it started (same Z)
    root.position.x = this.startPosition.x;
    root.position.z = this.startPosition.z;

    // === PHASE 1: LAUNCH (0% - 15%) ===
    if (t < 0.15) {
      const launchT = t / 0.15;
      
      // Slight dip before jump
      const yOffset = Math.sin(launchT * Math.PI / 2) * 0.5;
      root.position.y = this.startPosition.y + 0.35 + yOffset; 

      this.applyPose(launchT, 'launch');
      root.quaternion.copy(this.startRotation);
    }
    
    // === PHASE 2: AIRBORNE SPIN (15% - 85%) ===
    else if (t < 0.85) {
      const spinT = (t - 0.15) / 0.70; 
      
      // 1. Height (Parabola)
      const height = Math.sin(spinT * Math.PI) * this.jumpHeight;
      root.position.y = (this.startPosition.y + 0.35) + height;
      
      // 2. The Flip (Rotation)
      // Ease in/out for smooth spin
      const rotEase = spinT < 0.5 
        ? 2 * spinT * spinT 
        : -1 + (4 - 2 * spinT) * spinT;
      
      const angle = Math.PI * 2 * rotEase; 
      this.tempQuat.setFromAxisAngle(this.flipAxis, angle);
      root.quaternion.copy(this.startRotation).multiply(this.tempQuat);

      // 3. The Tuck Logic
      // We peak the tuck in the middle of the air
      const tuckEase = Math.sin(spinT * Math.PI);

      // Subtle root offset to help the visual tuck (rotate hips slightly back)
      const tuckQuat = new THREE.Quaternion();
      tuckQuat.setFromAxisAngle(this.flipAxis, -0.3 * tuckEase);
      root.quaternion.multiply(tuckQuat);

      this.applyPose(tuckEase, 'tuck');
    }

    // === PHASE 3: LAND (85% - 100%) ===
    else {
      const landT = (t - 0.85) / 0.15; 
      
      const settle = Math.sin(landT * Math.PI); 
      root.position.y = (this.startPosition.y + 0.35) - (0.2 * settle);

      // Slerp rotation back to perfect upright
      root.quaternion.slerp(this.startRotation, landT);

      this.applyPose(landT, 'land');
    }

    // Reset
    if (t >= 1) {
      this.jumpInProgress = false;
      this.jumpTimer = this.jumpCooldown;
      this.resetBones();
      if (this.cat.setState) this.cat.setState('walk');
    }
  }

  applyPose(intensity, type) {
    const bones = this.cat.bones;
    
    if (type === 'launch') {
      // Look up slightly (Anticipation)
      if (bones['head']) bones['head'].rotation.x = -0.5 * intensity;
      
      // Crouch back legs
      ['back_left_upper_leg', 'back_right_upper_leg'].forEach(b => {
        if (bones[b]) bones[b].rotation.x = 0.8 - (1.5 * intensity);
      });
    }

    else if (type === 'tuck') {
      // === NATURAL TUCK ===
      
      // 1. HEAD & NECK (The Fix)
      // Instead of snapping the head 140 degrees, we share the load.
      // Neck curves gently (45 deg), Head tucks slightly (30 deg).
      // This creates a "C" shape rather than a "V" break.
      if (bones['spine_neck']) bones['spine_neck'].rotation.x = 0.8 * intensity; 
      if (bones['head'])       bones['head'].rotation.x       = 0.5 * intensity; 

      // Spine curls to support the head
      if (bones['spine_mid'])  bones['spine_mid'].rotation.x  = 0.6 * intensity;

      // 2. LEGS (Tight ball)
      ['back_left', 'back_right'].forEach(side => {
        const upper = bones[`${side}_upper_leg`];
        const lower = bones[`${side}_lower_leg`];
        if (upper) upper.rotation.x = -1.2 * intensity; // Thighs to chest
        if (lower) lower.rotation.x = 2.2 * intensity;  // Knees compressed
      });

      ['front_left', 'front_right'].forEach(side => {
        const upper = bones[`${side}_upper_leg`];
        const lower = bones[`${side}_lower_leg`];
        if (upper) upper.rotation.x = -0.5 * intensity; // Arms back
        if (lower) lower.rotation.x = -2.0 * intensity; // Elbows tight
      });

      // 3. TAIL (Tucks under)
      if (bones['tail_base']) bones['tail_base'].rotation.x = -1.5 * intensity;
      if (bones['tail_mid'])  bones['tail_mid'].rotation.x  = -1.0 * intensity;
    }

    else if (type === 'land') {
      const impact = 1 - intensity;

      // Soft absorb
      ['back_left_upper_leg', 'back_right_upper_leg'].forEach(b => {
        if (bones[b]) bones[b].rotation.x = 0.5 * impact;
      });
      
      // Head levels out immediately to look forward
      if (bones['head']) bones['head'].rotation.x = -0.2 * impact;
    }
  }

  resetBones() {
    const bones = this.cat.bones;
    const root = bones['spine_base'];
    
    if (root) {
      root.rotation.set(0, 0, 0);
      if (root.quaternion.identity) root.quaternion.identity();
      root.position.set(this.startPosition.x, 0.35, this.startPosition.z);
      root.updateMatrix();
    }

    Object.keys(bones).forEach(k => {
      if (k !== 'spine_base') bones[k].rotation.set(0, 0, 0);
    });
  }
}