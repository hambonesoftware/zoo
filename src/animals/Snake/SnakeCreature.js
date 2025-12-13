// src/animals/Snake/SnakeCreature.js

import * as THREE from "three";
import { getDefaultSnakeDefinition } from "./SnakeDefinition.js";
import { buildSnakeSkeleton } from "./SnakeSkeleton.js";
import { SnakeLocomotion } from "./SnakeLocomotion.js";
import { SnakeSegmentedMesh } from "./SnakeGeometry.js";

/**
 * SnakeCreature
 *
 * This is a self-contained creature object you can mount into an existing Zoo Pen.
 * It exposes:
 * - group: THREE.Group root
 * - update(dt)
 * - applyTuning(tuning)
 * - getTuningSchema() and getDefaultTuning()
 */
export class SnakeCreature {
  /**
   * @param {Object} opts
   * @param {Object} [opts.definitionOverride] partial overrides for SnakeDefinition
   * @param {Object} [opts.tuning] optional tuning
   */
  constructor(opts = {}) {
    const def = { ...getDefaultSnakeDefinition(), ...(opts.definitionOverride ?? {}) };
    this.definition = def;

    this.group = new THREE.Group();
    this.group.name = "SnakeCreature";

    // Build bones
    const skel = buildSnakeSkeleton(def);
    this.rootBone = skel.root;
    this.spineBones = skel.spineBones;
    this.headBone = skel.head;
    this.tongueBones = skel.tongueBones;
    this.bonesByName = skel.bonesByName;

    // Attach skeleton to group
    this.group.add(this.rootBone);

    // Build visuals
    this.segmented = new SnakeSegmentedMesh(
      this.group,
      this.spineBones,
      this.headBone,
      this.tongueBones,
      def
    );
    this.group.add(this.segmented.group);

    // Locomotion
    this.locomotion = new SnakeLocomotion(this.rootBone, this.spineBones, this.headBone, this.tongueBones);

    // Tuning
    this.tuning = this.getDefaultTuning();
    if (opts.tuning) this.applyTuning(opts.tuning);

    // Initialize
    this._applyTuningToLocomotion();
    this.segmented.updateFromBones(this._getMeshParamsFromTuning());
  }

  getDefaultTuning() {
    return {
      global: {
        scale: 1.0,
        rotateY: 0.0,
      },
      body: {
        baseRadius: this.definition.baseRadius,
        taperToRadius: this.definition.taperToRadius,
        headRadius: this.definition.headRadius,
      },
      motion: {
        speed: 0.25,
        waveSpeed: 2.8,
        wavePhaseStep: 0.55,
        yawAmp: 0.28,
        rollAmp: 0.06,
        headStabilize: 0.5,
      },
      tongue: {
        baseOffset: { x: 0.0, y: -0.03, z: 0.12 },
        flickRate: 1.6,
        extendAmp: 0.9,
        wiggleAmp: 0.15,
        length: this.definition.tongueLength,
        forkLength: this.definition.tongueForkLength,
        forkSpread: this.definition.tongueForkSpread,
      },
    };
  }

  /**
   * Schema format is intentionally generic:
   * - categories
   * - fields with {path, label, type, min, max, step}
   *
   * Adjust to match your Zoo studio UI schema if you already have one.
   */
  getTuningSchema() {
    return [
      {
        title: "Global",
        collapsed: false,
        fields: [
          { path: "global.scale", label: "Scale", type: "range", min: 0.25, max: 3.0, step: 0.01 },
          { path: "global.rotateY", label: "Rotate Y", type: "range", min: -Math.PI, max: Math.PI, step: 0.01 },
        ],
      },
      {
        title: "Body",
        collapsed: false,
        fields: [
          { path: "body.baseRadius", label: "Base Radius", type: "range", min: 0.03, max: 0.35, step: 0.001 },
          { path: "body.taperToRadius", label: "Tail Radius", type: "range", min: 0.01, max: 0.22, step: 0.001 },
          { path: "body.headRadius", label: "Head Radius", type: "range", min: 0.03, max: 0.35, step: 0.001 },
        ],
      },
      {
        title: "Motion",
        collapsed: true,
        fields: [
          { path: "motion.speed", label: "Speed", type: "range", min: 0.0, max: 1.25, step: 0.01 },
          { path: "motion.waveSpeed", label: "Wave Speed", type: "range", min: 0.2, max: 8.0, step: 0.01 },
          { path: "motion.wavePhaseStep", label: "Wave Phase Step", type: "range", min: 0.05, max: 1.5, step: 0.01 },
          { path: "motion.yawAmp", label: "Yaw Amp", type: "range", min: 0.0, max: 1.2, step: 0.01 },
          { path: "motion.rollAmp", label: "Roll Amp", type: "range", min: 0.0, max: 0.6, step: 0.01 },
          { path: "motion.headStabilize", label: "Head Stabilize", type: "range", min: 0.0, max: 1.0, step: 0.01 },
        ],
      },
      {
        title: "Tongue",
        collapsed: true,
        fields: [
          { path: "tongue.length", label: "Tongue Length", type: "range", min: 0.05, max: 0.6, step: 0.005 },
          { path: "tongue.forkLength", label: "Fork Length", type: "range", min: 0.01, max: 0.2, step: 0.0025 },
          { path: "tongue.forkSpread", label: "Fork Spread", type: "range", min: 0.0, max: 0.16, step: 0.0025 },
          { path: "tongue.flickRate", label: "Flick Rate", type: "range", min: 0.0, max: 6.0, step: 0.01 },
          { path: "tongue.extendAmp", label: "Extend Amp", type: "range", min: 0.0, max: 1.0, step: 0.01 },
          { path: "tongue.wiggleAmp", label: "Wiggle Amp", type: "range", min: 0.0, max: 0.8, step: 0.01 },
        ],
      },
    ];
  }

  /**
   * @param {Object} patch deep partial
   */
  applyTuning(patch) {
    this.tuning = deepMerge(this.tuning, patch);

    // Global transforms
    const scale = this.tuning.global?.scale ?? 1.0;
    this.group.scale.set(scale, scale, scale);
    this.group.rotation.y = this.tuning.global?.rotateY ?? 0.0;

    // Locomotion
    this._applyTuningToLocomotion();

    // Mesh params (radius/tongue dims)
    this.segmented.updateFromBones(this._getMeshParamsFromTuning());
  }

  _applyTuningToLocomotion() {
    // The locomotion reads tuning live in update(), but we can still clamp if desired.
  }

  _getMeshParamsFromTuning() {
    return {
      baseRadius: this.tuning.body?.baseRadius,
      taperToRadius: this.tuning.body?.taperToRadius,
      headRadius: this.tuning.body?.headRadius,
      tongueLength: this.tuning.tongue?.length,
      tongueForkLength: this.tuning.tongue?.forkLength,
      tongueForkSpread: this.tuning.tongue?.forkSpread,
    };
  }

  update(dt) {
    // Animate skeleton
    this.locomotion.update(dt, this.tuning);

    // Update visuals to match bones
    this.segmented.updateFromBones(this._getMeshParamsFromTuning());
  }

  dispose() {
    if (this.segmented) this.segmented.dispose();
  }
}

/**
 * Simple deep merge for tuning objects (no arrays; object-only).
 */
function deepMerge(base, patch) {
  if (patch == null) return base;
  if (typeof patch !== "object") return patch;

  const out = Array.isArray(base) ? base.slice() : { ...(base ?? {}) };

  for (const [k, v] of Object.entries(patch)) {
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
