// src/animals/Giraffe/GiraffeSkinTexture.js

import * as THREE from 'three';

export function createGiraffeSkinTexture(options = {}) {
  const size = options.size || 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const base = options.baseColor || '#d9b07a';
  const spot = options.spotColor || '#7a4b21';

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = spot;
  const rng = (seed) => {
    const x = Math.sin(seed * 43758.5453);
    return x - Math.floor(x);
  };

  const spotCount = options.spotCount || 85;
  for (let i = 0; i < spotCount; i++) {
    const seed = i + (options.seed || 1);
    const cx = rng(seed) * size;
    const cy = rng(seed + 13) * size;
    const radius = (rng(seed + 29) * 0.05 + 0.025) * size;

    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 1.15, radius, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(options.repeatU || 2, options.repeatV || 3);
  texture.anisotropy = 4;
  return texture;
}
