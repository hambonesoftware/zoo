// src/animals/Cat/CatSkinTexture.js

import * as THREE from 'three';

function hexToRgb(hex) {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff
  };
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function drawStripe(ctx, size, rand, colorString, opacity) {
  const yBase = rand() * size;
  const wiggle = size * 0.015;
  const amplitude = size * (0.02 + rand() * 0.025);
  const frequency = 2 + rand() * 2.5;

  ctx.strokeStyle = colorString.replace('OPACITY', opacity.toFixed(3));
  ctx.lineWidth = 6 + rand() * 10;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(0, yBase + (rand() - 0.5) * wiggle);
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = t * size;
    const offset = Math.sin(t * Math.PI * frequency + rand() * Math.PI * 2) * amplitude;
    ctx.lineTo(x, yBase + offset);
  }
  ctx.stroke();
}

/**
 * Create a procedural cat fur CanvasTexture.
 *
 * The texture aims for a warm, readable coat with soft belly lightening and
 * playful banding. It is deterministic via a tiny LCG so multiple cats can
 * share the same texture while still allowing a user-provided seed.
 */
export function createCatSkinCanvasTexture(options = {}) {
  const size = options.size || 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.needsUpdate = true;
    return fallback;
  }

  const baseHex = options.bodyColor ?? 0xc08a57; // warm tawny
  const accentHex = options.accentColor ?? 0x7a4d30; // muted chestnut for stripes
  const bellyHex = options.bellyColor ?? 0xf0d9b5; // lighter underside/ear tips

  const base = hexToRgb(baseHex);
  const accent = hexToRgb(accentHex);
  const belly = hexToRgb(bellyHex);

  const rand = createSeededRandom(options.seed ?? 1234);

  // --- Base fill ---
  ctx.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
  ctx.fillRect(0, 0, size, size);

  // --- Belly gradient (lighter toward the bottom) ---
  const bellyGrad = ctx.createLinearGradient(0, size * 0.35, 0, size);
  bellyGrad.addColorStop(0, `rgba(${belly.r},${belly.g},${belly.b},0)`);
  bellyGrad.addColorStop(1, `rgba(${belly.r},${belly.g},${belly.b},0.6)`);
  ctx.fillStyle = bellyGrad;
  ctx.fillRect(0, 0, size, size);

  // --- Soft mottling patches ---
  const patchCount = 160;
  for (let i = 0; i < patchCount; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = size * (0.03 + rand() * 0.06);
    const dark = rand() < 0.5;
    const delta = 18 + rand() * 24;
    const rCol = base.r + (dark ? -delta : delta);
    const gCol = base.g + (dark ? -delta : delta * 0.9);
    const bCol = base.b + (dark ? -delta * 0.7 : delta * 0.6);

    ctx.fillStyle = `rgba(${rCol | 0},${gCol | 0},${bCol | 0},0.16)`;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      r * (0.7 + rand() * 0.5),
      r * (0.5 + rand() * 0.7),
      rand() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // --- Accent stripes (gentle, tail-friendly bands) ---
  const accentTemplate = `rgba(${accent.r},${accent.g},${accent.b},OPACITY)`;
  const stripeCount = 12;
  for (let i = 0; i < stripeCount; i++) {
    drawStripe(ctx, size, rand, accentTemplate, 0.18 + rand() * 0.08);
  }

  // --- Fine speckle noise for fur breakup ---
  const speckCount = size * size * 0.01;
  for (let i = 0; i < speckCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const radius = 0.4 + rand() * 1.2;
    const delta = (rand() - 0.5) * 26;
    const rCol = base.r + delta;
    const gCol = base.g + delta * 0.95;
    const bCol = base.b + delta * 0.8;

    ctx.fillStyle = `rgba(${rCol | 0},${gCol | 0},${bCol | 0},0.38)`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Spine shading (darker along top/back) ---
  const spineGrad = ctx.createLinearGradient(0, 0, 0, size);
  spineGrad.addColorStop(0, 'rgba(0,0,0,0.12)');
  spineGrad.addColorStop(0.5, 'rgba(0,0,0,0.04)');
  spineGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  if (texture.colorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  return texture;
}

/**
 * Singleton instance – most cats will happily share one fur texture.
 */
export const catSkinCanvasTexture = createCatSkinCanvasTexture();
