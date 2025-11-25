import * as THREE from 'three';

/**
 * Animate the cat's tail for natural swishing and expressive motion.
 * @param {CatBehavior} cat - The CatBehavior instance, must have .bones[]
 * @param {number} time - Global time (seconds)
 * @param {Object} [opts] - Optional: { mood, sway, jumpBlend }
 *   mood: string ('idle', 'alert', 'happy', 'scared', etc)
 *   sway: number, base swaying amplitude multiplier (default 1)
 *   jumpBlend: 0 (idle) .. 1 (fully in air)
 */
export function animateTail(cat, time, opts = {}) {
  const mood = opts.mood || cat.state || 'walk';
  const sway = typeof opts.sway === 'number' ? opts.sway : 1.0;
  const jumpBlend = typeof opts.jumpBlend === 'number' ? opts.jumpBlend : 0.0;

  // Bone refs
  const tailBase = cat.bones['tail_base'];
  const tailMid = cat.bones['tail_mid'];
  const tailTip = cat.bones['tail_tip'];
  if (!tailBase || !tailMid || !tailTip) return;

  // Mood: set base amplitude and frequency
  let amp = 0.25, freq = 2.2, tipAmp = 0.55, tipFreq = 3.7, baseYaw = 0;
  switch (mood) {
    case 'idle':   amp = 0.08; freq = 1.3; tipAmp = 0.21; tipFreq = 2.1; break;
    case 'walk':   amp = 0.23; freq = 2.2; tipAmp = 0.49; tipFreq = 3.7; break;
    case 'run':    amp = 0.45; freq = 3.2; tipAmp = 0.85; tipFreq = 5.2; break;
    case 'alert':  amp = 0.12; freq = 4.0; tipAmp = 0.24; tipFreq = 7.0; baseYaw = 0.32; break;
    case 'scared': amp = 0.08; freq = 6.0; tipAmp = 0.18; tipFreq = 10.0; baseYaw = -0.3; break;
    case 'happy':  amp = 0.55; freq = 2.1; tipAmp = 0.95; tipFreq = 3.9; break;
    // ... add more moods if you like!
  }
  amp *= sway;
  tipAmp *= sway;

  // Optional: blend out most tail motion during jump
  if (jumpBlend > 0.01) {
    amp *= (1 - jumpBlend) * 0.7 + 0.05;
    tipAmp *= (1 - jumpBlend) * 0.7 + 0.05;
    baseYaw *= (1 - jumpBlend);
  }

  // Animate!
  // Base yaw: sets whole tail angle
  tailBase.rotation.y = baseYaw + Math.sin(time * freq + 0.3) * amp;
  // Up/down "twitch" and wag
  tailBase.rotation.x = Math.cos(time * (freq * 0.6)) * amp * 0.16;

  // Mid swish: slightly lagged and higher freq for realism
  tailMid.rotation.y = Math.sin(time * tipFreq + 0.7) * tipAmp * 0.7;
  tailMid.rotation.x = Math.cos(time * tipFreq + 0.5) * tipAmp * 0.12;

  // Tip: fast, fine motion + little curl
  tailTip.rotation.y = Math.sin(time * tipFreq * 1.6 + 0.9) * tipAmp * 1.1;
  tailTip.rotation.x = Math.cos(time * tipFreq * 1.5 + 0.7) * tipAmp * 0.13 + Math.sin(time * 0.9) * 0.04;

  // Optional: curl more when happy, bristle more when scared
  if (mood === 'happy') {
    tailTip.rotation.x += 0.18 * (1 - jumpBlend);
  }
  if (mood === 'scared') {
    tailTip.rotation.z = Math.abs(Math.sin(time * tipFreq * 2.0)) * 0.22;
  } else {
    tailTip.rotation.z = 0;
  }
}
