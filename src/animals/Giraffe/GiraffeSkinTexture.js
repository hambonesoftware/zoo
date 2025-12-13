// src/animals/Giraffe/GiraffeSkinTexture.js

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

function drawSpot(ctx, size, rand, colorString, radiusRange) {
  const cx = rand() * size;
  const cy = rand() * size;
  const r = size * (radiusRange[0] + rand() * radiusRange[1]);
  const squish = 0.6 + rand() * 0.6;
  const rot = rand() * Math.PI * 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(1, squish);

  ctx.fillStyle = colorString;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * (0.7 + rand() * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawVeins(ctx, size, rand, colorString) {
  ctx.strokeStyle = colorString;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  for (let i = 0; i < 80; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = size * (0.02 + rand() * 0.06);
    const angle = rand() * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
}

/**
 * Procedural giraffe skin: tawny base with layered spots and subtle vein detail
 * to break up large patches. Deterministic via a tiny LCG so multiple giraffes
 * can share the same texture while remaining stylized and lightweight.
 */
export function createGiraffeSkinCanvasTexture(options = {}) {
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

  const baseHex = options.baseColor ?? 0xc39b6a;
  const spotHex = options.spotColor ?? 0x6c4c2f;
  const bellyHex = options.bellyColor ?? 0xf2dfc6;

  const base = hexToRgb(baseHex);
  const spot = hexToRgb(spotHex);
  const belly = hexToRgb(bellyHex);

  const rand = createSeededRandom(options.seed ?? 9871);

  ctx.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
  ctx.fillRect(0, 0, size, size);

  // Belly gradient (lighter underside)
  const bellyGrad = ctx.createLinearGradient(0, size * 0.25, 0, size);
  bellyGrad.addColorStop(0, `rgba(${belly.r},${belly.g},${belly.b},0)`);
  bellyGrad.addColorStop(1, `rgba(${belly.r},${belly.g},${belly.b},0.45)`);
  ctx.fillStyle = bellyGrad;
  ctx.fillRect(0, 0, size, size);

  // Large spots
  const spotColor = `rgba(${spot.r},${spot.g},${spot.b},0.82)`;
  const spotCount = 140;
  for (let i = 0; i < spotCount; i++) {
    drawSpot(ctx, size, rand, spotColor, [0.04, 0.08]);
  }

  // Vein-like breakup inside spots for extra variation
  const veinColor = `rgba(${spot.r},${spot.g},${spot.b},0.35)`;
  drawVeins(ctx, size, rand, veinColor);

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
 * Singleton giraffe skin texture for reuse across instances.
 */
export const giraffeSkinCanvasTexture = createGiraffeSkinCanvasTexture();
