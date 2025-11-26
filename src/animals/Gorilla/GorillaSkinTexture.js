// src/animals/Gorilla/GorillaSkinTexture.js

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

function drawSpeckle(ctx, size, rand, base) {
  const x = rand() * size;
  const y = rand() * size;
  const radius = 0.4 + rand() * 1.4;
  const delta = (rand() - 0.5) * 18;
  const r = base.r + delta;
  const g = base.g + delta * 0.9;
  const b = base.b + delta * 0.75;

  ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},0.36)`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrease(ctx, size, rand, colorString) {
  const xStart = rand() * size;
  const yStart = rand() * size;
  const length = size * (0.25 + rand() * 0.25);
  const angle = rand() * Math.PI * 2;

  ctx.strokeStyle = colorString.replace('OPACITY', (0.25 + rand() * 0.15).toFixed(3));
  ctx.lineWidth = 2 + rand() * 3;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(xStart, yStart);
  ctx.lineTo(xStart + Math.cos(angle) * length, yStart + Math.sin(angle) * length);
  ctx.stroke();
}

/**
 * Gorilla skin: dark charcoal base with subtle chest lightening and
 * fine speckling. The texture is deterministic via a simple LCG for
 * repeatable variants without new assets.
 */
export function createGorillaSkinCanvasTexture(options = {}) {
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

  const baseHex = options.bodyColor ?? 0x2f3034;
  const chestHex = options.chestColor ?? 0x4b4c52;

  const base = hexToRgb(baseHex);
  const chest = hexToRgb(chestHex);

  const rand = createSeededRandom(options.seed ?? 4242);

  // Base fill
  ctx.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
  ctx.fillRect(0, 0, size, size);

  // Chest/face lightening gradient from center-bottom upward
  const chestGradient = ctx.createRadialGradient(size * 0.5, size * 0.6, size * 0.1, size * 0.5, size * 0.6, size * 0.6);
  chestGradient.addColorStop(0, `rgba(${chest.r},${chest.g},${chest.b},0.5)`);
  chestGradient.addColorStop(1, `rgba(${chest.r},${chest.g},${chest.b},0)`);
  ctx.fillStyle = chestGradient;
  ctx.fillRect(0, 0, size, size);

  // Crease strokes to hint at skin folds around limbs
  const creaseTemplate = `rgba(${chest.r},${chest.g},${chest.b},OPACITY)`;
  for (let i = 0; i < 30; i++) {
    drawCrease(ctx, size, rand, creaseTemplate);
  }

  // Fine speckle noise for fur breakup
  const speckCount = size * size * 0.012;
  for (let i = 0; i < speckCount; i++) {
    drawSpeckle(ctx, size, rand, base);
  }

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

export const gorillaSkinCanvasTexture = createGorillaSkinCanvasTexture();
