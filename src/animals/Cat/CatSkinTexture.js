// src/animals/Cat/CatSkinTexture.js

import * as THREE from 'three';

/**
 * Create a procedural cat skin CanvasTexture.
 *
 * This is a purely CPU-side generator that paints a tiling-friendly,
 * slightly mottled greyscale texture with some directional "wrinkle"
 * strokes. It is intentionally cheap and generic – the heavy lifting
 * of final shading is done in CatSkinNode.js using TSL.
 *
 * The texture is designed to look OK both when used once (uv 0–1)
 * and when gently repeated (uv scaled a bit).
 */
export function createCatSkinCanvasTexture(options = {}) {
  const size = options.size || 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback: solid grey if 2D context is unavailable for some reason.
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.needsUpdate = true;
    return fallback;
  }

  // --- Base fill: mid–dark warm grey ---
  const baseR = 115;
  const baseG = 115;
  const baseB = 120;
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, size, size);

  // --- Large scale mottling (broad patches) ---
  const patchCount = 220;
  for (let i = 0; i < patchCount; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = (size / 20) + Math.random() * (size / 10);
    const dark = Math.random() < 0.5;

    const delta = 18 + Math.random() * 20;
    const rCol = baseR + (dark ? -delta : delta);
    const gCol = baseG + (dark ? -delta : delta * 0.9);
    const bCol = baseB + (dark ? -delta * 0.8 : delta * 0.5);

    ctx.fillStyle = `rgba(${rCol|0},${gCol|0},${bCol|0},0.18)`;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      r * (0.6 + Math.random() * 0.6),
      r * (0.4 + Math.random() * 0.7),
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // --- Finer speckle noise (pores / tiny bumps) ---
  const speckCount = size * size * 0.02; // about 2% of pixels get a small speck
  for (let i = 0; i < speckCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 0.5 + Math.random() * 1.5;
    const delta = (Math.random() - 0.5) * 40;
    const rCol = baseR + delta;
    const gCol = baseG + delta;
    const bCol = baseB + delta * 0.8;

    ctx.fillStyle = `rgba(${rCol|0},${gCol|0},${bCol|0},0.3)`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Directional wrinkle strokes ---
  // We paint short, semi-transparent line segments that gently curve.
  const wrinkleLayers = 3;
  for (let layer = 0; layer < wrinkleLayers; layer++) {
    const strokeCount = 900 + layer * 450;
    const alpha = 0.08 + layer * 0.02;
    const thickness = 1 + layer;
    const darkness = 18 + layer * 8;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < strokeCount; i++) {
      const startX = Math.random() * size;
      const startY = Math.random() * size;

      // Bias direction slightly to be more horizontal than vertical,
      // roughly how wrinkles on an cat flank tend to flow.
      const dirAngle = (Math.random() * Math.PI * 0.4) - (Math.PI * 0.2);
      const length = (size / 40) + Math.random() * (size / 25);

      const endX = startX + Math.cos(dirAngle) * length;
      const endY = startY + Math.sin(dirAngle) * length;

      const rCol = baseR - darkness;
      const gCol = baseG - darkness;
      const bCol = baseB - darkness * 0.8;

      ctx.strokeStyle = `rgba(${rCol|0},${gCol|0},${bCol|0},${alpha.toFixed(3)})`;
      ctx.lineWidth = thickness;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  // We keep clamp-to-edge wrapping; we will mostly sample in 0–1 UV space.
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  // Color space: treat as sRGB so it matches other color inputs.
  if (texture.colorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  return texture;
}

/**
 * Singleton instance – most cats will happily share one skin texture.
 */
export const catSkinCanvasTexture = createCatSkinCanvasTexture();
