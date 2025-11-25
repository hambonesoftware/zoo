// src/utils/graphics/createStripeTexture.js

import * as THREE from 'three';

/**
 * Create a repeating diagonal stripe texture (red and white) for a box.
 * @param {number} size - Size in px (suggested: 256)
 * @param {number} stripeWidth - Stripe width in px (suggested: 48)
 * @returns {THREE.Texture}
 */
export function createStripeTexture(size = 256, stripeWidth = 48) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Paint white background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);

  // Draw red diagonal stripes
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.translate(-size / 2, -size / 2);
  for (let x = -size; x < size * 2; x += stripeWidth * 2) {
    ctx.fillStyle = '#d00';
    ctx.fillRect(x, 0, stripeWidth, size * 2);
  }
  ctx.restore();

  // Make it repeat
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  // WebGPU color management: this is a color texture, so mark as sRGB
  if (texture.colorSpace !== undefined) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  return texture;
}
