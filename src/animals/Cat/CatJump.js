import * as THREE from 'three';

/**
 * If not currently jumping, occasionally start a jump.
 * @param {CatBehavior} cat
 * @param {number} dt
 */
export function maybeTriggerJump(cat, dt) {
  if (cat.jumpState.isJumping) return;
  cat.jumpState.timer -= dt;
  if (cat.jumpState.timer <= 0) {
    cat.jumpState.isJumping = true;
    cat.jumpState.progress = 0;
    cat.jumpState.duration = 0.9 + Math.random() * 0.4; // ~1s
    cat.jumpState.timer = 2.2 + Math.random() * 2.0;    // Next jump in 2–4s
  }
}

/**
 * Animate the jump motion.
 * @param {CatBehavior} cat
 * @param {number} dt
 */
export function animateJump(cat, dt) {
  const jump = cat.jumpState;
  if (!jump.isJumping) return;
  jump.progress += dt / jump.duration;
  if (jump.progress > 1) {
    jump.isJumping = false;
    // Reset limb, spine positions to walk pose
    return;
  }
  // Up-arc: 0..1. Parabola curve, ease in/out.
  const p = jump.progress;
  const arc = Math.sin(p * Math.PI);

  // Spine base & mid position (for body rise)
  if (cat.bones['spine_base']) cat.bones['spine_base'].position.y = arc * 0.38;
  if (cat.bones['spine_mid']) cat.bones['spine_mid'].position.y = 0.07 + arc * 0.25;

  // Crouch before leap: limbs bend, then extend
  cat.limbs.forEach(limb => {
    const upper = cat.bones[limb.upper];
    const lower = cat.bones[limb.lower];
    const paw = cat.bones[limb.paw];

    // Pre-jump crouch, then extend
    const crouch = 1 - Math.abs(0.5 - p) * 2; // 1 at jump start/end, 0 at peak
    if (upper && lower && paw) {
      upper.rotation.x = limb.defaultUpperRotation.x - crouch * 0.7 + arc * 0.7;
      lower.rotation.x = limb.defaultLowerRotation.x + crouch * 1.0 - arc * 0.7;
      paw.position.y = -0.09 + (arc * 0.13 - crouch * 0.1);
    }
  });
}
