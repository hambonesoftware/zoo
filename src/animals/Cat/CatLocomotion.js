// src/animals/Cat/CatLocomotion.js

/**
 * CatLocomotion
 *
 * Lightweight feline locomotion tuned for the CatCreature.
 * - Idle: gentle breathing, tail sway, micro head/ear motion.
 * - Walk: diagonal gait (front-left + rear-right in phase), flexible spine.
 * - Optional prowl/run states reuse the walk pose with different speeds.
 */
export class CatLocomotion {
  constructor(cat) {
    this.cat = cat;

    this.state = 'idle';
    this.time = 0;
    this.idlePhase = 0;
    this.walkPhase = 0;

    // Core parameters
    this.baseHeight = 0.38;
    this.walkCycleSpeed = 2.6; // radians per second around the gait circle
    this.idleBreathAmplitude = 0.015;
    this.tailSwayAmplitude = 0.35;
    this.tailSwaySpeed = 1.6;
    this.spineSwayAmplitude = 0.05;
  }

  setState(nextState) {
    const allowed = ['idle', 'walk', 'prowl', 'run'];
    if (!allowed.includes(nextState)) return;
    if (this.state !== nextState) {
      this.state = nextState;
      if (nextState === 'idle') {
        // Reset walk phase for smooth restart
        this.walkPhase = 0;
      }
    }
  }

  update(dt) {
    const bones = this.cat?.bones;
    const root = bones?.spine_base;
    if (!bones || !root) return;

    this.time += dt;

    // Follow the behavior's desired state if provided
    if (this.cat.state && this.cat.state !== this.state) {
      this.setState(this.cat.state);
    }

    switch (this.state) {
      case 'walk':
        this._updateWalk(dt, bones, root, 1.0, 0);
        break;
      case 'prowl':
        this._updateWalk(dt, bones, root, 0.65, -0.03);
        break;
      case 'run':
        this._updateWalk(dt, bones, root, 1.3, 0.015);
        break;
      case 'idle':
      default:
        this._updateIdle(dt, bones, root);
        break;
    }
  }

  _updateIdle(dt, bones, root) {
    this.idlePhase += dt;
    const breathe = Math.sin(this.idlePhase * 1.4) * this.idleBreathAmplitude;
    const sway = Math.sin(this.idlePhase * 0.8) * 0.01;

    root.position.set(0, this.baseHeight + breathe, 0);
    root.rotation.set(0, 0, sway);

    this._applySpineIdle(bones, this.idlePhase);
    this._applyTailSway(bones, this.idlePhase, 0.6);
    this._applyHeadIdle(bones, this.idlePhase);
    this._applyEarIdle(bones, this.idlePhase);
  }

  _updateWalk(dt, bones, root, speedScale = 1, heightOffset = 0) {
    const TWO_PI = Math.PI * 2;
    this.walkPhase = (this.walkPhase + dt * this.walkCycleSpeed * speedScale) % TWO_PI;

    const vertical = Math.sin(this.walkPhase * 2.0) * (0.02 * speedScale) + heightOffset;
    const roll = Math.sin(this.walkPhase) * 0.025;
    root.position.set(0, this.baseHeight + vertical, 0);
    root.rotation.set(0, 0, roll);

    this._applyWalkGait(bones, this.walkPhase, speedScale);
    this._applySpineWalk(bones, this.walkPhase, speedScale);
    this._applyTailSway(bones, this.walkPhase, 1.0 * speedScale);
    this._applyHeadWalk(bones, this.walkPhase);
    this._applyEarWalk(bones, this.walkPhase);
  }

  _applySpineIdle(bones, t) {
    const spineMid = bones.spine_mid;
    const spineNeck = bones.spine_neck;
    const head = bones.head;

    const arch = Math.sin(t * 0.9) * 0.02;
    const yaw = Math.sin(t * 0.6) * 0.015;

    if (spineMid) {
      spineMid.rotation.set(arch, yaw * 0.6, 0);
    }
    if (spineNeck) {
      spineNeck.rotation.x = 0.08 + arch * 0.7;
      spineNeck.rotation.y = yaw;
      spineNeck.rotation.z = 0;
    }
    if (head) {
      head.rotation.x = -0.15 + arch * -0.4;
      head.rotation.y = yaw * 1.2;
      head.rotation.z = 0;
    }
  }

  _applyHeadIdle(bones, t) {
    const head = bones.head;
    if (!head) return;
    head.rotation.y += Math.sin(t * 0.4) * 0.01;
    head.rotation.x += Math.sin(t * 0.7 + 0.6) * 0.008;
  }

  _applyEarIdle(bones, t) {
    const earLeft = bones.ear_left;
    const earRight = bones.ear_right;
    const flutter = Math.sin(t * 1.1) * 0.05;
    if (earLeft) earLeft.rotation.z = flutter;
    if (earRight) earRight.rotation.z = -flutter;
  }

  _applyWalkGait(bones, phase, speedScale) {
    const TWO_PI = Math.PI * 2;
    const strideFront = 0.45 * speedScale;
    const strideRear = 0.6 * speedScale;
    const kneeFront = 0.7;
    const kneeRear = 0.95;
    const pawLift = 0.18 * speedScale;

    const phases = {
      front_left: phase,
      rear_right: phase,
      front_right: (phase + Math.PI) % TWO_PI,
      rear_left: (phase + Math.PI) % TWO_PI
    };

    this._applyLegPose(bones, {
      shoulder: 'front_left_shoulder',
      upper: 'front_left_upper',
      lower: 'front_left_lower',
      paw: 'front_left_paw',
      phase: phases.front_left,
      swing: strideFront,
      knee: kneeFront,
      lift: pawLift * 0.8
    });

    this._applyLegPose(bones, {
      shoulder: 'front_right_shoulder',
      upper: 'front_right_upper',
      lower: 'front_right_lower',
      paw: 'front_right_paw',
      phase: phases.front_right,
      swing: strideFront,
      knee: kneeFront,
      lift: pawLift * 0.8
    });

    this._applyLegPose(bones, {
      shoulder: 'rear_left_hip',
      upper: 'rear_left_upper',
      lower: 'rear_left_lower',
      paw: 'rear_left_paw',
      phase: phases.rear_left,
      swing: strideRear,
      knee: kneeRear,
      lift: pawLift
    });

    this._applyLegPose(bones, {
      shoulder: 'rear_right_hip',
      upper: 'rear_right_upper',
      lower: 'rear_right_lower',
      paw: 'rear_right_paw',
      phase: phases.rear_right,
      swing: strideRear,
      knee: kneeRear,
      lift: pawLift
    });
  }

  _applyLegPose(bones, { shoulder, upper, lower, paw, phase, swing, knee, lift }) {
    const upperBone = bones[upper];
    const lowerBone = bones[lower];
    const pawBone = bones[paw];
    const shoulderBone = bones[shoulder];

    if (shoulderBone) {
      // Slight yaw to hint at diagonal gait
      shoulderBone.rotation.y = Math.sin(phase) * 0.08;
      shoulderBone.rotation.z = Math.sin(phase * 0.5) * 0.02;
    }

    const swingVal = Math.sin(phase);
    const liftVal = Math.max(0, Math.sin(phase + Math.PI / 2)) * lift;

    if (upperBone) {
      upperBone.rotation.x = swingVal * swing + liftVal * 0.2;
    }
    if (lowerBone) {
      lowerBone.rotation.x = Math.max(0, -swingVal) * knee + liftVal;
    }
    if (pawBone) {
      pawBone.rotation.x = -Math.max(0, liftVal * 0.6);
    }
  }

  _applySpineWalk(bones, phase, speedScale) {
    const spineMid = bones.spine_mid;
    const spineNeck = bones.spine_neck;
    const head = bones.head;

    const undulate = Math.sin(phase) * this.spineSwayAmplitude * speedScale;
    const arch = Math.sin(phase * 2.0) * 0.04 * speedScale;

    if (spineMid) {
      spineMid.rotation.x = arch * 0.5;
      spineMid.rotation.y = undulate * 0.7;
      spineMid.rotation.z = 0;
    }
    if (spineNeck) {
      spineNeck.rotation.x = 0.12 + arch * 0.6;
      spineNeck.rotation.y = undulate * 0.9;
      spineNeck.rotation.z = 0;
    }
    if (head) {
      head.rotation.x = -0.18 + arch * -0.4;
      head.rotation.y = undulate * 1.2;
      head.rotation.z = 0;
    }
  }

  _applyHeadWalk(bones, phase) {
    const head = bones.head;
    if (!head) return;
    head.rotation.y += Math.sin(phase * 1.5 + Math.PI / 3) * 0.04;
    head.rotation.x += Math.sin(phase * 2.0) * 0.02;
  }

  _applyEarWalk(bones, phase) {
    const earLeft = bones.ear_left;
    const earRight = bones.ear_right;
    const flap = Math.sin(phase * 2.2) * 0.12;
    if (earLeft) earLeft.rotation.z = flap;
    if (earRight) earRight.rotation.z = -flap;
  }

  _applyTailSway(bones, t, speedMult = 1) {
    const tailBase = bones.tail_base;
    const tailMid = bones.tail_mid;
    const tailTip = bones.tail_tip;
    const sway = Math.sin(t * this.tailSwaySpeed * speedMult) * this.tailSwayAmplitude;
    const lift = Math.sin(t * this.tailSwaySpeed * 0.5 * speedMult) * 0.12;

    if (tailBase) {
      tailBase.rotation.y = sway * 0.6;
      tailBase.rotation.x = lift * 0.4;
    }
    if (tailMid) {
      tailMid.rotation.y = sway * 0.8;
      tailMid.rotation.x = lift * 0.7;
    }
    if (tailTip) {
      tailTip.rotation.y = sway;
      tailTip.rotation.x = lift;
    }
  }
}
