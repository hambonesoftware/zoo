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

function drawSpot(ctx, heightCtx, size, rand, colorString, radiusRange) {
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

  if (heightCtx) {
    const depthValue = 95 + rand() * 30;
    heightCtx.save();
    heightCtx.translate(cx, cy);
    heightCtx.rotate(rot);
    heightCtx.scale(1, squish);

    heightCtx.fillStyle = `rgba(${depthValue},${depthValue},${depthValue},0.9)`;
    heightCtx.beginPath();
    heightCtx.ellipse(0, 0, r, r * (0.7 + rand() * 0.3), 0, 0, Math.PI * 2);
    heightCtx.fill();

    heightCtx.restore();
  }
}

function drawVeins(ctx, heightCtx, size, rand, colorString) {
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

    if (heightCtx) {
      const tone = 130 + rand() * 20;
      heightCtx.strokeStyle = `rgba(${tone},${tone},${tone},0.5)`;
      heightCtx.beginPath();
      heightCtx.moveTo(x, y);
      heightCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      heightCtx.stroke();
    }
  }
}

function addHeightNoise(ctx, size, rand) {
  const speckCount = size * size * 0.012;
  for (let i = 0; i < speckCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const radius = 0.4 + rand() * 1.1;
    const tone = 110 + rand() * 90;

    ctx.fillStyle = `rgba(${tone},${tone},${tone},0.2)`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Procedural giraffe skin: tawny base with layered spots and subtle vein detail
 * to break up large patches. Deterministic via a tiny LCG so multiple giraffes
 * can share the same texture while remaining stylized and lightweight.
 */
export function createGiraffeSkinTextures(options = {}) {
  const size = options.size || 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;

  const ctx = canvas.getContext('2d');
  const heightCtx = heightCanvas.getContext('2d');
  if (!ctx || !heightCtx) {
    const fallbackColor = new THREE.CanvasTexture(canvas);
    fallbackColor.needsUpdate = true;

    const fallbackHeight = new THREE.CanvasTexture(heightCanvas);
    fallbackHeight.needsUpdate = true;

    return { colorTexture: fallbackColor, heightTexture: fallbackHeight };
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

  const baseHeight = 145;
  heightCtx.fillStyle = `rgb(${baseHeight},${baseHeight},${baseHeight})`;
  heightCtx.fillRect(0, 0, size, size);

  // Belly gradient (lighter underside)
  const bellyGrad = ctx.createLinearGradient(0, size * 0.25, 0, size);
  bellyGrad.addColorStop(0, `rgba(${belly.r},${belly.g},${belly.b},0)`);
  bellyGrad.addColorStop(1, `rgba(${belly.r},${belly.g},${belly.b},0.45)`);
  ctx.fillStyle = bellyGrad;
  ctx.fillRect(0, 0, size, size);

  const bellyHeightGrad = heightCtx.createLinearGradient(0, size * 0.2, 0, size);
  bellyHeightGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bellyHeightGrad.addColorStop(1, 'rgba(30,30,30,0.5)');
  heightCtx.fillStyle = bellyHeightGrad;
  heightCtx.fillRect(0, 0, size, size);

  // Large spots
  const spotColor = `rgba(${spot.r},${spot.g},${spot.b},0.82)`;
  const spotCount = 140;
  for (let i = 0; i < spotCount; i++) {
    drawSpot(ctx, heightCtx, size, rand, spotColor, [0.04, 0.08]);
  }

  // Vein-like breakup inside spots for extra variation
  const veinColor = `rgba(${spot.r},${spot.g},${spot.b},0.35)`;
  drawVeins(ctx, heightCtx, size, rand, veinColor);

  addHeightNoise(heightCtx, size, rand);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  if (texture.colorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  const heightTexture = new THREE.CanvasTexture(heightCanvas);
  heightTexture.anisotropy = 4;
  heightTexture.needsUpdate = true;
  heightTexture.wrapS = THREE.ClampToEdgeWrapping;
  heightTexture.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTexture: texture, heightTexture };
}

/**
 * Singleton giraffe skin texture for reuse across instances.
 */
export function createGiraffeSkinCanvasTexture(options = {}) {
  return createGiraffeSkinTextures(options).colorTexture;
}

export const giraffeSkinTextures = createGiraffeSkinTextures();
export const giraffeSkinCanvasTexture = giraffeSkinTextures.colorTexture;
export const giraffeSkinHeightTexture = giraffeSkinTextures.heightTexture;
