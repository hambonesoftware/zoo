// src/animals/Snake/SnakeLocomotion.js

import * as THREE from "three";

/**
 * SnakeLocomotion
 *
 * Minimal, stable serpentine movement:
 * - Root advances forward at a controlled speed.
 * - Each spine bone gets a phase-shifted yaw/roll to create a traveling wave.
 * - Tongue flicks periodically with quick extend/retract and small wiggle.
 *
 * This is tuned to "feel good" at low poly and keeps updates cheap.
 */
export class SnakeLocomotion {
  /**
   * @param {THREE.Bone} rootBone
   * @param {THREE.Bone[]} spineBones
   * @param {THREE.Bone} headBone
   * @param {THREE.Bone[]} tongueBones
   */
  constructor(rootBone, spineBones, headBone, tongueBones) {
    this.rootBone = rootBone;
    this.spineBones = spineBones;
    this.headBone = headBone;
    this.tongueBones = tongueBones;

    this.time = 0;

    // Movement settings (can be overridden by tuning)
    this.speed = 0.25;           // units/sec
    this.waveSpeed = 2.8;        // radians/sec
    this.wavePhaseStep = 0.55;   // radians per segment
    this.yawAmp = 0.28;          // radians
    this.rollAmp = 0.06;         // radians

    // Tongue
    this.tongueFlickRate = 1.6;   // flicks per second
    this.tongueExtendAmp = 0.9;   // scale 0..1
    this.tongueWiggleAmp = 0.15;  // radians
    this.tongueBaseOffset = new THREE.Vector3(0, -0.03, 0.12);

    // Internal
    this._tmpForward = new THREE.Vector3(0, 0, 1);
  }

  /**
   * @param {number} dt seconds
   * @param {Object} tuning
   */
  update(dt, tuning) {
    this.time += dt;

    const speed = (tuning?.motion?.speed ?? this.speed);
    const waveSpeed = (tuning?.motion?.waveSpeed ?? this.waveSpeed);
    const wavePhaseStep = (tuning?.motion?.wavePhaseStep ?? this.wavePhaseStep);
    const yawAmp = (tuning?.motion?.yawAmp ?? this.yawAmp);
    const rollAmp = (tuning?.motion?.rollAmp ?? this.rollAmp);

    // Move forward in root local space (+Z).
    this.rootBone.position.z += speed * dt;

    // Serpentine wave down the spine.
    for (let i = 0; i < this.spineBones.length; i++) {
      const b = this.spineBones[i];
      const phase = this.time * waveSpeed + i * wavePhaseStep;

      // Keep the wave stronger toward the middle and weaker at the head/tail.
      const mid = (this.spineBones.length - 1) * 0.5;
      const dist = Math.abs(i - mid) / Math.max(1, mid);
      const falloff = 1.0 - Math.pow(dist, 1.35);

      b.rotation.y = Math.sin(phase) * yawAmp * falloff;
      b.rotation.z = Math.sin(phase + Math.PI * 0.5) * rollAmp * falloff;
      b.rotation.x = 0;
    }

    // Slight head stabilization: reduce inherited wiggle a bit.
    const headStabilize = (tuning?.motion?.headStabilize ?? 0.5);
    this.headBone.rotation.y *= (1.0 - headStabilize);
    this.headBone.rotation.z *= (1.0 - headStabilize);

    // Tongue positioning (relative to head)
    this._updateTongue(dt, tuning);
  }

  _updateTongue(dt, tuning) {
    const rate = (tuning?.tongue?.flickRate ?? this.tongueFlickRate);
    const extendAmp = (tuning?.tongue?.extendAmp ?? this.tongueExtendAmp);
    const wiggleAmp = (tuning?.tongue?.wiggleAmp ?? this.tongueWiggleAmp);

    // A "flick" is a sharp burst. We'll use a pulsed sine.
    const flickPhase = this.time * rate * Math.PI * 2.0;
    // Pulse 0..1 with quick on/off
    const pulse = Math.pow(Math.max(0, Math.sin(flickPhase)), 6);
    const extend = pulse * extendAmp;

    // Set tongue base bone offset from head (mouth-ish)
    if (this.tongueBones.length > 0) {
      const base = this.tongueBones[0];
      const off = tuning?.tongue?.baseOffset ?? this.tongueBaseOffset;
      base.position.set(off.x, off.y, off.z + extend * 0.06);

      // Wiggle
      base.rotation.y = Math.sin(this.time * 16.0) * wiggleAmp * pulse;
      base.rotation.z = Math.sin(this.time * 19.0 + 1.2) * wiggleAmp * 0.6 * pulse;
      base.rotation.x = 0;
    }

    // Taper wiggle down the chain
    for (let i = 1; i < this.tongueBones.length; i++) {
      const b = this.tongueBones[i];
      const t = i / Math.max(1, this.tongueBones.length - 1);

      b.rotation.y = Math.sin(this.time * 18.0 + i) * wiggleAmp * pulse * (1.0 - t);
      b.rotation.z = Math.sin(this.time * 22.0 + i * 0.7) * wiggleAmp * pulse * (1.0 - t) * 0.7;
      b.rotation.x = 0;
    }
  }
}
