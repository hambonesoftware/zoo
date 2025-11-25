// src/animals/CatBehavior.js

import * as THREE from 'three';
import { CatLocomotion } from './CatLocomotion.js';
import { maybeTriggerJump, animateJump } from './CatJump.js';
import { animateTail } from './CatTail.js';

/**
 * CatBehavior: Orchestrates procedural animation for a cat
 * Walk, jump, roll cycles using modular animation files
 */
export class CatBehavior {
  /**
   * @param {THREE.Skeleton} skeleton
   * @param {THREE.SkinnedMesh} mesh
   * @param {Object} opts - { furMesh }
   */
  constructor(skeleton, mesh, opts = {}) {
    this.skeleton = skeleton;
    this.mesh = mesh;
    this.furMesh = opts.furMesh || null;
    this.time = 0;

    // State
    this.state = 'walk';

    // Bone map for quick lookup
    this.bones = {};
    skeleton.bones.forEach(bone => {
      this.bones[bone.name] = bone;
    });

    // Limbs (customize as needed)
    // This is a placeholder - adjust limb mapping to your model!
    this.limbs = [
      {
        name: 'front_left',
        upper: 'front_left_upper_leg',
        lower: 'front_left_lower_leg',
        paw: 'front_left_paw',
        shoulder: 'front_left_shoulder',
        defaultUpperRotation: new THREE.Euler(0.0, 0, 0),
        defaultLowerRotation: new THREE.Euler(0.0, 0, 0),
        shoulderRotation: new THREE.Euler(0.0, 0, 0)
      },
      {
        name: 'front_right',
        upper: 'front_right_upper_leg',
        lower: 'front_right_lower_leg',
        paw: 'front_right_paw',
        shoulder: 'front_right_shoulder',
        defaultUpperRotation: new THREE.Euler(0.0, 0, 0),
        defaultLowerRotation: new THREE.Euler(0.0, 0, 0),
        shoulderRotation: new THREE.Euler(0.0, 0, 0)
      },
      {
        name: 'back_left',
        upper: 'back_left_upper_leg',
        lower: 'back_left_lower_leg',
        paw: 'back_left_paw',
        shoulder: 'back_left_hip',
        defaultUpperRotation: new THREE.Euler(0.0, 0, 0),
        defaultLowerRotation: new THREE.Euler(0.0, 0, 0),
        shoulderRotation: new THREE.Euler(0.0, 0, 0)
      },
      {
        name: 'back_right',
        upper: 'back_right_upper_leg',
        lower: 'back_right_lower_leg',
        paw: 'back_right_paw',
        shoulder: 'back_right_hip',
        defaultUpperRotation: new THREE.Euler(0.0, 0, 0),
        defaultLowerRotation: new THREE.Euler(0.0, 0, 0),
        shoulderRotation: new THREE.Euler(0.0, 0, 0)
      }
    ];

    // Optionally reset limb default pose at startup
    this.limbs.forEach(limb => {
      if (this.bones[limb.upper]) this.bones[limb.upper].rotation.copy(limb.defaultUpperRotation);
      if (this.bones[limb.lower]) this.bones[limb.lower].rotation.copy(limb.defaultLowerRotation);
      if (this.bones[limb.shoulder]) this.bones[limb.shoulder].rotation.copy(limb.shoulderRotation);
    });

    // Jump state for CatJump.js
    this.jumpState = { isJumping: false, timer: 0, duration: 1.2, progress: 0 };

    // Locomotion controller (handles jump+rolls)
    this.locomotion = new CatLocomotion(this);

    // Debug
    console.log('[CatBehavior] Initialized with bones:', Object.keys(this.bones));
  }

  /**
   * Main update tick (call every frame)
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.time += dt;

    // --- New Behavior: Use CatLocomotion as primary jump/roll controller ---
    this.locomotion.update(dt);

    // If not in the middle of a jump/roll, fallback to walk
    if (!this.locomotion.jumpInProgress) {
      // You may also use your simple walk cycle if you want, e.g.
      this.setState('walk');
      // You may put your animateWalkCycle here, or extend CatLocomotion to do it
    } else {
      this.setState('jump');
    }

    // Animate tail (blends jump/walk mood based on locomotion state)
    animateTail(this, this.time, {
      mood: this.state,
      jumpBlend: this.locomotion.jumpInProgress ? 1.0 : 0.0
    });

    // Animate fur if needed (optional)
    if (this.furMesh) {
      // animateFurPhysics(this, this.time);
    }
  }

  /**
   * State setter for walk/jump/idle
   * @param {string} state
   */
  setState(state) {
    this.state = state;
    switch (state) {
      case 'walk':
        this.walkSpeed = 2.5;
        this.strideLength = 0.35;
        break;
      case 'run':
        this.walkSpeed = 5.0;
        this.strideLength = 0.5;
        break;
      case 'idle':
        this.walkSpeed = 1.0;
        this.strideLength = 0.2;
        break;
      case 'jump':
        // Could customize if you want, e.g. special spine/leg params
        break;
      default:
        this.walkSpeed = 2.5;
        this.strideLength = 0.35;
    }
  }
  /**
   * Lightweight debug snapshot for the studio HUD.
   */
  getDebugInfo() {
    return {
      state: this.state,
      time: this.time,
      jumpInProgress: !!(this.locomotion && this.locomotion.jumpInProgress)
    };
  }

}